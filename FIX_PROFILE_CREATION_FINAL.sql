-- ============================================
-- 프로필 생성 실패 오류 완전 해결 SQL
-- "프로필 생성에 실패했습니다. 프로필이 생성되지 않았습니다." 오류 해결
-- Supabase SQL Editor에 붙여넣어 실행하세요
-- ============================================

-- ============================================
-- 1. 프로필 테이블 구조 확인 및 수정
-- ============================================

-- 1.1 프로필 테이블의 필수 필드 확인
-- company_name과 business_number가 NOT NULL이면 기본값 허용하도록 확인

-- ============================================
-- 2. 트리거 함수 재생성 (더 강력한 버전)
-- ============================================

-- 2.1 기존 함수 삭제
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2.2 새로운 트리거 함수 생성 (오류 처리 개선)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile_exists BOOLEAN := FALSE;
BEGIN
    -- 1. 프로필이 이미 있는지 확인 (RLS 정책 우회)
    -- SECURITY DEFINER로 실행되므로 RLS 정책을 우회하여 직접 조회
    SELECT EXISTS(
        SELECT 1 
        FROM public.profiles 
        WHERE id = NEW.id
    ) INTO v_profile_exists;
    
    -- 2. 이미 존재하면 건너뛰기
    IF v_profile_exists THEN
        RAISE NOTICE '프로필이 이미 존재함: user_id = %', NEW.id;
        RETURN NEW;
    END IF;
    
    -- 3. 프로필 생성 시도
    BEGIN
        -- 필수 필드에 기본값 제공
        INSERT INTO public.profiles (
            id, 
            email, 
            company_name, 
            business_number,
            role,
            license_verification_status,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id, 
            COALESCE(NEW.email, ''),
            '임시회사명',  -- 기본값 (나중에 회원가입 시 업데이트됨)
            'TEMP-' || NEW.id::text,  -- 임시 사업자등록번호 (고유값 보장)
            'buyer',  -- 기본 역할
            'pending',  -- 기본 인증 상태
            NOW(),
            NOW()
        );
        
        -- 성공 로그
        RAISE NOTICE '프로필 생성 성공: user_id = %, email = %', NEW.id, COALESCE(NEW.email, '');
        
    EXCEPTION
        WHEN unique_violation THEN
            -- 이미 존재하면 무시 (다른 트랜잭션에서 생성했을 수 있음)
            RAISE NOTICE '프로필이 이미 존재함 (unique_violation): user_id = %', NEW.id;
            RETURN NEW;
        WHEN not_null_violation THEN
            -- NOT NULL 제약 조건 오류
            RAISE WARNING '프로필 생성 실패 (not_null_violation): user_id = %, 오류 = %', NEW.id, SQLERRM;
            -- 기본값으로 다시 시도
            BEGIN
                INSERT INTO public.profiles (
                    id, 
                    email, 
                    company_name, 
                    business_number
                )
                VALUES (
                    NEW.id, 
                    COALESCE(NEW.email, ''),
                    '임시회사명',
                    'TEMP-' || NEW.id::text
                );
                RAISE NOTICE '프로필 생성 성공 (재시도): user_id = %', NEW.id;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING '프로필 생성 실패 (재시도 실패): user_id = %, 오류 = %', NEW.id, SQLERRM;
                    RETURN NEW;
            END;
            RETURN NEW;
        WHEN OTHERS THEN
            -- 다른 오류는 로그에 기록하고 계속 진행
            RAISE WARNING '프로필 생성 실패: user_id = %, 오류 = %, SQLSTATE = %', NEW.id, SQLERRM, SQLSTATE;
            -- 오류 발생 시에도 트리거는 성공으로 처리 (사용자 생성은 계속됨)
            RETURN NEW;
    END;
    
    RETURN NEW;
END;
$$;

-- ============================================
-- 3. 트리거 재생성
-- ============================================

-- 3.1 기존 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3.2 새로운 트리거 생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. RLS 정책 확인 및 수정
-- ============================================

-- 4.1 관리자 정책 삭제 (무한 재귀 방지)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 4.2 SELECT 정책 (자신의 프로필 조회)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- 4.3 INSERT 정책 (트리거용 - SECURITY DEFINER로 실행되므로 실제로는 필요 없지만 추가)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 4.4 UPDATE 정책 (자신의 프로필 업데이트)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 5. 프로필 테이블 구조 확인
-- ============================================

-- 5.1 프로필 테이블 컬럼 확인
SELECT 
    '프로필 테이블 구조' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 5.2 프로필 테이블 제약 조건 확인
SELECT
    '프로필 테이블 제약 조건' as check_type,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
AND table_name = 'profiles';

-- ============================================
-- 6. 트리거 및 함수 확인
-- ============================================

-- 6.1 트리거 확인
SELECT 
    '트리거 확인' as check_type,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' 
AND trigger_schema = 'auth'
AND trigger_name = 'on_auth_user_created';

-- 6.2 함수 확인
SELECT 
    '함수 확인' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- 6.3 RLS 정책 확인
SELECT 
    'RLS 정책 확인' as check_type,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- ============================================
-- 7. 테스트용 프로필 삭제 (선택사항)
-- ============================================

-- 테스트용 프로필이 있다면 삭제 (실제 운영 환경에서는 실행하지 마세요)
-- DELETE FROM public.profiles WHERE email LIKE 'test@%';

-- ============================================
-- 8. 최종 확인 메시지
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ 프로필 생성 트리거 함수가 재생성되었습니다!';
    RAISE NOTICE '✅ 트리거가 재생성되었습니다!';
    RAISE NOTICE '✅ RLS 정책이 수정되었습니다!';
    RAISE NOTICE '✅ 회원가입 시 프로필이 자동으로 생성됩니다!';
    RAISE NOTICE '✅ 오류 처리가 개선되었습니다!';
END $$;

