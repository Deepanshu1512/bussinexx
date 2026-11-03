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
import { Building2, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const initSession = async () => {
    try {
      const token = tokenStorage.get();
      if (token) {
        const res = await api.auth.getMe();
        if (res && res.user && res.business) {
          setCurrentUser(res.user);
          setCurrentBusiness(res.business);
        } else {
          tokenStorage.clear();
          setCurrentUser(null);
          setCurrentBusiness(null);
        }
      } else {
        setCurrentUser(null);
        setCurrentBusiness(null);
      }
    } catch {
      tokenStorage.clear();
      setCurrentUser(null);
      setCurrentBusiness(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    initSession();

    const handleLogoutEvent = () => {
      tokenStorage.clear();
      setCurrentUser(null);
      setCurrentBusiness(null);
    };

    const handleLoginEvent = () => {
      initSession();
    };

    window.addEventListener('bussinex-logout', handleLogoutEvent);
    window.addEventListener('bussinex-login', handleLoginEvent);

    return () => {
      window.removeEventListener('bussinex-logout', handleLogoutEvent);
      window.removeEventListener('bussinex-login', handleLoginEvent);
    };
  }, []);

  const handleLoginSuccess = (user: User, business: Business) => {
    setCurrentUser(user);
    setCurrentBusiness(business);
    window.dispatchEvent(new Event('bussinex-login'));
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setCurrentUser(null);
    setCurrentBusiness(null);
  };

  // Sleek Startup Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center font-sans text-zinc-100">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/25 ring-1 ring-white/20 animate-pulse">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div className="text-white font-extrabold text-xl tracking-tight">BUSSINEX</div>
        <div className="flex items-center gap-2 text-zinc-500 text-xs mt-2 font-mono uppercase tracking-widest">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span>Securing Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          {/* Public Standalone Terms & Conditions Page */}
          <Route path="/terms" element={<TermsPage />} />

          {/* Login & Registration Portal */}
          <Route
            path="/login"
            element={
              currentUser ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          {/* Authenticated Application Shell */}
          {currentUser ? (
            <Route
              path="/*"
              element={
                <Layout
                  businessName={currentBusiness?.name || 'My Shop Workspace'}
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
          ) : (
            // Any attempt to access protected pages without authentication redirects to /login
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
};

export default App;
