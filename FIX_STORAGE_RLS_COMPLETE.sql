-- ============================================
-- Storage RLS 정책 완전 수정 SQL
-- 회원가입 직후 파일 업로드 오류 해결
-- Supabase SQL Editor에 붙여넣어 실행하세요
-- ============================================

-- 1. 기존 정책 완전 삭제
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- 2. 새로운 INSERT 정책 (업로드)
-- 문제 해결: auth.uid()가 null이 아닌 경우만 체크하고, 파일 경로 패턴 검증
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL AND
    (
        -- 방법 1: 파일 경로가 사용자 ID로 시작하는지 확인 (LIKE 패턴 사용)
        name LIKE auth.uid()::text || '/%'
        OR
        -- 방법 2: storage.foldername 함수 사용 (더 정확)
        (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- 3. 새로운 SELECT 정책 (조회)
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

-- 4. 새로운 UPDATE 정책 (수정)
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

-- 5. 새로운 DELETE 정책 (삭제)
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

-- 6. 정책 확인 (정상적으로 생성되었는지 확인)
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN qual IS NULL THEN 'NULL'
        ELSE substring(qual, 1, 100) || '...'
    END as qual_preview,
    CASE 
        WHEN with_check IS NULL THEN 'NULL'
        ELSE substring(with_check, 1, 100) || '...'
    END as with_check_preview
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%own files%'
ORDER BY cmd;

-- 7. 정책 상세 확인 (전체 조건 확인)
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%own files%'
ORDER BY cmd;

