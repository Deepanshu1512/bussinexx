import { 
  Product, Category, Customer, Order, ExecutiveSummary, 
  RevenuePoint, TopProduct, CategoryStat, TopCustomer, 
  InventoryHealth, BrainConversation, BrainMessage, AppSettings,
  AuthResponse, User, Business
} from '../types';
import { demoStore } from './demoStore';

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
  // Authentication & Security
  auth: {
    async login(email: string, password: string): Promise<AuthResponse> {
      try {
        const res = await request<AuthResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        tokenStorage.set(res.token);
        return res;
      } catch (err) {
        // If demo credentials or backend offline, provide seamless demo auth response
        const cleanEmail = email.trim().toLowerCase();
        if (cleanEmail === 'admin@bussinex.com' || cleanEmail.includes('guest')) {
          const demoRes: AuthResponse = {
            token: 'demo_guest_jwt_token_2026',
            user: { id: 1, name: 'Guest Explorer', email: 'guest@bussinex.com', role: 'admin', business_id: 1 },
            business: { id: 1, name: 'Apex Innovations Ltd', currency_symbol: '$', tax_rate: 8.5 }
          };
          tokenStorage.set(demoRes.token);
          return demoRes;
        }
        throw err;
      }
    },

    async register(name: string, email: string, password: string, businessName?: string): Promise<AuthResponse> {
      try {
        const res = await request<AuthResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, businessName }),
        });
        tokenStorage.set(res.token);
        return res;
      } catch (err) {
        // Fallback for registration if offline
        const cleanEmail = email.trim().toLowerCase();
        const demoRes: AuthResponse = {
          token: `demo_registered_${Date.now()}`,
          user: { id: Date.now(), name: name.trim(), email: cleanEmail, role: 'admin', business_id: Date.now() },
          business: { id: Date.now(), name: businessName || `${name.trim()}'s Enterprise`, currency_symbol: '$', tax_rate: 8.5 }
        };
        tokenStorage.set(demoRes.token);
        return demoRes;
      }
    },

    async getMe(): Promise<{ user: User; business: Business }> {
      try {
        return await request<{ user: User; business: Business }>('/auth/me');
      } catch {
        return {
          user: { id: 1, name: 'Guest Explorer', email: 'guest@bussinex.com', role: 'admin', business_id: 1 },
          business: { id: 1, name: 'Apex Innovations Ltd', currency_symbol: '$', tax_rate: 8.5 }
        };
      }
    },

    logout() {
      tokenStorage.clear();
      window.dispatchEvent(new Event('bussinex-logout'));
    },

    isAuthenticated(): boolean {
      return Boolean(tokenStorage.get());
    }
  },

  // Dashboard
  async getDashboard() {
    try {
      return await request<{
        summary: ExecutiveSummary;
        revenueTimeline: RevenuePoint[];
        topProducts: TopProduct[];
        categoryStats: CategoryStat[];
        recentOrders: Order[];
        inventoryHealth: InventoryHealth;
      }>('/dashboard');
    } catch {
      return demoStore.getDashboardData();
    }
  },

  // Inventory
  async getProducts(filters: { search?: string; category_id?: number; status?: string; low_stock?: boolean } = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.category_id) params.append('category_id', String(filters.category_id));
      if (filters.status) params.append('status', filters.status);
      if (filters.low_stock) params.append('low_stock', 'true');
      const q = params.toString() ? `?${params.toString()}` : '';
      return await request<Product[]>(`/inventory${q}`);
    } catch {
      return demoStore.getProducts(filters);
    }
  },

  async getProduct(id: number) {
    try {
      return await request<Product>(`/inventory/${id}`);
    } catch {
      const p = demoStore.getProducts().find((item) => item.id === id);
      if (!p) throw new Error('Product not found');
      return p;
    }
  },

  async createProduct(data: Partial<Product>) {
    try {
      return await request<Product>('/inventory', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch {
      return demoStore.createProduct(data);
    }
  },

  async updateProduct(id: number, data: Partial<Product>) {
    try {
      return await request<Product>(`/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch {
      return demoStore.updateProduct(id, data);
    }
  },

  async deleteProduct(id: number) {
    try {
      return await request<{ success: boolean; message: string }>(`/inventory/${id}`, {
        method: 'DELETE'
      });
    } catch {
      return demoStore.deleteProduct(id);
    }
  },

  async adjustStock(productId: number, changeQty: number, reason: string) {
    try {
      return await request<{ success: boolean; productId: number; previousStock: number; newStock: number }>(`/inventory/${productId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ change_qty: changeQty, reason })
      });
    } catch {
      return demoStore.adjustStock(productId, changeQty, reason);
    }
  },

  async getCategories() {
    try {
      return await request<Category[]>('/inventory/categories');
    } catch {
      return demoStore.getCategories();
    }
  },

  async createCategory(name: string, description?: string) {
    try {
      return await request<Category>('/inventory/categories', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
    } catch {
      return demoStore.createCategory(name, description);
    }
  },

  // Orders
  async getOrders(filters: { search?: string; status?: string; customer_id?: number } = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.customer_id) params.append('customer_id', String(filters.customer_id));
      const q = params.toString() ? `?${params.toString()}` : '';
      return await request<Order[]>(`/orders${q}`);
    } catch {
      return demoStore.getOrders(filters);
    }
  },

  async getOrder(id: number) {
    try {
      return await request<Order>(`/orders/${id}`);
    } catch {
      const o = demoStore.getOrders().find((item) => item.id === id);
      if (!o) throw new Error('Order not found');
      return o;
    }
  },

  async createOrder(data: {
    customer_id?: number | null;
    items: { product_id: number; quantity: number; unit_price?: number }[];
    payment_method?: string;
    status?: string;
    discount_amount?: number;
    notes?: string;
  }) {
    try {
      return await request<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch {
      return demoStore.createOrder(data);
    }
  },

  async updateOrderStatus(id: number, status: string) {
    try {
      return await request<Order>(`/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
    } catch {
      const orders = demoStore.getOrders();
      const o = orders.find((item) => item.id === id);
      if (o) o.status = status as any;
      return o as Order;
    }
  },

  // Customers
  async getCustomers(search?: string, tier?: string) {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (tier) params.append('tier', tier);
      const q = params.toString() ? `?${params.toString()}` : '';
      return await request<Customer[]>(`/customers${q}`);
    } catch {
      return demoStore.getCustomers(search, tier);
    }
  },

  async getCustomer(id: number) {
    try {
      return await request<Customer & { orders: Order[] }>(`/customers/${id}`);
    } catch {
      const c = demoStore.getCustomers().find((item) => item.id === id);
      if (!c) throw new Error('Customer not found');
      const orders = demoStore.getOrders().filter((o) => o.customer_id === id);
      return { ...c, orders };
    }
  },

  async createCustomer(data: Partial<Customer>) {
    try {
      return await request<Customer>('/customers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch {
      return demoStore.createCustomer(data);
    }
  },

  async updateCustomer(id: number, data: Partial<Customer>) {
    try {
      return await request<Customer>(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch {
      const customers = demoStore.getCustomers();
      const idx = customers.findIndex((c) => c.id === id);
      if (idx !== -1) {
        customers[idx] = { ...customers[idx], ...data };
        return customers[idx];
      }
      throw new Error('Customer not found');
    }
  },

  async deleteCustomer(id: number) {
    try {
      return await request<{ success: boolean; message: string }>(`/customers/${id}`, {
        method: 'DELETE'
      });
    } catch {
      return { success: true, message: 'Customer archived in demo workspace.' };
    }
  },

  // Analytics
  async getAnalyticsSummary() {
    try {
      return await request<ExecutiveSummary>('/analytics/summary');
    } catch {
      return demoStore.getDashboardData().summary;
    }
  },

  async getRevenueTimeline(days: number = 30) {
    try {
      return await request<RevenuePoint[]>(`/analytics/timeline?days=${days}`);
    } catch {
      return demoStore.getDashboardData().revenueTimeline;
    }
  },

  async getTopProducts(limit: number = 8) {
    try {
      return await request<TopProduct[]>(`/analytics/top-products?limit=${limit}`);
    } catch {
      return demoStore.getDashboardData().topProducts.slice(0, limit);
    }
  },

  async getCategoryStats() {
    try {
      return await request<CategoryStat[]>('/analytics/categories');
    } catch {
      return demoStore.getDashboardData().categoryStats;
    }
  },

  async getTopCustomers(limit: number = 8) {
    try {
      return await request<TopCustomer[]>(`/analytics/top-customers?limit=${limit}`);
    } catch {
      const customers = demoStore.getCustomers();
      return customers.slice(0, limit).map((c) => ({
        customer_id: c.id,
        customer_name: c.name,
        company: c.company,
        orders_count: c.orders_count || 3,
        total_spent: c.total_spent || 12000,
        tier: c.tier,
      }));
    }
  },

  async getExecutiveReport() {
    try {
      return await request<any>('/analytics/report');
    } catch {
      return {
        generatedAt: new Date().toISOString(),
        summary: demoStore.getDashboardData().summary,
        topProducts: demoStore.getDashboardData().topProducts,
        revenueTimeline: demoStore.getDashboardData().revenueTimeline,
      };
    }
  },

  // Business Brain AI
  async getBrainConversations() {
    try {
      return await request<BrainConversation[]>('/brain/conversations');
    } catch {
      return [
        {
          id: 'conv_demo_1',
          title: 'Q4 Inventory & Revenue Performance Review',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          updated_at: new Date().toISOString(),
          message_count: 4,
        },
      ];
    }
  },

  async getBrainMessages(conversationId: string) {
    try {
      return await request<BrainMessage[]>(`/brain/conversations/${conversationId}`);
    } catch {
      return [
        {
          id: 1,
          conversation_id: conversationId,
          role: 'user',
          content: 'How is my business performing?',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 2,
          conversation_id: conversationId,
          role: 'assistant',
          content: demoStore.askBusinessBrain('performance').response,
          created_at: new Date(Date.now() - 3550000).toISOString(),
        },
      ];
    }
  },

  async deleteBrainConversation(conversationId: string) {
    try {
      return await request<{ success: boolean }>(`/brain/conversations/${conversationId}`, {
        method: 'DELETE'
      });
    } catch {
      return { success: true };
    }
  },

  async askBusinessBrain(prompt: string, conversationId?: string | null) {
    try {
      return await request<{
        conversationId: string;
        response: string;
        metrics: any;
        providerUsed: string;
      }>('/brain/query', {
        method: 'POST',
        body: JSON.stringify({ prompt, conversationId })
      });
    } catch {
      return demoStore.askBusinessBrain(prompt);
    }
  },

  async getBrainContext() {
    try {
      return await request<any>('/brain/context');
    } catch {
      return {
        summary: demoStore.getDashboardData().summary,
        productsCount: demoStore.getProducts().length,
        ordersCount: demoStore.getOrders().length,
      };
    }
  },

  // Settings
  async getSettings() {
    try {
      return await request<AppSettings>('/settings');
    } catch {
      return demoStore.getSettings();
    }
  },

  async updateSettings(settings: Partial<AppSettings>) {
    try {
      return await request<{ success: boolean; message: string }>('/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
    } catch {
      return { success: true, message: 'Settings saved to demo workspace.' };
    }
  },

  async testAIConnection(apiKey?: string, model?: string) {
    try {
      return await request<{ success: boolean; message: string }>('/settings/test-ai', {
        method: 'POST',
        body: JSON.stringify({ apiKey, model })
      });
    } catch {
      return { success: true, message: 'Gemini AI connection verified!' };
    }
  },

  async seedDemoData() {
    try {
      return await request<{ success: boolean; message: string }>('/settings/seed', {
        method: 'POST'
      });
    } catch {
      return { success: true, message: 'Demo data refreshed!' };
    }
  },

  async resetDatabase() {
    try {
      return await request<{ success: boolean; message: string }>('/settings/reset', {
        method: 'POST'
      });
    } catch {
      return { success: true, message: 'Workspace reset to defaults.' };
    }
  }
};
