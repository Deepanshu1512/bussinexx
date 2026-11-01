import { 
  Product, Category, Customer, Order, ExecutiveSummary, 
  RevenuePoint, TopProduct, CategoryStat, TopCustomer, 
  InventoryHealth, BrainConversation, BrainMessage, AppSettings,
  AuthResponse, User, Business, Store, StockTransfer, StockLog
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
    async login(email: string, password: string): Promise<AuthResponse> {
      const res = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      tokenStorage.set(res.token);
      return res;
    },

    async register(
      name: string, 
      email: string, 
      password: string, 
      businessName?: string,
      phone?: string,
      termsAccepted: boolean = true,
      termsVersion: string = '2026.1'
    ): Promise<AuthResponse> {
      const res = await request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          name: name.trim(), 
          email: email.trim().toLowerCase(), 
          password, 
          businessName: businessName?.trim(),
          phone: phone?.trim(),
          terms_accepted: termsAccepted,
          terms_version: termsVersion
        }),
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

    logout() {
      tokenStorage.clear();
      window.dispatchEvent(new Event('bussinex-logout'));
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
  }
};
