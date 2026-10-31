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
import { api } from './services/api';

export const App: React.FC = () => {
  const [businessName, setBusinessName] = useState('Bussinex');

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        if (s.business_name) {
          setBusinessName(s.business_name);
        }
      })
      .catch((err) => console.warn('Could not load business settings', err));
  }, []);

  return (
    <BrowserRouter>
      <Layout businessName={businessName}>
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
