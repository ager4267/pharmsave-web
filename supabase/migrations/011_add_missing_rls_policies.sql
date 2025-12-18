-- 누락된 RLS 정책 추가
-- 생성일: 2024년
-- payments, purchase_orders, resales 테이블에 RLS 정책 추가

-- payments 테이블 RLS 정책
-- 사용자는 자신의 결제 내역만 조회 가능 (구매 요청 또는 구매 주문을 통해)
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.purchase_requests pr
            WHERE pr.id = payments.purchase_request_id AND pr.buyer_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.purchase_orders po
            WHERE po.id = payments.purchase_order_id AND po.seller_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 관리자는 모든 결제 내역 관리 가능
CREATE POLICY "Admins can manage all payments" ON public.payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- purchase_orders 테이블 RLS 정책
-- 판매자는 자신의 구매 주문만 조회 가능
CREATE POLICY "Sellers can view own purchase orders" ON public.purchase_orders
    FOR SELECT USING (
        seller_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.purchase_requests pr
            WHERE pr.id = purchase_orders.purchase_request_id AND pr.buyer_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 관리자는 모든 구매 주문 관리 가능
CREATE POLICY "Admins can manage all purchase orders" ON public.purchase_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- resales 테이블 RLS 정책
-- 구매자는 자신의 재판매 내역만 조회 가능
CREATE POLICY "Buyers can view own resales" ON public.resales
    FOR SELECT USING (
        buyer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 구매자는 자신의 재판매 내역만 생성 가능
CREATE POLICY "Buyers can insert own resales" ON public.resales
    FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- 관리자는 모든 재판매 내역 관리 가능
CREATE POLICY "Admins can manage all resales" ON public.resales
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );



