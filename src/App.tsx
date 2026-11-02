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
import { TermsPage } from './pages/TermsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { AttendancePage } from './pages/AttendancePage';
import { LeavesPage } from './pages/LeavesPage';
import { PayrollPage } from './pages/PayrollPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ReportsPage } from './pages/ReportsPage';
import { StoreProvider } from './context/StoreContext';
import { api, tokenStorage } from './services/api';
import { User, Business } from './types';

const DEFAULT_GUEST_USER: User = {
  id: 1,
  name: 'Rajesh Kumar',
  email: 'admin@bussinex.com',
  role: 'admin',
  business_id: 1,
};

const DEFAULT_GUEST_BUSINESS: Business = {
  id: 1,
  name: 'Apex Enterprises Pvt Ltd',
  currency_symbol: '₹',
  currency_code: 'INR',
  tax_rate: 18.0,
  contact_email: 'contact@apex-enterprises.in',
  contact_phone: '+91 98765 43210',
  address: 'Brigade Tech Park, Whitefield, Bengaluru, Karnataka 560066',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560066',
  country: 'India'
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
    window.dispatchEvent(new Event('bussinex-login'));
  };

  const handleLogout = () => {
    api.auth.logout();
    setCurrentUser(DEFAULT_GUEST_USER);
    setCurrentBusiness(DEFAULT_GUEST_BUSINESS);
  };

  return (
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          {/* Unauthenticated standalone Terms & Conditions page */}
          <Route path="/terms" element={<TermsPage />} />

          {/* Login Page */}
          <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />

          {/* Main App with Authenticated Layout */}
          <Route
            path="/*"
            element={
              <Layout
                businessName={currentBusiness?.name || 'Apex Enterprises Pvt Ltd'}
                user={currentUser}
                onLogout={handleLogout}
              >
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/leaves" element={<LeavesPage />} />
                  <Route path="/payroll" element={<PayrollPage />} />
                  <Route path="/customers" element={<CustomersPage />} />
                  <Route path="/suppliers" element={<SuppliersPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/brain" element={<BusinessBrainPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
};

export default App;
