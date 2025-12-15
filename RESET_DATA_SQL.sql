-- 팜세이브 테스트 데이터 초기화 SQL
-- ⚠️ 주의: 이 쿼리는 모든 테스트 데이터를 삭제합니다!
-- 관리자 계정은 보존됩니다.
-- 실행 전에 반드시 백업을 수행하세요!

BEGIN;

-- 1. 판매 승인 보고서 삭제
DELETE FROM public.sales_approval_reports;

-- 2. 구매 주문 삭제
DELETE FROM public.purchase_orders;

-- 3. 구매 요청 삭제
DELETE FROM public.purchase_requests;

-- 4. 상품 삭제
DELETE FROM public.products;

-- 5. 판매 목록 삭제
DELETE FROM public.sales_lists;

-- 6. 포인트 충전 요청 삭제 (관리자 제외)
DELETE FROM public.point_charge_requests
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 7. 포인트 거래 내역 삭제 (관리자 제외)
DELETE FROM public.point_transactions
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 8. 포인트 잔액 삭제 (관리자 제외)
DELETE FROM public.points
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 9. 재판매 삭제 (관리자 제외)
DELETE FROM public.resales
WHERE buyer_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 10. 결제 삭제 (관련 purchase_request 또는 purchase_order가 관리자와 관련 없는 경우)
DELETE FROM public.payments
WHERE purchase_request_id IN (
  SELECT id FROM public.purchase_requests WHERE buyer_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
)
OR purchase_order_id IN (
  SELECT id FROM public.purchase_orders WHERE seller_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  )
);

-- 11. 재고 분석 삭제 (관리자 제외)
DELETE FROM public.inventory_analyses
WHERE user_id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 12. 사용자 삭제 (관리자 제외)
-- ⚠️ 중요: profiles를 먼저 삭제해야 합니다 (profiles가 auth.users를 참조하므로)
-- profiles에서 먼저 삭제
DELETE FROM public.profiles
WHERE role != 'admin';

-- 그 다음 auth.users에서 삭제
DELETE FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
);

COMMIT;

-- 초기화 완료 메시지
SELECT 
  '데이터 초기화가 완료되었습니다.' AS message,
  (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') AS admin_count,
  (SELECT COUNT(*) FROM public.profiles) AS total_profiles;

