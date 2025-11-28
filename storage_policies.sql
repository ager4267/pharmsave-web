-- Storage 버킷 정책 설정
-- 이 파일의 내용을 Supabase SQL Editor에 붙여넣어 실행하세요

-- 사용자는 자신의 파일만 업로드 가능
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 사용자는 자신의 파일만 조회 가능
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

