-- 포인트 충전 요청 시스템 마이그레이션
-- 생성일: 2024년
-- 팜세이브몰 B2B 중개 플랫폼 - 일반회원 포인트 충전 요청 시스템

-- Point Charge Requests 테이블 (포인트 충전 요청)
CREATE TABLE public.point_charge_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    requested_amount INTEGER NOT NULL CHECK (requested_amount > 0),
    requested_points INTEGER NOT NULL CHECK (requested_points > 0), -- 1원 = 1p
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    description TEXT,
    admin_user_id UUID REFERENCES public.profiles(id), -- 승인/거부한 관리자 ID
    admin_notes TEXT, -- 관리자 메모
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX idx_point_charge_requests_user_id ON public.point_charge_requests(user_id);
CREATE INDEX idx_point_charge_requests_status ON public.point_charge_requests(status);
CREATE INDEX idx_point_charge_requests_created_at ON public.point_charge_requests(created_at);

-- RLS 활성화
ALTER TABLE public.point_charge_requests ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 충전 요청만 조회 가능
CREATE POLICY "Users can view own charge requests" ON public.point_charge_requests
    FOR SELECT USING (user_id = auth.uid());

-- RLS 정책: 사용자는 자신의 충전 요청만 생성 가능
CREATE POLICY "Users can create own charge requests" ON public.point_charge_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS 정책: 사용자는 자신의 대기 중인 충전 요청만 취소 가능
CREATE POLICY "Users can cancel own pending requests" ON public.point_charge_requests
    FOR UPDATE USING (
        user_id = auth.uid() 
        AND status = 'pending'
    )
    WITH CHECK (
        user_id = auth.uid() 
        AND status = 'cancelled'
    );

-- RLS 정책: 관리자는 모든 충전 요청 조회 가능
CREATE POLICY "Admins can view all charge requests" ON public.point_charge_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS 정책: 관리자는 충전 요청 승인/거부 가능
CREATE POLICY "Admins can update charge requests" ON public.point_charge_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS 정책: Service Role을 통한 INSERT 허용 (API에서 사용)
-- Service Role은 RLS를 우회하지만, 명시적으로 정책 추가
-- 실제로는 Service Role이 RLS를 우회하므로 이 정책은 필요 없지만, 안전을 위해 추가

-- 포인트 충전 요청 승인 함수 (관리자 전용)
CREATE OR REPLACE FUNCTION public.approve_point_charge_request(
    p_request_id UUID,
    p_admin_user_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 포인트 충전 요청 거부 함수 (관리자 전용)
CREATE OR REPLACE FUNCTION public.reject_point_charge_request(
    p_request_id UUID,
    p_admin_user_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

