import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomersPage } from './pages/CustomersPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { BusinessBrainPage } from './pages/BusinessBrainPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { api, tokenStorage } from './services/api';
import { User, Business } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const initSession = async () => {
    try {
      if (tokenStorage.get()) {
        const res = await api.auth.getMe();
        setCurrentUser(res.user);
        setCurrentBusiness(res.business);
      } else {
        // Automatically authenticate with default demo tenant so full platform is active
        try {
          const loginRes = await api.auth.login('admin@bussinex.com', 'admin123');
          setCurrentUser(loginRes.user);
          setCurrentBusiness(loginRes.business);
        } catch {
          // If login endpoint isn't ready or offline, set default tenant context
          setCurrentBusiness({
            id: 1,
            name: 'Apex Innovations Ltd',
            currency_symbol: '$',
            tax_rate: 8.5,
          } as Business);
          setCurrentUser({
            id: 1,
            name: 'Demo Administrator',
            email: 'admin@bussinex.com',
            role: 'admin',
            business_id: 1,
          });
        }
      }
    } catch (err) {
      console.warn('Session init fallback:', err);
      setCurrentBusiness({
        id: 1,
        name: 'Apex Innovations Ltd',
        currency_symbol: '$',
        tax_rate: 8.5,
      } as Business);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initSession();

    const handleLogout = () => {
      tokenStorage.clear();
      // Re-init default demo session on logout
      initSession();
    };

    window.addEventListener('bussinex-logout', handleLogout);
    return () => window.removeEventListener('bussinex-logout', handleLogout);
  }, []);

  const handleLoginSuccess = (user: User, business: Business) => {
    setCurrentUser(user);
    setCurrentBusiness(business);
  };

  const handleLogout = () => {
    api.auth.logout();
    initSession();
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
          Initializing Bussinex Platform...
        </span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout
        businessName={currentBusiness?.name || 'Apex Innovations Ltd'}
        user={currentUser}
        onLogout={handleLogout}
      >
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/brain" element={<BusinessBrainPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
