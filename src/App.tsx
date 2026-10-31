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

const DEFAULT_GUEST_USER: User = {
  id: 1,
  name: 'Guest Explorer',
  email: 'guest@bussinex.com',
  role: 'admin',
  business_id: 1,
};

const DEFAULT_GUEST_BUSINESS: Business = {
  id: 1,
  name: 'Apex Innovations Ltd',
  currency_symbol: '$',
  tax_rate: 8.5,
  contact_email: 'finance@apex-innovations.com',
  address: '742 Evergreen Terrace, Tech District, CA',
};

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_GUEST_USER);
  const [currentBusiness, setCurrentBusiness] = useState<Business>(DEFAULT_GUEST_BUSINESS);

  const initSession = async () => {
    try {
      if (tokenStorage.get()) {
        const res = await api.auth.getMe();
        if (res && res.user && res.business) {
          setCurrentUser(res.user);
          setCurrentBusiness(res.business);
        }
      }
    } catch {
      // In guest mode, keep default guest profile
      setCurrentUser(DEFAULT_GUEST_USER);
      setCurrentBusiness(DEFAULT_GUEST_BUSINESS);
    }
  };

  useEffect(() => {
    initSession();

    const handleLogout = () => {
      tokenStorage.clear();
      setCurrentUser(DEFAULT_GUEST_USER);
      setCurrentBusiness(DEFAULT_GUEST_BUSINESS);
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
    setCurrentUser(DEFAULT_GUEST_USER);
    setCurrentBusiness(DEFAULT_GUEST_BUSINESS);
  };

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
