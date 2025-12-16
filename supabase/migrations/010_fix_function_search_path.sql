-- 함수 search_path 보안 개선
-- 생성일: 2024년
-- 모든 함수에 SET search_path = public, pg_temp 설정 추가

-- generate_report_number 함수 수정
CREATE OR REPLACE FUNCTION public.generate_report_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    year_part TEXT;
    sequence_num INTEGER;
    report_num TEXT;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    
    -- 올해 생성된 보고서 수를 확인하여 시퀀스 번호 생성
    SELECT COALESCE(MAX(CAST(SUBSTRING(report_number FROM 9) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM public.sales_approval_reports
    WHERE report_number LIKE 'SAR-' || year_part || '-%';
    
    report_num := 'SAR-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN report_num;
END;
$$;

-- charge_points 함수 수정
CREATE OR REPLACE FUNCTION public.charge_points(
    p_user_id UUID,
    p_amount INTEGER,
    p_admin_user_id UUID,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_balance_before INTEGER;
    v_balance_after INTEGER;
    v_transaction_id UUID;
    v_result JSONB;
BEGIN
    -- 잠금을 위해 SELECT FOR UPDATE 사용 (원자적 연산)
    SELECT COALESCE(balance, 0) INTO v_balance_before
    FROM public.points
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- 포인트 레코드가 없으면 생성
    IF v_balance_before IS NULL THEN
        INSERT INTO public.points (user_id, balance)
        VALUES (p_user_id, 0)
        ON CONFLICT (user_id) DO NOTHING;
        
        SELECT COALESCE(balance, 0) INTO v_balance_before
        FROM public.points
        WHERE user_id = p_user_id
        FOR UPDATE;
    END IF;

    v_balance_after := v_balance_before + p_amount;

    -- 포인트 업데이트
    UPDATE public.points
    SET balance = v_balance_after,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- 거래 내역 기록 (감사 로그)
    INSERT INTO public.point_transactions (
        user_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        description,
        admin_user_id
    )
    VALUES (
        p_user_id,
        'charge',
        p_amount,
        v_balance_before,
        v_balance_after,
        'manual_charge',
        COALESCE(p_description, '관리자 포인트 충전'),
        p_admin_user_id
    )
    RETURNING id INTO v_transaction_id;

    v_result := jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'amount', p_amount
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- deduct_points_for_buyer_info 함수 수정
CREATE OR REPLACE FUNCTION public.deduct_points_for_buyer_info(
    p_user_id UUID,
    p_amount INTEGER,
    p_sales_approval_report_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_balance_before INTEGER;
    v_balance_after INTEGER;
    v_transaction_id UUID;
    v_already_deducted BOOLEAN;
    v_result JSONB;
BEGIN
    -- 이미 차감되었는지 확인 (중복 방지)
    SELECT points_deducted > 0 INTO v_already_deducted
    FROM public.sales_approval_reports
    WHERE id = p_sales_approval_report_id;

    IF v_already_deducted THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '이미 포인트가 차감된 보고서입니다.',
            'code', 'ALREADY_DEDUCTED'
        );
    END IF;

    -- 잠금을 위해 SELECT FOR UPDATE 사용 (원자적 연산)
    SELECT COALESCE(balance, 0) INTO v_balance_before
    FROM public.points
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- 포인트 부족 확인
    IF v_balance_before < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '포인트가 부족합니다.',
            'code', 'INSUFFICIENT_POINTS',
            'balance', v_balance_before,
            'required', p_amount
        );
    END IF;

    v_balance_after := v_balance_before - p_amount;

    -- 포인트 업데이트
    UPDATE public.points
    SET balance = v_balance_after,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- 거래 내역 기록 (감사 로그)
    INSERT INTO public.point_transactions (
        user_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        description
    )
    VALUES (
        p_user_id,
        'deduct',
        p_amount,
        v_balance_before,
        v_balance_after,
        'sales_approval_report',
        p_sales_approval_report_id,
        '구매자 정보 열람을 위한 중개 수수료 차감'
    )
    RETURNING id INTO v_transaction_id;

    -- 보고서에 포인트 차감 정보 기록
    UPDATE public.sales_approval_reports
    SET points_deducted = p_amount,
        points_deducted_at = NOW(),
        buyer_info_revealed = TRUE,
        buyer_info_revealed_at = NOW()
    WHERE id = p_sales_approval_report_id;

    v_result := jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'amount', p_amount
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- create_points_on_profile_insert 함수 수정
CREATE OR REPLACE FUNCTION public.create_points_on_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.points (user_id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- update_updated_at_column 함수 수정
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- approve_point_charge_request 함수 수정
CREATE OR REPLACE FUNCTION public.approve_point_charge_request(
    p_request_id UUID,
    p_admin_user_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request RECORD;
    v_result JSONB;
BEGIN
    -- 충전 요청 조회
    SELECT * INTO v_request
    FROM public.point_charge_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '충전 요청을 찾을 수 없습니다.'
        );
    END IF;

    -- 이미 처리된 요청인지 확인
    IF v_request.status != 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '이미 처리된 요청입니다.',
            'current_status', v_request.status
        );
    END IF;

    -- 포인트 충전 함수 호출
    SELECT * INTO v_result
    FROM public.charge_points(
        v_request.user_id,
        v_request.requested_points,
        p_admin_user_id,
        COALESCE(p_admin_notes, '충전 요청 승인: ' || v_request.requested_amount || '원 = ' || v_request.requested_points || 'p')
    );

    IF NOT (v_result->>'success')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', v_result->>'error'
        );
    END IF;

    -- 충전 요청 상태 업데이트
    UPDATE public.point_charge_requests
    SET status = 'approved',
        admin_user_id = p_admin_user_id,
        admin_notes = p_admin_notes,
        reviewed_at = NOW(),
        completed_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'charge_result', v_result
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- reject_point_charge_request 함수 수정
CREATE OR REPLACE FUNCTION public.reject_point_charge_request(
    p_request_id UUID,
    p_admin_user_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request RECORD;
BEGIN
    -- 충전 요청 조회
    SELECT * INTO v_request
    FROM public.point_charge_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '충전 요청을 찾을 수 없습니다.'
        );
    END IF;

    -- 이미 처리된 요청인지 확인
    IF v_request.status != 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '이미 처리된 요청입니다.',
            'current_status', v_request.status
        );
    END IF;

    -- 충전 요청 상태 업데이트
    UPDATE public.point_charge_requests
    SET status = 'rejected',
        admin_user_id = p_admin_user_id,
        admin_notes = p_admin_notes,
        reviewed_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

