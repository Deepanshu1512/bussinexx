export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  business_id: number;
  phone?: string;
  store_id?: number;
  email_verified?: number;
}

export interface Business {
  id: number;
  name: string;
  currency_symbol?: string;
  currency_code?: string;
  tax_rate?: number;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface Store {
  id: number;
  business_id: number;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  is_primary: number;
  status: 'active' | 'inactive';
  created_at: string;
  product_count?: number;
  total_units?: number;
}

export interface StockTransfer {
  id: number;
  business_id: number;
  source_store_id: number;
  source_store_name?: string;
  destination_store_id: number;
  destination_store_name?: string;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  status: string;
  notes?: string;
  created_by?: number;
  creator_name?: string;
  created_at: string;
}

export interface StockLog {
  id: number;
  business_id: number;
  store_id?: number;
  store_name?: string;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  change_qty: number;
  new_stock: number;
  reason: string;
  reference_id?: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  business: Business;
  email_verified?: boolean;
}

export interface Product {
  id: number;
  sku: string;
  barcode?: string;
  name: string;
  category_id: number | null;
  category_name?: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  store_stock?: number;
  store_id?: number;
  min_stock_threshold: number;
  status: 'active' | 'draft' | 'archived';
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  product_count?: number;
}

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tier: 'vip' | 'regular' | 'wholesale' | 'new' | 'enterprise';
  address?: string | null;
  notes?: string | null;
  total_orders?: number;
  orders_count?: number;
  total_spent?: number;
  avg_order_value?: number;
  last_order_date?: string | null;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  unit_cost: number;
  unit_price: number;
  quantity: number;
  line_total: number;
  current_stock?: number;
}

export interface Order {
  id: number;
  order_number: string;
  store_id?: number | null;
  store_name?: string | null;
  store_code?: string | null;
  customer_id: number | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_company?: string | null;
  customer_address?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  payment_method: 'card' | 'bank_transfer' | 'cash' | 'invoice' | 'credit';
  payment_status: 'paid' | 'pending' | 'refunded';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  item_count?: number;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface ExecutiveSummary {
  grossRevenue: number;
  cogs: number;
  netProfit: number;
  profitMargin: number;
  totalOrders: number;
  avgOrderValue: number;
  totalDiscounts: number;
  totalTax: number;
  totalCustomers: number;
  activeCustomers: number;
  totalProducts: number;
  totalUnitsInStock: number;
  inventoryCostValue: number;
  inventoryRetailValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  product_id: number;
  product_name: string;
  product_sku: string;
  units_sold: number;
  total_revenue: number;
  gross_profit: number;
  current_stock: number;
  min_stock_threshold: number;
  category_name?: string;
}

export interface CategoryStat {
  id: number;
  name: string;
  product_count: number;
  units_sold: number;
  total_revenue: number;
}

export interface TopCustomer {
  id: number;
  name: string;
  company: string | null;
  tier: string;
  total_orders: number;
  lifetime_value: number;
  last_order: string;
}

export interface InventoryHealth {
  totalProducts: number;
  optimalCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValueCost: number;
  totalStockValueRetail: number;
  potentialProfit: number;
}

export interface BrainConversation {
  id: string;
  title: string;
  message_count?: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BrainMessage {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metrics_context?: string;
  created_at: string;
}

export interface AppSettings {
  business_name?: string;
  currency_symbol?: string;
  tax_rate?: string;
  contact_email?: string;
  business_address?: string;
  ai_provider?: string;
  ai_model?: string;
  ai_api_key?: string;
  ai_base_url?: string;
  has_custom_api_key?: string;
  ai_temperature?: string;
}
