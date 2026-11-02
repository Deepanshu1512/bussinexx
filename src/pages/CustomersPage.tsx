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
  ShoppingBag,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { Customer } from '../types';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { formatINR, formatPhone, formatDate, INDIAN_STATES } from '../utils/formatters';

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
    tier: 'regular' as 'vip' | 'regular' | 'wholesale' | 'new' | 'enterprise',
    address: '',
    city: '',
    state: 'Karnataka',
    pincode: '',
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
      city: '',
      state: 'Karnataka',
      pincode: '',
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
      city: (c as any).city || '',
      state: (c as any).state || 'Karnataka',
      pincode: (c as any).pincode || '',
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
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Customer Relationship Management</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Client accounts, enterprise tier classification, lifetime value (LTV) & purchase history.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer Profile</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or company..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-none pb-1 shrink-0">
          {['', 'vip', 'wholesale', 'regular', 'new'].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors uppercase font-mono shrink-0 cursor-pointer ${
                tierFilter === t
                  ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                  : 'text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800'
              }`}
            >
              {t === '' ? 'All Tiers' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-400">Loading client profiles...</div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-zinc-950 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3.5">Customer Name</th>
                  <th className="px-6 py-3.5">Contact Details</th>
                  <th className="px-6 py-3.5">Tier</th>
                  <th className="px-6 py-3.5">Total Orders</th>
                  <th className="px-6 py-3.5">Lifetime Value (LTV)</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleViewDetails(c.id)}
                    className="hover:bg-zinc-900/60 transition-colors cursor-pointer"
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
                        <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                          <Phone className="w-3 h-3 text-zinc-500" />
                          {formatPhone(c.phone)}
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
                    <td className="px-6 py-4 font-mono font-bold text-indigo-400 text-sm">
                      {formatINR(c.total_spent || 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(c.id);
                          }}
                          title="View Purchase History"
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-indigo-400 hover:text-indigo-300 transition-colors"
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
                placeholder="e.g. Vikram Sharma"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Company / Enterprise</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g. Bharat Logistics Ltd"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
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
                placeholder="client@company.in"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Mobile Number (+91)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Bengaluru"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">State</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">PIN Code (6 digits)</label>
              <input
                type="text"
                maxLength={6}
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })}
                placeholder="560066"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Street Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Flat / Building, Street / Area"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Account Relationship Tier</label>
              <select
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="regular">Regular Client</option>
                <option value="vip">VIP Premium Account</option>
                <option value="wholesale">Wholesale B2B Partner</option>
                <option value="new">New Prospect</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Internal Relationship Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Credit limits, GSTIN details, payment terms, or sales rep notes..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
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
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
            >
              {editingCustomer ? 'Update Profile' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW CUSTOMER DETAILS MODAL */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedCustomerDetails ? selectedCustomerDetails.name : 'Customer Dossier'}
        subtitle="Purchase history, total lifetime value and contact details"
        maxWidth="xl"
      >
        {selectedCustomerDetails && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-500 block">Tier</span>
                <span className="font-semibold text-white capitalize mt-0.5 block">
                  {selectedCustomerDetails.tier}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Total Orders</span>
                <span className="font-mono font-bold text-white mt-0.5 block">
                  {selectedCustomerDetails.total_orders || selectedCustomerDetails.orders?.length || 0}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">LTV Spend</span>
                <span className="font-mono font-bold text-indigo-400 mt-0.5 block">
                  {formatINR(selectedCustomerDetails.total_spent || 0)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">City</span>
                <span className="text-zinc-300 mt-0.5 block">
                  {selectedCustomerDetails.city || '—'}
                </span>
              </div>
            </div>

            {/* Contact Details */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5 text-xs">
              {selectedCustomerDetails.email && (
                <div className="text-zinc-300 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                  {selectedCustomerDetails.email}
                </div>
              )}
              {selectedCustomerDetails.phone && (
                <div className="text-zinc-300 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-500" />
                  {formatPhone(selectedCustomerDetails.phone)}
                </div>
              )}
              {selectedCustomerDetails.address && (
                <div className="text-zinc-400 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  {selectedCustomerDetails.address}
                  {selectedCustomerDetails.city ? `, ${selectedCustomerDetails.city}` : ''}
                  {selectedCustomerDetails.state ? `, ${selectedCustomerDetails.state}` : ''}
                  {selectedCustomerDetails.pincode ? ` - ${selectedCustomerDetails.pincode}` : ''}
                </div>
              )}
            </div>

            {/* Orders History List */}
            <div>
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono mb-3">
                Purchase Order History
              </h4>
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                {selectedCustomerDetails.orders && selectedCustomerDetails.orders.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-2.5">Order #</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      {selectedCustomerDetails.orders.map((o: any) => (
                        <tr key={o.id}>
                          <td className="px-4 py-3 font-mono text-indigo-400">{o.order_number}</td>
                          <td className="px-4 py-3 font-mono text-zinc-400">{formatDate(o.created_at)}</td>
                          <td className="px-4 py-3 capitalize">{o.status}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-white">
                            {formatINR(o.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-8 text-center text-xs text-zinc-500">
                    No orders linked to this client yet.
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

export default CustomersPage;
