-- 판매자가 자신의 상품에 대한 구매 요청을 조회할 수 있도록 RLS 정책 추가
-- 생성일: 2024년

-- Purchase Requests: 판매자는 자신의 상품에 대한 구매 요청을 조회 가능
CREATE POLICY "Sellers can view purchase requests for their products" ON public.purchase_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.products
            WHERE products.id = purchase_requests.product_id
            AND products.seller_id = auth.uid()
        )
    );

