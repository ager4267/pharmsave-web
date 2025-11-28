-- 역할 개념 변경: 관리자 외 모든 사용자는 판매자이면서 구매자
-- seller와 buyer role을 제거하고 user로 통합

-- 기존 seller/buyer role을 user로 변경
UPDATE public.profiles 
SET role = 'user' 
WHERE role IN ('seller', 'buyer');

-- role 제약조건 수정
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('user', 'admin'));

