import { 
  Product, Category, Customer, Order, ExecutiveSummary, 
  RevenuePoint, TopProduct, CategoryStat, TopCustomer, 
  InventoryHealth, BrainConversation, BrainMessage, AppSettings 
} from '../types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errJson.message || errorMsg;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Dashboard
  getDashboard() {
    return request<{
      summary: ExecutiveSummary;
      revenueTimeline: RevenuePoint[];
      topProducts: TopProduct[];
      categoryStats: CategoryStat[];
      recentOrders: Order[];
      inventoryHealth: InventoryHealth;
    }>('/dashboard');
  },

  // Inventory
  getProducts(filters: { search?: string; category_id?: number; status?: string; low_stock?: boolean } = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.category_id) params.append('category_id', String(filters.category_id));
    if (filters.status) params.append('status', filters.status);
    if (filters.low_stock) params.append('low_stock', 'true');
    const q = params.toString() ? `?${params.toString()}` : '';
    return request<Product[]>(`/inventory${q}`);
  },

  getProduct(id: number) {
    return request<Product>(`/inventory/${id}`);
  },

  createProduct(data: Partial<Product>) {
    return request<Product>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateProduct(id: number, data: Partial<Product>) {
    return request<Product>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteProduct(id: number) {
    return request<{ success: boolean; message: string }>(`/inventory/${id}`, {
      method: 'DELETE'
    });
  },

  adjustStock(productId: number, changeQty: number, reason: string) {
    return request<{ success: boolean; productId: number; previousStock: number; newStock: number }>(`/inventory/${productId}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ change_qty: changeQty, reason })
    });
  },

  getCategories() {
    return request<Category[]>('/inventory/categories');
  },

  createCategory(name: string, description?: string) {
    return request<Category>('/inventory/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
  },

  // Orders
  getOrders(filters: { search?: string; status?: string; customer_id?: number } = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.customer_id) params.append('customer_id', String(filters.customer_id));
    const q = params.toString() ? `?${params.toString()}` : '';
    return request<Order[]>(`/orders${q}`);
  },

  getOrder(id: number) {
    return request<Order>(`/orders/${id}`);
  },

  createOrder(data: {
    customer_id?: number | null;
    items: { product_id: number; quantity: number; unit_price?: number }[];
    payment_method?: string;
    status?: string;
    discount_amount?: number;
    notes?: string;
  }) {
    return request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateOrderStatus(id: number, status: string) {
    return request<Order>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Customers
  getCustomers(search?: string, tier?: string) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tier) params.append('tier', tier);
    const q = params.toString() ? `?${params.toString()}` : '';
    return request<Customer[]>(`/customers${q}`);
  },

  getCustomer(id: number) {
    return request<Customer & { orders: Order[] }>(`/customers/${id}`);
  },

  createCustomer(data: Partial<Customer>) {
    return request<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateCustomer(id: number, data: Partial<Customer>) {
    return request<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteCustomer(id: number) {
    return request<{ success: boolean; message: string }>(`/customers/${id}`, {
      method: 'DELETE'
    });
  },

  // Analytics
  getAnalyticsSummary() {
    return request<ExecutiveSummary>('/analytics/summary');
  },

  getRevenueTimeline(days: number = 30) {
    return request<RevenuePoint[]>(`/analytics/timeline?days=${days}`);
  },

  getTopProducts(limit: number = 8) {
    return request<TopProduct[]>(`/analytics/top-products?limit=${limit}`);
  },

  getCategoryStats() {
    return request<CategoryStat[]>('/analytics/categories');
  },

  getTopCustomers(limit: number = 8) {
    return request<TopCustomer[]>(`/analytics/top-customers?limit=${limit}`);
  },

  getExecutiveReport() {
    return request<any>('/analytics/report');
  },

  // Business Brain AI
  getBrainConversations() {
    return request<BrainConversation[]>('/brain/conversations');
  },

  getBrainMessages(conversationId: string) {
    return request<BrainMessage[]>(`/brain/conversations/${conversationId}`);
  },

  deleteBrainConversation(conversationId: string) {
    return request<{ success: boolean }>(`/brain/conversations/${conversationId}`, {
      method: 'DELETE'
    });
  },

  askBusinessBrain(prompt: string, conversationId?: string | null) {
    return request<{
      conversationId: string;
      response: string;
      metrics: any;
      providerUsed: string;
    }>('/brain/query', {
      method: 'POST',
      body: JSON.stringify({ prompt, conversationId })
    });
  },

  getBrainContext() {
    return request<any>('/brain/context');
  },

  // Settings
  getSettings() {
    return request<AppSettings>('/settings');
  },

  updateSettings(settings: Partial<AppSettings>) {
    return request<{ success: boolean; message: string }>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  },

  testAIConnection(apiKey?: string, model?: string) {
    return request<{ success: boolean; message: string }>('/settings/test-ai', {
      method: 'POST',
      body: JSON.stringify({ apiKey, model })
    });
  },

  seedDemoData() {
    return request<{ success: boolean; message: string }>('/settings/seed', {
      method: 'POST'
    });
  },

  resetDatabase() {
    return request<{ success: boolean; message: string }>('/settings/reset', {
      method: 'POST'
    });
  }
};
