-- ============================================
-- 무한 재귀 오류 완전 해결 SQL
-- "infinite recursion detected in policy for relation 'profiles'" 오류 해결
-- Supabase SQL Editor에 붙여넣어 실행하세요
-- ============================================

-- ============================================
-- 1. 기존 관리자 정책 삭제 (무한 재귀 원인)
-- ============================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view own profile" ON public.profiles;

-- ============================================
-- 2. 관리자 확인 함수 생성 (무한 재귀 완전 방지)
-- ============================================

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- 관리자 확인 함수 생성 (SECURITY DEFINER로 RLS 완전 우회)
-- 이 함수는 RLS 정책을 우회하여 직접 profiles 테이블을 조회합니다
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  -- SECURITY DEFINER로 실행되므로 RLS 정책을 우회하여 직접 조회
  -- 무한 재귀가 발생하지 않음
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = user_id;
  
  -- 관리자인지 확인 (NULL 체크 포함)
  RETURN COALESCE(user_role = 'admin', false);
EXCEPTION
  WHEN OTHERS THEN
    -- 오류 발생 시 false 반환
    RETURN false;
END;
$$;

-- 함수 권한 부여
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- ============================================
-- 3. 새로운 관리자 SELECT 정책 생성 (함수 사용)
-- ============================================

-- 관리자는 모든 프로필을 조회할 수 있음
-- is_admin 함수는 SECURITY DEFINER로 실행되므로 RLS 정책을 우회하여 무한 재귀가 발생하지 않음
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT
    USING (
        -- is_admin 함수 사용 (SECURITY DEFINER로 RLS 우회 - 무한 재귀 방지)
        public.is_admin(auth.uid())
    );

-- ============================================
-- 4. 새로운 관리자 UPDATE 정책 생성 (함수 사용)
-- ============================================

-- 관리자는 모든 프로필을 업데이트할 수 있음
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE
    USING (
        -- is_admin 함수 사용 (SECURITY DEFINER로 RLS 우회 - 무한 재귀 방지)
        public.is_admin(auth.uid())
    )
    WITH CHECK (
        -- is_admin 함수 사용 (SECURITY DEFINER로 RLS 우회 - 무한 재귀 방지)
        public.is_admin(auth.uid())
    );

-- ============================================
-- 5. 사용자 자신의 프로필 조회 정책 (기존 정책 유지)
-- ============================================

-- 사용자는 자신의 프로필을 조회할 수 있음
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile" ON public.profiles
            FOR SELECT
            USING (auth.uid() = id);
    END IF;
END $$;

-- ============================================
-- 6. 사용자 자신의 프로필 업데이트 정책 (기존 정책 유지)
-- ============================================

-- 사용자는 자신의 프로필을 업데이트할 수 있음
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON public.profiles
            FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- ============================================
-- 7. 정책 확인
-- ============================================

SELECT 
    'RLS 정책 확인' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NULL THEN 'NULL (조건 없음)'
        ELSE substring(qual::text, 1, 150) || '...'
    END as using_condition,
    CASE 
        WHEN with_check IS NULL THEN 'NULL (조건 없음)'
        ELSE substring(with_check::text, 1, 150) || '...'
    END as with_check_condition
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY 
    CASE cmd
        WHEN 'SELECT' THEN 1
        WHEN 'UPDATE' THEN 2
        WHEN 'INSERT' THEN 3
        ELSE 4
    END;

-- ============================================
-- 8. 관리자 프로필 확인
-- ============================================

-- 관리자 프로필 확인
SELECT 
    '관리자 프로필 확인' as check_type,
    id,
    email,
    role,
    license_verification_status,
    company_name,
    created_at
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- ============================================
-- 9. 함수 테스트 (선택사항 - 관리자로 로그인한 상태에서 실행)
-- ============================================

-- 관리자 확인 함수가 제대로 작동하는지 확인
-- SELECT 
--     '함수 테스트' as check_type,
--     auth.uid() as current_user_id,
--     public.is_admin(auth.uid()) as is_admin;

-- ============================================
-- 완료 메시지
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ 무한 재귀 오류 해결 SQL이 실행되었습니다!';
    RAISE NOTICE '✅ is_admin 함수가 생성되었습니다! (SECURITY DEFINER)';
    RAISE NOTICE '✅ 관리자 RLS 정책이 단순화되었습니다!';
    RAISE NOTICE '✅ 무한 재귀 문제가 완전히 해결되었습니다!';
    RAISE NOTICE '✅ 이제 프로필 조회가 정상적으로 작동합니다!';
    RAISE NOTICE '✅ 클라이언트 사이드에서 프로필 조회 시 무한 재귀가 발생하지 않습니다!';
END $$;

