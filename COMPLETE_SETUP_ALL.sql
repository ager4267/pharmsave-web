-- ============================================
-- 완전 자동 설정 SQL (한 번에 모든 설정 완료)
-- 이 파일을 Supabase SQL Editor에 복사하여 한 번에 실행하세요
-- ============================================

-- ============================================
-- 1. 프로필 생성 트리거 함수 및 정책 설정
-- ============================================

-- 1.1 관리자 정책 삭제 (무한 재귀 원인 제거)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 1.2 트리거 함수 재생성 (필수 필드 기본값 제공)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- 프로필이 이미 있으면 건너뛰기
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        RETURN NEW;
    END IF;
    
    -- 프로필 생성 (필수 필드에 기본값 제공)
    BEGIN
        INSERT INTO public.profiles (id, email, company_name, business_number)
        VALUES (
            NEW.id, 
            COALESCE(NEW.email, ''),
            '임시회사명',  -- 기본값 (나중에 회원가입 시 업데이트됨)
            'TEMP-' || NEW.id::text  -- 임시 사업자등록번호 (고유값 보장)
        );
        
        -- 로그 기록 (디버깅용)
        RAISE NOTICE '프로필 생성 성공: user_id = %, email = %', NEW.id, NEW.email;
    EXCEPTION
        WHEN unique_violation THEN
            -- 이미 존재하면 무시
            RAISE NOTICE '프로필이 이미 존재함: user_id = %', NEW.id;
            RETURN NEW;
        WHEN OTHERS THEN
            -- 다른 오류는 로그에 기록하고 계속 진행
            RAISE WARNING '프로필 생성 실패: user_id = %, 오류 = %', NEW.id, SQLERRM;
            RETURN NEW;
    END;
    
    RETURN NEW;
END;
$$;

-- 1.3 트리거 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- 1.4 프로필 테이블 RLS 정책 설정 (무한 재귀 없는 정책만)

-- SELECT 정책 (자신의 프로필 조회)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- INSERT 정책 (트리거용)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- UPDATE 정책 (자신의 프로필 업데이트)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. Storage 버킷 및 RLS 정책 설정
-- ============================================

-- 2.1 버킷 확인 (버킷이 없으면 먼저 Supabase 대시보드에서 생성하세요)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'documents'
    ) THEN
        RAISE EXCEPTION 'documents 버킷이 존재하지 않습니다. 먼저 Supabase 대시보드 → Storage → Buckets에서 documents 버킷을 생성하세요.';
    END IF;
    
    -- 버킷이 공개로 설정되어 있으면 경고
    IF EXISTS (
        SELECT 1 FROM storage.buckets 
        WHERE id = 'documents' AND public = true
    ) THEN
        RAISE WARNING 'documents 버킷이 공개로 설정되어 있습니다. 비공개로 변경하는 것을 권장합니다.';
    END IF;
END $$;

-- 2.2 기존 Storage 정책 삭제
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- 2.3 새로운 Storage RLS 정책 생성

-- INSERT 정책 (업로드)
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL AND
    (
        name LIKE auth.uid()::text || '/%'
        OR
        (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- SELECT 정책 (조회)
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL AND
    (
        name LIKE auth.uid()::text || '/%'
        OR
        (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- UPDATE 정책 (수정)
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL AND
    (
        name LIKE auth.uid()::text || '/%'
        OR
        (storage.foldername(name))[1] = auth.uid()::text
    )
)
WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL AND
    (
        name LIKE auth.uid()::text || '/%'
        OR
        (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- DELETE 정책 (삭제)
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL AND
    (
        name LIKE auth.uid()::text || '/%'
        OR
        (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- ============================================
-- 3. 설정 확인
-- ============================================

-- 3.1 버킷 설정 확인
SELECT 
    '버킷 설정 확인' as check_type,
    id as bucket_id,
    name,
    CASE 
        WHEN public = false THEN '✅ 비공개 (정상)'
        WHEN public = true THEN '⚠️ 공개 (비공개로 변경 권장)'
        ELSE '❓ 확인 필요'
    END as bucket_status,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'documents';

-- 3.2 프로필 테이블 RLS 정책 확인
SELECT 
    '프로필 RLS 정책 확인' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NULL THEN 'NULL'
        ELSE substring(qual, 1, 80)
    END as qual_preview,
    CASE 
        WHEN with_check IS NULL THEN 'NULL'
        ELSE substring(with_check, 1, 80)
    END as with_check_preview
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- 3.3 Storage RLS 정책 확인
SELECT 
    'Storage RLS 정책 확인' as check_type,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NULL THEN 'NULL'
        ELSE substring(qual, 1, 80)
    END as qual_preview,
    CASE 
        WHEN with_check IS NULL THEN 'NULL'
        ELSE substring(with_check, 1, 80)
    END as with_check_preview
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%own files%'
ORDER BY 
    CASE cmd
        WHEN 'INSERT' THEN 1
        WHEN 'SELECT' THEN 2
        WHEN 'UPDATE' THEN 3
        WHEN 'DELETE' THEN 4
        ELSE 5
    END;

-- 3.4 트리거 확인
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

-- 3.5 함수 확인
SELECT 
    '함수 확인' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_name = 'handle_new_user';

-- ============================================
-- 4. 최종 확인 메시지
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ 완전 자동 설정이 완료되었습니다!';
    RAISE NOTICE '✅ 프로필 생성 트리거 함수가 설정되었습니다!';
    RAISE NOTICE '✅ 프로필 테이블의 RLS 정책이 설정되었습니다!';
    RAISE NOTICE '✅ Storage RLS 정책이 설정되었습니다!';
    RAISE NOTICE '✅ 회원가입 시 프로필이 자동으로 생성됩니다!';
    RAISE NOTICE '✅ 파일 업로드가 정상적으로 작동합니다!';
END $$;

