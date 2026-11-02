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
  loyalty_points?: number;
  outstanding_balance?: number;
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

// ==========================================
// EXPANSION MODULE TYPES
// ==========================================

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  employee_count?: number;
}

export interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_mins: number;
  is_night_shift: boolean | number;
}

export interface Employee {
  id: number;
  employee_code: string;
  store_id: number | null;
  store_name?: string | null;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone: string;
  address?: string | null;
  department_id: number | null;
  department_name?: string | null;
  designation: string;
  joining_date: string;
  employment_status: 'active' | 'probation' | 'notice_period' | 'terminated' | 'resigned';
  shift_id: number | null;
  shift_name?: string | null;
  base_salary: number;
  hourly_rate: number;
  payment_method: 'bank_transfer' | 'cash' | 'upi' | 'cheque';
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  pan_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Attendance {
  id: number;
  employee_id: number;
  employee_code?: string;
  employee_name?: string;
  department_name?: string;
  store_id: number | null;
  store_name?: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: 'present' | 'absent' | 'half_day' | 'on_leave' | 'holiday' | 'weekend';
  late_minutes: number;
  overtime_hours: number;
  total_working_hours: number;
  notes?: string | null;
  is_manually_corrected?: boolean | number;
  corrected_by?: number | null;
  correction_reason?: string | null;
  corrected_at?: string | null;
  created_at: string;
}

export interface LeaveBalance {
  id?: number;
  employee_id: number;
  year: number;
  casual_leave_total: number;
  casual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  paid_leave_total: number;
  paid_leave_used: number;
  unpaid_leave_used: number;
}

export interface LeaveApplication {
  id: number;
  employee_id: number;
  employee_code?: string;
  employee_name?: string;
  department_name?: string;
  store_id?: number | null;
  leave_type: 'casual' | 'sick' | 'paid' | 'unpaid';
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  manager_remarks?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface Payroll {
  id: number;
  store_id: number | null;
  store_name?: string | null;
  month: number;
  year: number;
  total_gross_salary: number;
  total_deductions: number;
  total_net_salary: number;
  status: 'draft' | 'approved' | 'paid';
  payment_date?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  employee_count?: number;
  created_at: string;
  items?: PayrollItem[];
}

export interface PayrollItem {
  id: number;
  payroll_id: number;
  employee_id: number;
  employee_code?: string;
  employee_name?: string;
  designation?: string;
  department_name?: string;
  payment_method?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  base_salary: number;
  present_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  absent_days: number;
  overtime_hours: number;
  overtime_pay: number;
  bonus: number;
  allowances: number;
  deductions: number;
  advance_deduction: number;
  gross_earnings: number;
  net_salary: number;
  status: 'draft' | 'approved' | 'paid';
  payment_date?: string | null;
  payment_reference?: string | null;
  created_at: string;
}

export interface SalarySlip {
  payroll_item_id: number;
  employee_id: number;
  employee_code: string;
  employee_name: string;
  email: string;
  designation: string;
  department: string;
  joining_date: string;
  pan_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  month: number;
  year: number;
  period_label: string;
  store_name: string;
  base_salary: number;
  present_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  absent_days: number;
  overtime_hours: number;
  overtime_pay: number;
  bonus: number;
  allowances: number;
  gross_earnings: number;
  deductions: number;
  advance_deduction: number;
  total_deductions: number;
  net_salary: number;
  status: string;
  payment_date: string | null;
  payment_reference: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  gstin?: string | null;
  payment_terms?: string | null;
  lead_time_days?: number;
  notes?: string | null;
  is_active: boolean | number;
  total_orders_count?: number;
  total_purchased_amount?: number;
  outstanding_balance?: number;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name?: string;
  supplier_email?: string;
  supplier_phone?: string;
  store_id: number;
  store_name?: string;
  order_date: string;
  expected_delivery_date?: string | null;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total_amount: number;
  payment_status: 'unpaid' | 'partially_paid' | 'paid';
  paid_amount: number;
  payment_method?: string | null;
  notes?: string | null;
  created_at: string;
  items?: PurchaseOrderItem[];
}

export interface ExpenseCategory {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_system: boolean | number;
}

export interface Expense {
  id: number;
  store_id: number | null;
  store_name?: string | null;
  category_id: number;
  category_name?: string;
  category_code?: string;
  title: string;
  description?: string | null;
  amount: number;
  expense_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'upi' | 'card' | 'cheque';
  payment_status: 'paid' | 'pending';
  vendor_name?: string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  receipt_url?: string | null;
  created_at: string;
}

export interface FinancialOverview {
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
  profit_margin_pct: number;
  accounts_payable: number;
  accounts_receivable: number;
  cash_flow: {
    total_inflows: number;
    total_outflows: number;
    net_cash_flow: number;
  };
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  module: 'inventory' | 'attendance' | 'leaves' | 'payroll' | 'suppliers' | 'system' | 'orders';
  reference_id?: number | null;
  is_read: boolean | number;
  created_at: string;
}
