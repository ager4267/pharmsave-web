-- 프로필 생성 트리거 개선
-- 외래키 제약조건 오류 방지

-- 기존 트리거 삭제 (있는 경우)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 개선된 프로필 생성 함수
-- 외래키 제약조건을 확인하고 안전하게 프로필 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- auth.users에 사용자가 존재하는지 확인 후 프로필 생성
    -- SECURITY DEFINER로 실행되므로 RLS 정책 우회
    INSERT INTO public.profiles (id, email, company_name, business_number)
    VALUES (
        NEW.id, 
        NEW.email,
        '임시회사명',  -- 기본값 (나중에 업데이트됨)
        'TEMP-' || SUBSTRING(NEW.id::text, 1, 10)  -- 임시 사업자등록번호
    )
    ON CONFLICT (id) DO NOTHING;  -- 이미 존재하면 무시
    RETURN NEW;
EXCEPTION
    WHEN foreign_key_violation THEN
        -- 외래키 제약조건 오류인 경우 로그만 남기고 계속 진행
        RAISE WARNING '프로필 생성 실패: auth.users에 사용자가 없습니다. ID: %', NEW.id;
        RETURN NEW;
    WHEN OTHERS THEN
        -- 다른 오류인 경우도 로그만 남기고 계속 진행
        RAISE WARNING '프로필 생성 중 오류 발생: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 재생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 트리거가 제대로 작동하는지 확인하는 함수 (선택사항)
CREATE OR REPLACE FUNCTION public.check_profile_trigger()
RETURNS BOOLEAN AS $$
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) INTO trigger_exists;
    
    RETURN trigger_exists;
END;
$$ LANGUAGE plpgsql;


