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
import { api } from './services/api';
import { User, Business } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkAuth = async () => {
    if (api.auth.isAuthenticated()) {
      try {
        const res = await api.auth.getMe();
        setCurrentUser(res.user);
        setCurrentBusiness(res.business);
      } catch (err) {
        console.warn('Auth check failed, clearing session', err);
        api.auth.logout();
        setCurrentUser(null);
        setCurrentBusiness(null);
      }
    } else {
      setCurrentUser(null);
      setCurrentBusiness(null);
    }
    setAuthChecked(true);
  };

  useEffect(() => {
    checkAuth();

    const handleLogout = () => {
      setCurrentUser(null);
      setCurrentBusiness(null);
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
    setCurrentUser(null);
    setCurrentBusiness(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
        Verifying Session...
      </div>
    );
  }

  // If user is not authenticated, render Login/Register Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <Layout
        businessName={currentBusiness?.name || 'Bussinex Enterprise'}
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
