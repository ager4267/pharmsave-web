-- 포인트 시스템 마이그레이션
-- 생성일: 2024년
-- 팜세이브몰 B2B 중개 플랫폼 - 포인트 기반 중개 수수료 시스템

-- Points 테이블 (사용자 포인트 잔액)
CREATE TABLE public.points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL UNIQUE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Point Transactions 테이블 (포인트 거래 내역 - 감사 로그)
CREATE TABLE public.point_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('charge', 'deduct', 'refund')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reference_type TEXT, -- 'purchase_request', 'manual_charge', 'admin_adjustment' 등
    reference_id UUID, -- purchase_request_id, sales_approval_report_id 등
    description TEXT,
    admin_user_id UUID REFERENCES public.profiles(id), -- 충전/조정한 관리자 ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Approval Reports 테이블에 포인트 관련 필드 추가
ALTER TABLE public.sales_approval_reports
ADD COLUMN IF NOT EXISTS points_deducted INTEGER DEFAULT 0 CHECK (points_deducted >= 0),
ADD COLUMN IF NOT EXISTS points_deducted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS buyer_info_revealed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS buyer_info_revealed_at TIMESTAMP WITH TIME ZONE;

-- 인덱스 생성
CREATE INDEX idx_points_user_id ON public.points(user_id);
CREATE INDEX idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX idx_point_transactions_reference ON public.point_transactions(reference_type, reference_id);
CREATE INDEX idx_point_transactions_created_at ON public.point_transactions(created_at);
CREATE INDEX idx_sales_approval_reports_points_deducted ON public.sales_approval_reports(points_deducted_at);

-- RLS 활성화
ALTER TABLE public.points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 포인트만 조회 가능
CREATE POLICY "Users can view own points" ON public.points
    FOR SELECT USING (user_id = auth.uid());

-- RLS 정책: 관리자는 모든 포인트 조회 가능
CREATE POLICY "Admins can view all points" ON public.points
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS 정책: 사용자는 자신의 포인트 거래 내역만 조회 가능
CREATE POLICY "Users can view own point transactions" ON public.point_transactions
    FOR SELECT USING (user_id = auth.uid());

-- RLS 정책: 관리자는 모든 포인트 거래 내역 조회 가능
CREATE POLICY "Admins can view all point transactions" ON public.point_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 포인트 충전 함수 (관리자 전용, 원자적 연산)
CREATE OR REPLACE FUNCTION public.charge_points(
    p_user_id UUID,
    p_amount INTEGER,
    p_admin_user_id UUID,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 포인트 차감 함수 (구매자 정보 열람 전, 원자적 연산, 중복 방지)
CREATE OR REPLACE FUNCTION public.deduct_points_for_buyer_info(
    p_user_id UUID,
    p_amount INTEGER,
    p_sales_approval_report_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 트리거: 프로필 생성 시 포인트 레코드 자동 생성
CREATE OR REPLACE FUNCTION public.create_points_on_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.points (user_id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_points_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_points_on_profile_insert();

