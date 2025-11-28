-- 판매 승인 보고서 테이블
CREATE TABLE IF NOT EXISTS public.sales_approval_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_request_id UUID REFERENCES public.purchase_requests(id) NOT NULL,
    purchase_order_id UUID REFERENCES public.purchase_orders(id),
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0),
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount > 0),
    commission DECIMAL(10, 2) NOT NULL CHECK (commission >= 0),
    seller_amount DECIMAL(10, 2) NOT NULL CHECK (seller_amount > 0),
    report_number TEXT UNIQUE NOT NULL, -- 보고서 번호 (예: SAR-2024-001)
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'sent', 'confirmed', 'shipped', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    shipping_address TEXT,
    tracking_number TEXT
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sales_approval_reports_seller_id ON public.sales_approval_reports(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_approval_reports_buyer_id ON public.sales_approval_reports(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sales_approval_reports_purchase_request_id ON public.sales_approval_reports(purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_sales_approval_reports_status ON public.sales_approval_reports(status);
CREATE INDEX IF NOT EXISTS idx_sales_approval_reports_report_number ON public.sales_approval_reports(report_number);

-- RLS 정책 (관리자는 모든 보고서 조회 가능, 판매자는 자신의 보고서만 조회 가능)
ALTER TABLE public.sales_approval_reports ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 보고서 조회 가능
CREATE POLICY "관리자는 모든 판매 승인 보고서 조회 가능"
    ON public.sales_approval_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 판매자는 자신의 보고서만 조회 가능
CREATE POLICY "판매자는 자신의 판매 승인 보고서 조회 가능"
    ON public.sales_approval_reports
    FOR SELECT
    USING (
        seller_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 보고서 번호 생성 함수
CREATE OR REPLACE FUNCTION generate_report_number()
RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    sequence_num INTEGER;
    report_num TEXT;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    
    -- 올해 생성된 보고서 수를 확인하여 시퀀스 번호 생성
    SELECT COALESCE(MAX(CAST(SUBSTRING(report_number FROM 9) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM public.sales_approval_reports
    WHERE report_number LIKE 'SAR-' || year_part || '-%';
    
    report_num := 'SAR-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN report_num;
END;
$$ LANGUAGE plpgsql;

