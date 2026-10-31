export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  business_id: number;
}

export interface Business {
  id: number;
  name: string;
  currency_symbol?: string;
  tax_rate?: number;
  contact_email?: string;
  address?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  business: Business;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category_name?: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
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
  tier: 'vip' | 'regular' | 'wholesale' | 'new';
  address: string | null;
  notes: string | null;
  total_orders?: number;
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
  has_custom_api_key?: string;
  ai_temperature?: string;
}
