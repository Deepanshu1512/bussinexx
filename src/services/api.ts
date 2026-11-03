import { 
  Product, Category, Customer, Order, ExecutiveSummary, 
  RevenuePoint, TopProduct, CategoryStat, TopCustomer, 
  InventoryHealth, BrainConversation, BrainMessage, AppSettings,
  AuthResponse, User, Business, Store, StockTransfer, StockLog,
  Department, Shift, Employee, Attendance, LeaveBalance, LeaveApplication,
  Payroll, PayrollItem, SalarySlip, Supplier, PurchaseOrder, PurchaseOrderItem,
  ExpenseCategory, Expense, FinancialOverview, NotificationItem
} from '../types';

// Properly configured API Base URL: Uses VITE_API_URL if defined, otherwise defaults to relative /api
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const tokenStorage = {
  get: () => localStorage.getItem('bussinex_token'),
  set: (token: string) => localStorage.setItem('bussinex_token', token),
  clear: () => localStorage.removeItem('bussinex_token'),
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const token = tokenStorage.get();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // If unauthorized and not an auth endpoint, dispatch logout event
    if (response.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register') && !endpoint.startsWith('/auth/demo-login')) {
      tokenStorage.clear();
      window.dispatchEvent(new Event('bussinex-logout'));
    }

    let errorMsg = 'Unable to complete your request. Please try again.';
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errJson.message || errorMsg;
    } catch {
      // Keep friendly business error
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Authentication & Security
  auth: {
    async login(email: string, password: string, rememberMe: boolean = true): Promise<AuthResponse> {
      const res = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, rememberMe }),
      });
      tokenStorage.set(res.token);
      return res;
    },

    async demoLogin(): Promise<AuthResponse> {
      const res = await request<AuthResponse>('/auth/demo-login', {
        method: 'POST',
      });
      tokenStorage.set(res.token);
      return res;
    },

    async register(data: {
      name: string;
      email: string;
      password: string;
      confirmPassword?: string;
      phone: string;
      businessName: string;
      businessType?: string;
      businessEmail?: string;
      businessPhone?: string;
      businessAddress: string;
      city: string;
      state: string;
      pincode: string;
    }): Promise<AuthResponse> {
      const res = await request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      tokenStorage.set(res.token);
      return res;
    },

    async verifyEmail(email: string, otp: string): Promise<{ success: boolean; message: string; user?: User }> {
      return await request<{ success: boolean; message: string; user?: User }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() })
      });
    },

    async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
      return await request<{ success: boolean; message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
    },

    async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
      return await request<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
    },

    async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
      return await request<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), new_password: newPassword })
      });
    },

    async getMe(): Promise<{ user: User; business: Business }> {
      return await request<{ user: User; business: Business }>('/auth/me');
    },

    async logout() {
      try {
        await request('/auth/logout', { method: 'POST' });
      } catch {
        // Silently clear local session if server is offline
      } finally {
        tokenStorage.clear();
        window.dispatchEvent(new Event('bussinex-logout'));
      }
    },

    isAuthenticated(): boolean {
      return Boolean(tokenStorage.get());
    }
  },

  // Multi-Store Management
  stores: {
    async getStores(): Promise<Store[]> {
      return await request<Store[]>('/stores');
    },

    async getStore(id: number): Promise<Store> {
      return await request<Store>(`/stores/${id}`);
    },

    async createStore(data: Partial<Store>): Promise<Store> {
      return await request<Store>('/stores', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async updateStore(id: number, data: Partial<Store>): Promise<Store> {
      return await request<Store>(`/stores/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async deleteStore(id: number): Promise<{ success: boolean; message: string }> {
      return await request<{ success: boolean; message: string }>(`/stores/${id}`, {
        method: 'DELETE'
      });
    },

    async transferStock(data: {
      source_store_id: number;
      destination_store_id: number;
      product_id: number;
      quantity: number;
      notes?: string;
    }): Promise<StockTransfer> {
      return await request<StockTransfer>('/stores/transfer', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async getTransfers(): Promise<StockTransfer[]> {
      return await request<StockTransfer[]>('/stores/transfers');
    }
  },

  // Dashboard
  async getDashboard(storeId?: number) {
    const q = storeId ? `?store_id=${storeId}` : '';
    return await request<{
      summary: ExecutiveSummary;
      revenueTimeline: RevenuePoint[];
      topProducts: TopProduct[];
      categoryStats: CategoryStat[];
      recentOrders: Order[];
      inventoryHealth: InventoryHealth;
    }>(`/dashboard${q}`);
  },

  // Inventory
  async getProducts(filters: { search?: string; category_id?: number; status?: string; low_stock?: boolean; store_id?: number } = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category_id) params.append('category_id', String(filters.category_id));
    if (filters.status) params.append('status', filters.status);
    if (filters.low_stock) params.append('low_stock', 'true');
    if (filters.store_id) params.append('store_id', String(filters.store_id));
    const q = params.toString() ? `?${params.toString()}` : '';
    return await request<Product[]>(`/inventory${q}`);
  },

  async getProduct(id: number) {
    return await request<Product>(`/inventory/${id}`);
  },

  async createProduct(data: Partial<Product>) {
    return await request<Product>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProduct(id: number, data: Partial<Product>) {
    return await request<Product>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProduct(id: number) {
    return await request<{ success: boolean; message: string }>(`/inventory/${id}`, {
      method: 'DELETE'
    });
  },

  async adjustStock(productId: number, changeQty: number, reason: string, storeId?: number) {
    return await request<{ success: boolean; productId: number; previousStock: number; newStock: number }>(`/inventory/${productId}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ change_qty: changeQty, reason, store_id: storeId })
    });
  },

  async getCategories() {
    return await request<Category[]>('/inventory/categories');
  },

  async createCategory(name: string, description?: string) {
    return await request<Category>('/inventory/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  },

  async getStockLogs(storeId?: number, productId?: number): Promise<StockLog[]> {
    const params = new URLSearchParams();
    if (storeId) params.append('store_id', String(storeId));
    if (productId) params.append('product_id', String(productId));
    const q = params.toString() ? `?${params.toString()}` : '';
    return await request<StockLog[]>(`/inventory/logs${q}`);
  },

  async exportProductsCSV(storeId?: number): Promise<string> {
    const q = storeId ? `?store_id=${storeId}` : '';
    const url = `${BASE_URL}/inventory/export-csv${q}`;
    const token = tokenStorage.get();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Failed to export inventory CSV');
    return await res.text();
  },

  async importProductsCSV(csvContent: string, storeId?: number): Promise<{ importedCount: number; errors: string[] }> {
    return await request<{ importedCount: number; errors: string[] }>('/inventory/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csvContent, store_id: storeId })
    });
  },

  // Orders
  async getOrders(filters: { search?: string; status?: string; customer_id?: number; store_id?: number } = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.customer_id) params.append('customer_id', String(filters.customer_id));
    if (filters.store_id) params.append('store_id', String(filters.store_id));
    const q = params.toString() ? `?${params.toString()}` : '';
    return await request<Order[]>(`/orders${q}`);
  },

  async getOrder(id: number) {
    return await request<Order>(`/orders/${id}`);
  },

  async createOrder(data: {
    customer_id?: number | null;
    store_id?: number | null;
    items: { product_id: number; quantity: number; unit_price?: number }[];
    payment_method?: string;
    status?: string;
    discount_amount?: number;
    notes?: string;
  }) {
    return await request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateOrderStatus(id: number, status: string) {
    return await request<Order>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Customers
  async getCustomers(search?: string, tier?: string) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tier) params.append('tier', tier);
    const q = params.toString() ? `?${params.toString()}` : '';
    return await request<Customer[]>(`/customers${q}`);
  },

  async getCustomer(id: number) {
    return await request<Customer & { orders: Order[] }>(`/customers/${id}`);
  },

  async createCustomer(data: Partial<Customer>) {
    return await request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCustomer(id: number, data: Partial<Customer>) {
    return await request<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteCustomer(id: number) {
    return await request<{ success: boolean; message: string }>(`/customers/${id}`, {
      method: 'DELETE'
    });
  },

  // Analytics
  async getAnalyticsSummary(storeId?: number) {
    const q = storeId ? `?store_id=${storeId}` : '';
    return await request<ExecutiveSummary>(`/analytics/summary${q}`);
  },

  async getRevenueTimeline(days: number = 30, storeId?: number) {
    const params = new URLSearchParams();
    params.append('days', String(days));
    if (storeId) params.append('store_id', String(storeId));
    return await request<RevenuePoint[]>(`/analytics/timeline?${params.toString()}`);
  },

  async getTopProducts(limit: number = 8, storeId?: number) {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (storeId) params.append('store_id', String(storeId));
    return await request<TopProduct[]>(`/analytics/top-products?${params.toString()}`);
  },

  async getCategoryStats(storeId?: number) {
    const q = storeId ? `?store_id=${storeId}` : '';
    return await request<CategoryStat[]>(`/analytics/categories${q}`);
  },

  async getTopCustomers(limit: number = 8, storeId?: number) {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (storeId) params.append('store_id', String(storeId));
    return await request<TopCustomer[]>(`/analytics/top-customers?${params.toString()}`);
  },

  async getExecutiveReport(storeId?: number) {
    const q = storeId ? `?store_id=${storeId}` : '';
    return await request<any>(`/analytics/report${q}`);
  },

  // Business Brain AI
  async getBrainConversations() {
    return await request<BrainConversation[]>('/brain/conversations');
  },

  async getBrainMessages(conversationId: string) {
    return await request<BrainMessage[]>(`/brain/conversations/${conversationId}`);
  },

  async deleteBrainConversation(conversationId: string) {
    return await request<{ success: boolean }>(`/brain/conversations/${conversationId}`, {
      method: 'DELETE'
    });
  },

  async askBusinessBrain(prompt: string, conversationId?: string | null) {
    return await request<{
      conversationId: string;
      response: string;
      metrics: any;
      providerUsed: string;
    }>('/brain/query', {
      method: 'POST',
      body: JSON.stringify({ prompt, conversationId })
    });
  },

  async getBrainContext() {
    return await request<any>('/brain/context');
  },

  // Settings
  async getSettings() {
    return await request<AppSettings>('/settings');
  },

  async updateSettings(settings: Partial<AppSettings>) {
    return await request<{ success: boolean; message: string }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  async testAIConnection(apiKey?: string, model?: string, provider?: string, baseUrl?: string) {
    return await request<{ success: boolean; message: string }>('/settings/test-ai', {
      method: 'POST',
      body: JSON.stringify({ apiKey, model, provider, baseUrl })
    });
  },

  async seedDemoData() {
    return await request<{ success: boolean; message: string }>('/settings/seed', {
      method: 'POST'
    });
  },

  async resetDatabase() {
    return await request<{ success: boolean; message: string }>('/settings/reset', {
      method: 'POST'
    });
  },

  // ==========================================
  // EXPANSION MODULES
  // ==========================================

  // 1. Employees Management
  employees: {
    async list(filters?: { storeId?: number; departmentId?: number; status?: string; search?: string }) {
      const params = new URLSearchParams();
      if (filters?.storeId) {
        params.append('store_id', String(filters.storeId));
        params.append('storeId', String(filters.storeId));
      }
      if (filters?.departmentId) {
        params.append('department_id', String(filters.departmentId));
        params.append('departmentId', String(filters.departmentId));
      }
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<Employee[]>(`/employees${query}`);
    },

    async get(id: number) {
      return await request<Employee>(`/employees/${id}`);
    },

    async create(data: Partial<Employee> & {
      first_name?: string;
      last_name?: string;
      employee_code?: string;
      basic_salary?: number;
    }) {
      return await request<Employee>('/employees', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async update(id: number, data: Partial<Employee> & {
      first_name?: string;
      last_name?: string;
      basic_salary?: number;
    }) {
      return await request<Employee>(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async delete(id: number) {
      return await request<{ success: boolean; message: string }>(`/employees/${id}`, {
        method: 'DELETE'
      });
    },

    async getDepartments() {
      return await request<Department[]>('/employees/departments');
    },

    async createDepartment(data: { name: string; code?: string; description?: string }) {
      return await request<Department>('/employees/departments', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async getShifts() {
      return await request<Shift[]>('/employees/shifts');
    },

    async getStats(storeId?: number) {
      const query = storeId ? `?store_id=${storeId}&storeId=${storeId}` : '';
      return await request<{
        total_employees: number;
        active_employees: number;
        probation_employees: number;
        monthly_payroll_estimate: number;
      }>(`/employees/stats${query}`);
    }
  },

  // 2. Attendance Management
  attendance: {
    async list(filters?: { date?: string; storeId?: number; employeeId?: number }) {
      const params = new URLSearchParams();
      if (filters?.date) params.append('date', filters.date);
      if (filters?.storeId) params.append('storeId', String(filters.storeId));
      if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<Attendance[]>(`/attendance${query}`);
    },

    async getTodayStatus(employeeId: number) {
      return await request<Attendance | null>(`/attendance/today/${employeeId}`);
    },

    async punch(employeeId: number, type: 'in' | 'out', notes?: string) {
      return await request<{ success: boolean; attendance: Attendance; message: string }>('/attendance/punch', {
        method: 'POST',
        body: JSON.stringify({ employeeId, type, notes })
      });
    },

    async correct(data: {
      attendanceId: number;
      checkInTime?: string;
      checkOutTime?: string;
      status: string;
      reason: string;
    }) {
      return await request<{ success: boolean; attendance: Attendance; message: string }>('/attendance/correct', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async getMonthlyReport(month: number, year: number, storeId?: number) {
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      if (storeId) params.append('storeId', String(storeId));
      return await request<any[]>(`/attendance/report?${params.toString()}`);
    }
  },

  // 3. Leaves Management
  leaves: {
    async list(filters?: { status?: string; employeeId?: number; storeId?: number }) {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.employeeId) params.append('employeeId', String(filters.employeeId));
      if (filters?.storeId) params.append('storeId', String(filters.storeId));
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<LeaveApplication[]>(`/leaves${query}`);
    },

    async getBalance(employeeId: number, year?: number) {
      const yr = year || new Date().getFullYear();
      return await request<LeaveBalance>(`/leaves/balance/${employeeId}?year=${yr}`);
    },

    async apply(data: {
      employeeId: number;
      leaveType: string;
      startDate: string;
      endDate: string;
      reason: string;
    }) {
      return await request<{ success: boolean; application: LeaveApplication; message: string }>('/leaves/apply', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async review(id: number, status: 'approved' | 'rejected', managerRemarks?: string) {
      return await request<{ success: boolean; message: string }>(`/leaves/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, managerRemarks })
      });
    },

    async cancel(id: number) {
      return await request<{ success: boolean; message: string }>(`/leaves/${id}`, {
        method: 'DELETE'
      });
    }
  },

  // 4. Payroll Management
  payroll: {
    async list(filters?: { storeId?: number; year?: number }) {
      const params = new URLSearchParams();
      if (filters?.storeId) params.append('storeId', String(filters.storeId));
      if (filters?.year) params.append('year', String(filters.year));
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<Payroll[]>(`/payroll${query}`);
    },

    async get(id: number) {
      return await request<Payroll>(`/payroll/${id}`);
    },

    async calculate(month: number, year: number, storeId?: number) {
      return await request<{
        month: number;
        year: number;
        total_gross_salary: number;
        total_deductions: number;
        total_net_salary: number;
        employee_count: number;
        items: PayrollItem[];
      }>('/payroll/calculate', {
        method: 'POST',
        body: JSON.stringify({ month, year, storeId })
      });
    },

    async generate(data: {
      month: number;
      year: number;
      storeId?: number;
      notes?: string;
      items: PayrollItem[];
    }) {
      return await request<{ success: boolean; payroll: Payroll; message: string }>('/payroll/generate', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async updateItem(itemId: number, data: { bonus?: number; allowances?: number; deductions?: number; advance_deduction?: number }) {
      return await request<PayrollItem>(`/payroll/item/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async disburse(id: number, paymentMethod: string, notes?: string) {
      return await request<{ success: boolean; payroll: Payroll; message: string }>(`/payroll/${id}/disburse`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod, notes })
      });
    },

    async getSalarySlip(itemId: number) {
      return await request<SalarySlip>(`/payroll/slip/${itemId}`);
    }
  },

  // 5. Supplier Management
  suppliers: {
    async list(search?: string, activeOnly: boolean = false) {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (activeOnly) params.append('activeOnly', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<Supplier[]>(`/suppliers${query}`);
    },

    async get(id: number) {
      return await request<Supplier>(`/suppliers/${id}`);
    },

    async create(data: Partial<Supplier>) {
      return await request<Supplier>('/suppliers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async update(id: number, data: Partial<Supplier>) {
      return await request<Supplier>(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async delete(id: number) {
      return await request<{ success: boolean; message: string }>(`/suppliers/${id}`, {
        method: 'DELETE'
      });
    },

    // Purchase Orders
    async listPOs(filters?: { supplierId?: number; storeId?: number; status?: string }) {
      const params = new URLSearchParams();
      if (filters?.supplierId) params.append('supplierId', String(filters.supplierId));
      if (filters?.storeId) params.append('storeId', String(filters.storeId));
      if (filters?.status) params.append('status', filters.status);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<PurchaseOrder[]>(`/suppliers/pos/list${query}`);
    },

    async getPO(id: number) {
      return await request<PurchaseOrder>(`/suppliers/pos/${id}`);
    },

    async createPO(data: {
      supplierId: number;
      storeId: number;
      orderDate: string;
      expectedDeliveryDate?: string;
      items: { productId: number; quantity: number; unitCost: number }[];
      shippingCost?: number;
      taxAmount?: number;
      notes?: string;
    }) {
      return await request<PurchaseOrder>('/suppliers/pos', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async receiveStock(id: number, receivedItems: { itemId: number; quantityReceived: number }[], notes?: string) {
      return await request<{ success: boolean; po: PurchaseOrder; message: string }>(`/suppliers/pos/${id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ receivedItems, notes })
      });
    },

    async recordPayment(id: number, amount: number, paymentMethod: string, notes?: string) {
      return await request<{ success: boolean; po: PurchaseOrder; message: string }>(`/suppliers/pos/${id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount, paymentMethod, notes })
      });
    }
  },

  // 6. Expense & Financial Management
  expenses: {
    async list(filters?: { storeId?: number; categoryId?: number; startDate?: string; endDate?: string }) {
      const params = new URLSearchParams();
      if (filters?.storeId) params.append('storeId', String(filters.storeId));
      if (filters?.categoryId) params.append('categoryId', String(filters.categoryId));
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<Expense[]>(`/expenses${query}`);
    },

    async getOverview(filters?: { storeId?: number; startDate?: string; endDate?: string }) {
      const params = new URLSearchParams();
      if (filters?.storeId) params.append('storeId', String(filters.storeId));
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<FinancialOverview>(`/expenses/analytics/overview${query}`);
    },

    async create(data: Partial<Expense>) {
      return await request<Expense>('/expenses', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async update(id: number, data: Partial<Expense>) {
      return await request<Expense>(`/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async delete(id: number) {
      return await request<{ success: boolean; message: string }>(`/expenses/${id}`, {
        method: 'DELETE'
      });
    },

    async getCategories() {
      return await request<ExpenseCategory[]>('/expenses/meta/categories');
    },

    async createCategory(data: { name: string; code?: string; description?: string }) {
      return await request<ExpenseCategory>('/expenses/meta/categories', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },

  // 7. Comprehensive Reports
  reports: {
    async getSalesReport(filters?: { storeId?: number; startDate?: string; endDate?: string }) {
      const params = new URLSearchParams();
      if (filters?.storeId) params.append('storeId', String(filters.storeId));
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<any>(`/reports/sales${query}`);
    },

    async getInventoryReport(storeId?: number) {
      const query = storeId ? `?storeId=${storeId}` : '';
      return await request<any>(`/reports/inventory${query}`);
    },

    async getWorkforceReport(filters?: { storeId?: number; month?: number; year?: number }) {
      const params = new URLSearchParams();
      if (filters?.storeId) params.append('storeId', String(filters.storeId));
      if (filters?.month) params.append('month', String(filters.month));
      if (filters?.year) params.append('year', String(filters.year));
      const query = params.toString() ? `?${params.toString()}` : '';
      return await request<any>(`/reports/workforce${query}`);
    },

    async getStoreComparison() {
      return await request<any[]>('/reports/stores/comparison');
    }
  },

  // 8. Notifications Center
  notifications: {
    async list(filters?: { unreadOnly?: boolean; limit?: number }) {
      const params = new URLSearchParams();
      if (filters?.unreadOnly) {
        params.append('unread_only', 'true');
        params.append('unreadOnly', 'true');
      }
      if (filters?.limit) params.append('limit', String(filters.limit));
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await request<any>(`/notifications${query}`);
      if (Array.isArray(res)) return res as NotificationItem[];
      if (Array.isArray(res?.notifications)) return res.notifications as NotificationItem[];
      return [] as NotificationItem[];
    },

    async getUnreadCount() {
      const res = await request<any>('/notifications/unread-count');
      const count = typeof res?.count === 'number' ? res.count : (typeof res === 'number' ? res : 0);
      return { count };
    },

    async markAsRead(id: number) {
      return await request<{ success: boolean }>(`/notifications/${id}/read`, {
        method: 'POST'
      });
    },

    async markAllAsRead() {
      return await request<{ success: boolean; count?: number }>('/notifications/read-all', {
        method: 'POST'
      });
    },

    async scan() {
      return await request<{ success: boolean; count?: number }>('/notifications/scan', {
        method: 'POST'
      });
    }
  }
};
