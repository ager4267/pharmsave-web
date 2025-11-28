// TypeScript 타입 정의

export type UserRole = 'user' | 'admin';
export type LicenseVerificationStatus = 'pending' | 'approved' | 'rejected';
export type SalesListStatus = 'pending' | 'approved' | 'rejected';
export type ProductStatus = 'active' | 'sold' | 'inactive';
export type PurchaseRequestStatus = 'pending' | 'confirmed' | 'approved' | 'rejected' | 'cancelled';
export type PurchaseOrderStatus = 'requested' | 'confirmed' | 'approved' | 'rejected' | 'delivered' | 'completed';
export type ResaleStatus = 'preparing' | 'confirmed' | 'shipping' | 'delivered' | 'completed';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type AnalysisPeriod = '3months' | '6months';

export interface Profile {
  id: string;
  email: string;
  company_name: string;
  business_number: string;
  wholesale_license?: string;
  license_verification_status: LicenseVerificationStatus;
  phone_number?: string;
  address?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface SalesListItem {
  product_name: string;
  specification: string;
  manufacturer: string;
  manufacturing_number: string;
  expiry_date: string;
  quantity: number;
  insurance_price?: number;
  selling_price: number;
  discount_rate?: number;
  storage_condition?: string;
  description?: string;
}

export interface SalesList {
  id: string;
  seller_id: string;
  items: SalesListItem[];
  status: SalesListStatus;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  notes?: string;
}

export interface Product {
  id: string;
  sales_list_id?: string;
  seller_id: string;
  product_name: string;
  specification?: string;
  manufacturer?: string;
  manufacturing_number?: string;
  expiry_date?: string;
  quantity: number;
  insurance_price?: number;
  selling_price: number;
  discount_rate?: number;
  storage_condition?: string;
  description?: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequest {
  id: string;
  buyer_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  shipping_address?: string;
  status: PurchaseRequestStatus;
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  purchase_request_id: string;
  seller_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  purchase_price: number;
  commission: number;
  total_amount: number;
  status: PurchaseOrderStatus;
  requested_at: string;
  delivered_at?: string;
  notes?: string;
}

export interface Resale {
  id: string;
  purchase_order_id: string;
  purchase_request_id: string;
  buyer_id: string;
  product_id: string;
  quantity: number;
  selling_price: number;
  total_price: number;
  shipping_address?: string;
  status: ResaleStatus;
  shipped_at?: string;
  delivered_at?: string;
  tracking_number?: string;
}

export interface Payment {
  id: string;
  purchase_request_id?: string;
  purchase_order_id?: string;
  payment_method: string;
  amount: number;
  payment_status: PaymentStatus;
  transaction_id?: string;
  paid_at?: string;
  created_at: string;
}

export interface ExpiringItem {
  product_name: string;
  specification: string;
  manufacturing_number: string;
  expiry_date: string;
  days_remaining: number;
  quantity: number;
  risk_level: 'high' | 'medium' | 'low';
  priority: number;
}

export interface DeadStockItem {
  product_name: string;
  specification: string;
  quantity: number;
  last_sales_date?: string;
  no_sales_period: number;
  dead_stock_status: 'dead_stock' | 'normal';
  priority: number;
}

export interface InventoryAnalysisStatistics {
  total_items: number;
  expiring_count: number;
  expiring_percentage: number;
  dead_stock_count: number;
  dead_stock_percentage: number;
  risk_level_high: number;
  risk_level_medium: number;
  risk_level_low: number;
}

export interface InventoryAnalysis {
  id: string;
  user_id: string;
  analysis_period: AnalysisPeriod;
  expiring_items: ExpiringItem[];
  dead_stock_items: DeadStockItem[];
  statistics: InventoryAnalysisStatistics;
  created_at: string;
}

