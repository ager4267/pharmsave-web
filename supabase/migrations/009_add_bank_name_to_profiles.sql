-- 은행명 필드 추가
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bank_name TEXT;

COMMENT ON COLUMN public.profiles.bank_name IS '입금 계좌 은행명';

-- 관리자 프로필 업데이트 (주식회사 에스피엠메디칼)
UPDATE public.profiles
SET 
  company_name = '주식회사 에스피엠메디칼',
  bank_name = '국민은행',
  account_number = '029401-00-012562'
WHERE role = 'admin';










