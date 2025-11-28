-- 팜세이브 (PharmSave) 초기 스키마
-- 생성일: 2024년

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles 테이블 (사용자 프로필)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    company_name TEXT NOT NULL,
    business_number TEXT UNIQUE NOT NULL,
    wholesale_license TEXT,
    license_verification_status TEXT DEFAULT 'pending' CHECK (license_verification_status IN ('pending', 'approved', 'rejected')),
    phone_number TEXT,
    address TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'seller', 'buyer', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Lists 테이블 (판매 리스트)
CREATE TABLE public.sales_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    items JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES public.profiles(id),
    notes TEXT
);

-- Products 테이블 (상품)
CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sales_list_id UUID REFERENCES public.sales_lists(id),
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    product_name TEXT NOT NULL,
    specification TEXT,
    manufacturer TEXT,
    manufacturing_number TEXT,
    expiry_date DATE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    insurance_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price > 0),
    discount_rate DECIMAL(5, 2),
    storage_condition TEXT,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Requests 테이블 (구매 요청)
CREATE TABLE public.purchase_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0),
    total_price DECIMAL(10, 2) NOT NULL CHECK (total_price > 0),
    shipping_address TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'approved', 'rejected', 'cancelled')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES public.profiles(id),
    notes TEXT
);

-- Purchase Orders 테이블 (매입 요청)
CREATE TABLE public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_request_id UUID REFERENCES public.purchase_requests(id) NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    purchase_price DECIMAL(10, 2) NOT NULL CHECK (purchase_price > 0),
    commission DECIMAL(10, 2) NOT NULL CHECK (commission >= 0),
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount > 0),
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'approved', 'rejected', 'delivered', 'completed')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Resales 테이블 (재판매)
CREATE TABLE public.resales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) NOT NULL,
    purchase_request_id UUID REFERENCES public.purchase_requests(id) NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price > 0),
    total_price DECIMAL(10, 2) NOT NULL CHECK (total_price > 0),
    shipping_address TEXT,
    status TEXT DEFAULT 'preparing' CHECK (status IN ('preparing', 'confirmed', 'shipping', 'delivered', 'completed')),
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    tracking_number TEXT
);

-- Payments 테이블 (결제)
CREATE TABLE public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_request_id UUID REFERENCES public.purchase_requests(id),
    purchase_order_id UUID REFERENCES public.purchase_orders(id),
    payment_method TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_id TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory Analyses 테이블 (재고 분석)
CREATE TABLE public.inventory_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    analysis_period TEXT NOT NULL CHECK (analysis_period IN ('3months', '6months')),
    expiring_items JSONB,
    dead_stock_items JSONB,
    statistics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_business_number ON public.profiles(business_number);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_license_status ON public.profiles(license_verification_status);

CREATE INDEX idx_sales_lists_seller_id ON public.sales_lists(seller_id);
CREATE INDEX idx_sales_lists_status ON public.sales_lists(status);
CREATE INDEX idx_sales_lists_submitted_at ON public.sales_lists(submitted_at);

CREATE INDEX idx_products_seller_id ON public.products(seller_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_expiry_date ON public.products(expiry_date);
CREATE INDEX idx_products_product_name ON public.products(product_name);

CREATE INDEX idx_purchase_requests_buyer_id ON public.purchase_requests(buyer_id);
CREATE INDEX idx_purchase_requests_product_id ON public.purchase_requests(product_id);
CREATE INDEX idx_purchase_requests_status ON public.purchase_requests(status);

CREATE INDEX idx_purchase_orders_seller_id ON public.purchase_orders(seller_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);

CREATE INDEX idx_resales_buyer_id ON public.resales(buyer_id);
CREATE INDEX idx_resales_status ON public.resales(status);

CREATE INDEX idx_payments_purchase_request_id ON public.payments(purchase_request_id);
CREATE INDEX idx_payments_payment_status ON public.payments(payment_status);

CREATE INDEX idx_inventory_analyses_user_id ON public.inventory_analyses(user_id);
CREATE INDEX idx_inventory_analyses_created_at ON public.inventory_analyses(created_at);

-- Row Level Security (RLS) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_analyses ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (기본 정책 - 나중에 세부 조정 필요)
-- Profiles: 사용자는 자신의 프로필만 조회/수정 가능
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 관리자는 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Sales Lists: 판매자는 자신의 판매 리스트만 조회 가능
CREATE POLICY "Sellers can view own sales lists" ON public.sales_lists
    FOR SELECT USING (
        seller_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Sellers can insert own sales lists" ON public.sales_lists
    FOR INSERT WITH CHECK (seller_id = auth.uid());

-- Products: 모든 사용자가 조회 가능, 관리자만 수정 가능
CREATE POLICY "Anyone can view active products" ON public.products
    FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage products" ON public.products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Purchase Requests: 구매자는 자신의 구매 요청만 조회 가능
CREATE POLICY "Buyers can view own purchase requests" ON public.purchase_requests
    FOR SELECT USING (
        buyer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Buyers can insert own purchase requests" ON public.purchase_requests
    FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Inventory Analyses: 사용자는 자신의 분석 결과만 조회 가능
CREATE POLICY "Users can view own inventory analyses" ON public.inventory_analyses
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can insert own inventory analyses" ON public.inventory_analyses
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 함수: 프로필 자동 생성 (회원가입 시)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거: 새 사용자 생성 시 프로필 자동 생성
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: updated_at 자동 업데이트
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

