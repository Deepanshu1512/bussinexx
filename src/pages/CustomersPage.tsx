import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Mail,
  Phone,
  Building,
  MapPin,
  DollarSign,
  ShoppingBag,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { Customer } from '../types';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Customer Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    tier: 'regular' as 'vip' | 'regular' | 'wholesale' | 'new',
    address: '',
    notes: '',
  });

  // Customer Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<any>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomers(search || undefined, tierFilter || undefined);
      setCustomers(data);
    } catch (err: any) {
      showNotification(err.message || 'Error fetching customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, tierFilter]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      tier: 'regular',
      address: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      tier: c.tier,
      address: c.address || '',
      notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('Customer name is required', 'error');
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        company: formData.company.trim() || undefined,
        tier: formData.tier,
        address: formData.address.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload);
        showNotification(`Customer '${payload.name}' updated!`);
      } else {
        await api.createCustomer(payload);
        showNotification(`New customer '${payload.name}' added to CRM!`);
      }

      setModalOpen(false);
      loadCustomers();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to remove customer '${name}'? Historical orders will be preserved.`)) return;
    try {
      const res = await api.deleteCustomer(id);
      showNotification(res.message);
      loadCustomers();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      const detail = await api.getCustomer(id);
      setSelectedCustomerDetails(detail);
      setDetailsModalOpen(true);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-xs font-semibold shadow-xl transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/30 text-rose-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Customer Relationship Management</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Client accounts, enterprise tier classification, lifetime value (LTV) & purchase history.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer Profile</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or company..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['', 'vip', 'wholesale', 'regular', 'new'].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors uppercase font-mono ${
                tierFilter === t
                  ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                  : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
              }`}
            >
              {t === '' ? 'All Tiers' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-400">Loading client profiles...</div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800/60">
                <tr>
                  <th className="px-6 py-3.5">Customer Name</th>
                  <th className="px-6 py-3.5">Contact Details</th>
                  <th className="px-6 py-3.5">Tier</th>
                  <th className="px-6 py-3.5">Total Orders</th>
                  <th className="px-6 py-3.5">Lifetime Value (LTV)</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleViewDetails(c.id)}
                    className="hover:bg-zinc-900/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white tracking-tight">{c.name}</div>
                      {c.company && (
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3 text-zinc-500" />
                          {c.company}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 space-y-0.5">
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-zinc-300">
                          <Mail className="w-3 h-3 text-zinc-500" />
                          {c.email}
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                          <Phone className="w-3 h-3 text-zinc-600" />
                          {c.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          c.tier === 'vip'
                            ? 'purple'
                            : c.tier === 'wholesale'
                            ? 'sky'
                            : c.tier === 'new'
                            ? 'emerald'
                            : 'zinc'
                        }
                        size="md"
                      >
                        {c.tier.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">
                      {c.total_orders || 0} orders
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-sky-400 text-sm">
                      ${(c.total_spent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(c.id);
                          }}
                          title="View Purchase History"
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(c);
                          }}
                          title="Edit Customer"
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(c.id, c.name);
                          }}
                          title="Delete Customer"
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No customers recorded"
            description="Add customer profiles to track client purchase histories and unlock loyalty analytics."
            actionText="+ Add Customer"
            onAction={handleOpenAdd}
          />
        )}
      </div>

      {/* CREATE / EDIT CUSTOMER MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Edit Customer Profile' : 'Add New Customer Profile'}
        subtitle="Manage client accounts and relationship tiering"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Sarah Jenkins"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Company / Organization</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g. Acme Technologies Inc."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sarah@acme.com"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Account Tier</label>
            <select
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
            >
              <option value="vip">VIP Enterprise (High volume / Dedicated pricing)</option>
              <option value="wholesale">Wholesale Buyer (Bulk purchasing)</option>
              <option value="regular">Regular Client</option>
              <option value="new">New Prospect</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Billing & Shipping Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="100 Innovation Way, Suite 400, San Francisco, CA"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Account Notes & Preferences</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Preferred delivery times, tax exempt certificates, purchase order guidelines..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
            >
              {editingCustomer ? 'Save Changes' : 'Create Profile'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CUSTOMER DETAILS & ORDER HISTORY MODAL */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedCustomerDetails?.name || 'Customer Profile'}
        subtitle="Full account intelligence and lifetime purchase history"
        maxWidth="xl"
      >
        {selectedCustomerDetails && (
          <div className="space-y-6">
            {/* LTV & Metric Cards */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-mono block">Lifetime Value</span>
                <span className="font-mono font-bold text-sky-400 text-base mt-0.5 block">
                  ${selectedCustomerDetails.total_spent?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-mono block">Orders</span>
                <span className="font-mono font-bold text-white text-base mt-0.5 block">
                  {selectedCustomerDetails.total_orders || 0}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-mono block">Avg Order Value</span>
                <span className="font-mono font-bold text-emerald-400 text-base mt-0.5 block">
                  ${selectedCustomerDetails.avg_order_value?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>

            {/* Profile Info */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Company:</span>
                <span className="font-semibold text-white">{selectedCustomerDetails.company || 'Individual Account'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Email:</span>
                <span className="font-mono text-zinc-300">{selectedCustomerDetails.email || 'None'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Phone:</span>
                <span className="font-mono text-zinc-300">{selectedCustomerDetails.phone || 'None'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Tier:</span>
                <Badge variant="purple">{selectedCustomerDetails.tier?.toUpperCase()}</Badge>
              </div>
              {selectedCustomerDetails.address && (
                <div className="pt-2 border-t border-zinc-800/80 text-zinc-400">
                  <span className="block text-[11px] text-zinc-500">Address:</span>
                  <span className="text-zinc-300">{selectedCustomerDetails.address}</span>
                </div>
              )}
              {selectedCustomerDetails.notes && (
                <div className="pt-2 border-t border-zinc-800/80 text-zinc-400">
                  <span className="block text-[11px] text-zinc-500">Notes:</span>
                  <span className="text-zinc-300">{selectedCustomerDetails.notes}</span>
                </div>
              )}
            </div>

            {/* Purchase History Table */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-2">
                Order History ({selectedCustomerDetails.orders?.length || 0})
              </h4>
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                {selectedCustomerDetails.orders && selectedCustomerDetails.orders.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-2.5">Order</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {selectedCustomerDetails.orders.map((o: any) => (
                        <tr key={o.id}>
                          <td className="px-4 py-2.5 font-mono text-sky-400">{o.order_number}</td>
                          <td className="px-4 py-2.5 text-zinc-400">{o.created_at.slice(0, 10)}</td>
                          <td className="px-4 py-2.5 capitalize text-zinc-300">{o.status}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-white">
                            ${o.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-6 text-center text-xs text-zinc-500">
                    No orders placed yet by this client.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
