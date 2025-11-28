-- 팜세이브 (PharmSave) 테스트 데이터 초기화 스크립트
-- 관리자 계정을 제외한 모든 사용자 데이터 및 관련 데이터를 삭제합니다.
-- 주의: 이 스크립트는 프로덕션 환경에서 사용하면 안 됩니다!

-- ============================================
-- 1. 관리자 ID 목록 조회 (참고용)
-- ============================================
-- SELECT id, email, company_name, role 
-- FROM public.profiles 
-- WHERE role = 'admin';

-- ============================================
-- 2. 외래키 제약조건을 고려한 역순 삭제
-- ============================================

-- 2-1. 포인트 충전 요청 삭제 (관리자 제외)
DELETE FROM public.point_charge_requests
WHERE user_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-2. 포인트 거래 내역 삭제 (관리자 제외)
DELETE FROM public.point_transactions
WHERE user_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-3. 포인트 잔액 삭제 (관리자 제외)
DELETE FROM public.points
WHERE user_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-4. 판매 승인 보고서 삭제 (관리자 제외 - seller_id 또는 buyer_id가 관리자가 아닌 경우)
DELETE FROM public.sales_approval_reports
WHERE seller_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
)
OR buyer_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-5. 재판매 데이터 삭제 (관리자 제외)
DELETE FROM public.resales
WHERE buyer_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-6. 결제 데이터 삭제 (관리자 제외 - purchase_request_id가 관리자와 관련 없는 경우)
DELETE FROM public.payments
WHERE purchase_request_id IN (
    SELECT id FROM public.purchase_requests
    WHERE buyer_id NOT IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
)
OR purchase_order_id IN (
    SELECT id FROM public.purchase_orders
    WHERE seller_id NOT IN (
        SELECT id FROM public.profiles WHERE role = 'admin'
    )
);

-- 2-7. 매입 요청 삭제 (관리자 제외)
DELETE FROM public.purchase_orders
WHERE seller_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-8. 구매 요청 삭제 (관리자 제외)
DELETE FROM public.purchase_requests
WHERE buyer_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-9. 상품 삭제 (관리자 제외)
DELETE FROM public.products
WHERE seller_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-10. 판매 리스트 삭제 (관리자 제외)
DELETE FROM public.sales_lists
WHERE seller_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- 2-11. 재고 분석 삭제 (관리자 제외)
DELETE FROM public.inventory_analyses
WHERE user_id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
);

-- ============================================
-- 3. 사용자 프로필 삭제 (관리자 제외)
-- ============================================
DELETE FROM public.profiles
WHERE role != 'admin';

-- ============================================
-- 4. Supabase Auth 사용자 삭제 (관리자 제외)
-- 주의: 이 작업은 Supabase Dashboard에서 직접 수행하거나
--       Service Role을 사용하여 API로 수행해야 합니다.
-- ============================================
-- 아래 쿼리는 참고용이며, 실제로는 Supabase Admin API를 사용해야 합니다.
-- 
-- DELETE FROM auth.users
-- WHERE id NOT IN (
--     SELECT id FROM public.profiles WHERE role = 'admin'
-- );

-- ============================================
-- 5. 초기화 완료 확인 쿼리
-- ============================================
-- SELECT 
--     (SELECT COUNT(*) FROM public.profiles WHERE role != 'admin') as non_admin_profiles,
--     (SELECT COUNT(*) FROM public.sales_lists) as sales_lists_count,
--     (SELECT COUNT(*) FROM public.products) as products_count,
--     (SELECT COUNT(*) FROM public.purchase_requests) as purchase_requests_count,
--     (SELECT COUNT(*) FROM public.points WHERE user_id NOT IN (SELECT id FROM public.profiles WHERE role = 'admin')) as non_admin_points,
--     (SELECT COUNT(*) FROM public.inventory_analyses) as inventory_analyses_count;

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '테스트 데이터 초기화가 완료되었습니다.';
    RAISE NOTICE '관리자 계정은 유지되었습니다.';
    RAISE NOTICE 'Supabase Auth 사용자 삭제는 별도로 수행해야 합니다.';
END $$;



