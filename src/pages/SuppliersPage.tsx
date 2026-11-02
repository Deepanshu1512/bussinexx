import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Package,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  ArrowDownLeft,
  Store as StoreIcon,
  CreditCard
} from 'lucide-react';
import { api } from '../services/api';
import { Supplier, PurchaseOrder, Product } from '../types';
import { useStore } from '../context/StoreContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { formatINR, formatDate, formatPhone } from '../utils/formatters';

export const SuppliersPage: React.FC = () => {
  const { stores, selectedStoreId } = useStore();
  const [activeTab, setActiveTab] = useState<'suppliers' | 'pos'>('suppliers');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('');

  // Modals
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Supplier Form
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    gstin: '',
    paymentTerms: 'Net 30',
    leadTimeDays: 7,
    notes: '',
  });

  // PO Form
  const [poForm, setPoForm] = useState({
    supplierId: 0,
    storeId: selectedStoreId || (stores[0]?.id || 1),
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    items: [{ productId: 0, quantity: 10, unitCost: 100 }],
    shippingCost: 0,
    taxAmount: 0,
    notes: '',
  });

  // Receive stock form
  const [receivedItems, setReceivedItems] = useState<{ itemId: number; quantityReceived: number; maxQty: number; name: string }[]>([]);
  const [receiveNotes, setReceiveNotes] = useState('');

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentMethod: 'bank_transfer',
    notes: '',
  });

  // Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [suppliersData, posData, prodsData] = await Promise.all([
        api.suppliers.list(search || undefined),
        api.suppliers.listPOs({
          storeId: selectedStoreId || undefined,
          status: poStatusFilter || undefined,
        }),
        api.getProducts(),
      ]);

      setSuppliers(suppliersData);
      setPurchaseOrders(posData);
      setProducts(prodsData);

      if (suppliersData.length > 0 && !poForm.supplierId) {
        setPoForm(prev => ({ ...prev, supplierId: suppliersData[0].id }));
      }
      if (prodsData.length > 0 && poForm.items[0].productId === 0) {
        setPoForm(prev => ({
          ...prev,
          items: [{ productId: prodsData[0].id, quantity: 10, unitCost: prodsData[0].cost_price || 100 }]
        }));
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to load suppliers data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poStatusFilter, selectedStoreId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Supplier CRUD
  const handleOpenCreateSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      gstin: '',
      paymentTerms: 'Net 30',
      leadTimeDays: 7,
      notes: '',
    });
    setSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name,
      contactPerson: s.contact_person || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
      city: s.city || '',
      gstin: s.gstin || '',
      paymentTerms: s.payment_terms || 'Net 30',
      leadTimeDays: s.lead_time_days || 7,
      notes: s.notes || '',
    });
    setSupplierModalOpen(true);
  };

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      showNotification('Supplier name is required', 'error');
      return;
    }

    try {
      if (editingSupplier) {
        await api.suppliers.update(editingSupplier.id, {
          name: supplierForm.name,
          contact_person: supplierForm.contactPerson,
          email: supplierForm.email,
          phone: supplierForm.phone,
          address: supplierForm.address,
          city: supplierForm.city,
          gstin: supplierForm.gstin,
          payment_terms: supplierForm.paymentTerms,
          lead_time_days: Number(supplierForm.leadTimeDays),
          notes: supplierForm.notes,
        });
        showNotification('Supplier updated successfully');
      } else {
        await api.suppliers.create({
          name: supplierForm.name,
          contact_person: supplierForm.contactPerson,
          email: supplierForm.email,
          phone: supplierForm.phone,
          address: supplierForm.address,
          city: supplierForm.city,
          gstin: supplierForm.gstin,
          payment_terms: supplierForm.paymentTerms,
          lead_time_days: Number(supplierForm.leadTimeDays),
          notes: supplierForm.notes,
        });
        showNotification('New supplier registered successfully');
      }
      setSupplierModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Operation failed', 'error');
    }
  };

  const handleDeleteSupplier = async (s: Supplier) => {
    if (!confirm(`Are you sure you want to delete supplier ${s.name}?`)) return;
    try {
      await api.suppliers.delete(s.id);
      showNotification('Supplier removed');
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete supplier', 'error');
    }
  };

  // PO Creation
  const handleOpenCreatePO = () => {
    setPoForm({
      supplierId: suppliers[0]?.id || 0,
      storeId: selectedStoreId || (stores[0]?.id || 1),
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items: [{ productId: products[0]?.id || 0, quantity: 10, unitCost: products[0]?.cost_price || 100 }],
      shippingCost: 0,
      taxAmount: 0,
      notes: '',
    });
    setPoModalOpen(true);
  };

  const handleAddItemToPO = () => {
    setPoForm({
      ...poForm,
      items: [
        ...poForm.items,
        { productId: products[0]?.id || 0, quantity: 10, unitCost: products[0]?.cost_price || 100 }
      ]
    });
  };

  const handleRemoveItemFromPO = (index: number) => {
    if (poForm.items.length <= 1) return;
    setPoForm({
      ...poForm,
      items: poForm.items.filter((_, i) => i !== index)
    });
  };

  const handlePOItemChange = (index: number, field: string, value: any) => {
    const updated = [...poForm.items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'productId') {
      const prod = products.find(p => p.id === Number(value));
      if (prod) {
        updated[index].unitCost = prod.cost_price || 100;
      }
    }
    setPoForm({ ...poForm, items: updated });
  };

  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplierId || poForm.items.some(i => !i.productId || i.quantity <= 0)) {
      showNotification('Please select a valid supplier and line items with quantities', 'error');
      return;
    }

    try {
      const res = await api.suppliers.createPO({
        supplierId: Number(poForm.supplierId),
        storeId: Number(poForm.storeId),
        orderDate: poForm.orderDate,
        expectedDeliveryDate: poForm.expectedDeliveryDate,
        items: poForm.items.map(i => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
        })),
        shippingCost: Number(poForm.shippingCost),
        taxAmount: Number(poForm.taxAmount),
        notes: poForm.notes,
      });
      showNotification(`Purchase Order ${res.po_number} created successfully`);
      setPoModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create purchase order', 'error');
    }
  };

  // Stock Receiving
  const handleOpenReceiveModal = async (po: PurchaseOrder) => {
    try {
      const detailed = await api.suppliers.getPO(po.id);
      setSelectedPO(detailed);
      if (detailed.items) {
        setReceivedItems(
          detailed.items.map(item => ({
            itemId: item.id,
            name: item.product_name,
            quantityReceived: Math.max(0, item.quantity_ordered - item.quantity_received),
            maxQty: item.quantity_ordered - item.quantity_received,
          }))
        );
      }
      setReceiveNotes('');
      setReceiveModalOpen(true);
    } catch (err: any) {
      showNotification(err.message || 'Failed to fetch PO details', 'error');
    }
  };

  const handleConfirmReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    try {
      const payload = receivedItems.map(i => ({
        itemId: i.itemId,
        quantityReceived: Number(i.quantityReceived),
      }));

      const res = await api.suppliers.receiveStock(selectedPO.id, payload, receiveNotes);
      showNotification(res.message || 'Stock received and inventory counts updated!');
      setReceiveModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to receive stock', 'error');
    }
  };

  // PO Payment
  const handleOpenPaymentModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    const balance = po.total_amount - (po.paid_amount || 0);
    setPaymentForm({
      amount: balance,
      paymentMethod: 'bank_transfer',
      notes: `Invoice payment for ${po.po_number}`,
    });
    setPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    try {
      const res = await api.suppliers.recordPayment(
        selectedPO.id,
        Number(paymentForm.amount),
        paymentForm.paymentMethod,
        paymentForm.notes
      );
      showNotification(res.message || 'Supplier payment recorded and synchronized with expenses');
      setPaymentModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to record payment', 'error');
    }
  };

  // Aggregations
  const totalOutstanding = suppliers.reduce((sum, s) => sum + (s.outstanding_balance || 0), 0);
  const activeSuppliersCount = suppliers.filter(s => s.is_active).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-indigo-400" />
            Supplier & Procurement Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Vendor directories, purchase orders, automatic inventory receiving, and synchronized payables
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreateSupplier}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-zinc-400" />
            New Supplier
          </button>
          <button
            onClick={handleOpenCreatePO}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Active Suppliers</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{activeSuppliersCount}</div>
          <div className="text-xs text-zinc-500 mt-1">Vetted vendors on file</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Purchase Orders</span>
            <Package className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{purchaseOrders.length}</div>
          <div className="text-xs text-cyan-400 mt-1">
            {purchaseOrders.filter(p => p.status === 'ordered').length} awaiting delivery
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Accounts Payable</span>
            <DollarSign className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">{formatINR(totalOutstanding)}</div>
          <div className="text-xs text-zinc-500 mt-1">Pending vendor settlements</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Store Target</span>
            <StoreIcon className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-sm font-bold text-white truncate">
            {selectedStoreId ? stores.find(s => s.id === selectedStoreId)?.name : 'All Connected Stores'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Multi-store procurement</div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center border-b border-zinc-800 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'suppliers'
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Suppliers Directory ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab('pos')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'pos'
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Purchase Orders ({purchaseOrders.length})
        </button>
      </div>

      {/* TAB 1: Suppliers Directory */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex items-center justify-between">
            <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search supplier name, city, GSTIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </form>
            <button
              onClick={loadData}
              title="Refresh"
              className="p-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            {loading ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Loading suppliers...</span>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={Truck}
                  title="No suppliers found"
                  description="Register vendors and distributors to start ordering stock and managing payables."
                  actionText="Add Supplier"
                  onAction={handleOpenCreateSupplier}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono tracking-wider">
                      <th className="py-3 px-4">Supplier Name</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">GSTIN & Terms</th>
                      <th className="py-3 px-4">Total Purchases</th>
                      <th className="py-3 px-4">Outstanding</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{s.name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono">
                            {s.contact_person || 'Direct Vendor'} • {s.city || 'India'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-zinc-300">{s.email || '—'}</div>
                          <div className="text-[11px] text-zinc-500 font-mono">{formatPhone(s.phone)}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <div className="text-indigo-400 font-medium">{s.gstin || 'UNREGISTERED'}</div>
                          <div className="text-[10px] text-zinc-500">{s.payment_terms || 'Net 30'} • {s.lead_time_days || 7}d Lead</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-zinc-200">
                          {formatINR(s.total_purchased_amount || 0)}
                          <span className="block text-[10px] text-zinc-500">
                            {s.total_orders_count || 0} orders
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className={s.outstanding_balance && s.outstanding_balance > 0 ? 'text-rose-400 font-bold' : 'text-zinc-500'}>
                            {formatINR(s.outstanding_balance || 0)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditSupplier(s)}
                              title="Edit Supplier"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplier(s)}
                              title="Delete Supplier"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Purchase Orders */}
      {activeTab === 'pos' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Filter Status:</span>
              <select
                value={poStatusFilter}
                onChange={(e) => setPoStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="ordered">Ordered</option>
                <option value="partially_received">Partially Received</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              onClick={loadData}
              title="Refresh"
              className="p-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            {loading ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Loading purchase orders...</span>
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={Package}
                  title="No purchase orders found"
                  description="Create a purchase order to stock inventory across your stores."
                  actionText="Create Purchase Order"
                  onAction={handleOpenCreatePO}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono tracking-wider">
                      <th className="py-3 px-4">PO Number</th>
                      <th className="py-3 px-4">Supplier / Store</th>
                      <th className="py-3 px-4">Order Date</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Stock Status</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                          {po.po_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{po.supplier_name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                            <StoreIcon className="w-3 h-3" />
                            {po.store_name}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300">
                          {formatDate(po.order_date)}
                          {po.expected_delivery_date && (
                            <span className="block text-[10px] text-zinc-500">
                              Exp: {formatDate(po.expected_delivery_date)}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          {formatINR(po.total_amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              po.status === 'received'
                                ? 'emerald'
                                : po.status === 'partially_received'
                                ? 'amber'
                                : po.status === 'ordered'
                                ? 'sky'
                                : 'zinc'
                            }
                          >
                            {po.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              po.payment_status === 'paid'
                                ? 'emerald'
                                : po.payment_status === 'partially_paid'
                                ? 'amber'
                                : 'rose'
                            }
                          >
                            {po.payment_status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">
                            Paid: {formatINR(po.paid_amount || 0)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {po.status !== 'received' && (
                              <button
                                onClick={() => handleOpenReceiveModal(po)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                Receive Stock
                              </button>
                            )}
                            {po.payment_status !== 'paid' && (
                              <button
                                onClick={() => handleOpenPaymentModal(po)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                                Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supplier Create/Edit Modal */}
      <Modal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        title={editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Register New Vendor / Supplier'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitSupplier} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Company / Supplier Name *</label>
              <input
                type="text"
                required
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="Apex Wholesale Distributors"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Contact Person</label>
              <input
                type="text"
                value={supplierForm.contactPerson}
                onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                placeholder="Ramesh Gupta"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Email Address</label>
              <input
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                placeholder="orders@apexdistributors.com"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Phone Number</label>
              <input
                type="text"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                placeholder="9876543210"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">GSTIN Number</label>
              <input
                type="text"
                value={supplierForm.gstin}
                onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value.toUpperCase() })}
                placeholder="29AABCB1234F1Z5"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Payment Terms</label>
              <select
                value={supplierForm.paymentTerms}
                onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                <option value="Immediate">Immediate / Advance</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 60">Net 60 Days</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                value={supplierForm.leadTimeDays}
                onChange={(e) => setSupplierForm({ ...supplierForm, leadTimeDays: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">City</label>
              <input
                type="text"
                value={supplierForm.city}
                onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                placeholder="Mumbai / Bengaluru"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Address</label>
              <input
                type="text"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                placeholder="Plot 45, Industrial Area Phase II"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setSupplierModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {editingSupplier ? 'Save Supplier' : 'Register Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* PO Creation Modal */}
      <Modal
        isOpen={poModalOpen}
        onClose={() => setPoModalOpen(false)}
        title="Create Purchase Order"
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitPO} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Select Supplier *</label>
              <select
                required
                value={poForm.supplierId}
                onChange={(e) => setPoForm({ ...poForm, supplierId: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.payment_terms || 'Net 30'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Receiving Store *</label>
              <select
                required
                value={poForm.storeId}
                onChange={(e) => setPoForm({ ...poForm, storeId: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code || 'STORE'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Order Date *</label>
              <input
                type="date"
                required
                value={poForm.orderDate}
                onChange={(e) => setPoForm({ ...poForm, orderDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={poForm.expectedDeliveryDate}
                onChange={(e) => setPoForm({ ...poForm, expectedDeliveryDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2 p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-300 font-mono uppercase text-[11px]">
                Order Items & Unit Costs
              </span>
              <button
                type="button"
                onClick={handleAddItemToPO}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product Line
              </button>
            </div>

            {poForm.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <select
                    value={item.productId}
                    onChange={(e) => handlePOItemChange(idx, 'productId', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handlePOItemChange(idx, 'quantity', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono text-center"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="0"
                    placeholder="Cost (₹)"
                    value={item.unitCost}
                    onChange={(e) => handlePOItemChange(idx, 'unitCost', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono"
                  />
                </div>
                <div className="col-span-1 text-center">
                  {poForm.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemFromPO(idx)}
                      className="p-1 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setPoModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Issue Purchase Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Stock Modal */}
      {selectedPO && (
        <Modal
          isOpen={receiveModalOpen}
          onClose={() => setReceiveModalOpen(false)}
          title={`Receive Stock: ${selectedPO.po_number}`}
          maxWidth="lg"
        >
          <form onSubmit={handleConfirmReceiveStock} className="space-y-4 text-xs">
            <p className="text-zinc-400">
              Confirm goods receipt into store: <span className="text-white font-bold">{selectedPO.store_name}</span>.
              This updates live product inventory counts and registers stock logs automatically.
            </p>

            <div className="space-y-2 border border-zinc-800 rounded-xl p-3 bg-zinc-950/60">
              {receivedItems.map((item, idx) => (
                <div key={item.itemId} className="flex items-center justify-between py-1.5 border-b border-zinc-800/60 last:border-0">
                  <div className="pr-2">
                    <span className="font-semibold text-zinc-200 block truncate">{item.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Max pending: {item.maxQty} units</span>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min="0"
                      max={item.maxQty}
                      value={item.quantityReceived}
                      onChange={(e) => {
                        const updated = [...receivedItems];
                        updated[idx].quantityReceived = Number(e.target.value);
                        setReceivedItems(updated);
                      }}
                      className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono text-center"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Receipt Notes / Delivery Slip No.</label>
              <input
                type="text"
                placeholder="e.g. Received in good order by Store Keeper"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Verify & Add to Inventory
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Payment Modal */}
      {selectedPO && (
        <Modal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title={`Supplier Payment: ${selectedPO.po_number}`}
          maxWidth="md"
        >
          <form onSubmit={handleConfirmPayment} className="space-y-4 text-xs">
            <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-1">
              <span className="text-zinc-500 uppercase font-mono text-[10px]">Vendor</span>
              <div className="text-sm font-bold text-white">{selectedPO.supplier_name}</div>
              <div className="text-[11px] text-zinc-400 font-mono">
                Total PO: {formatINR(selectedPO.total_amount)} • Remaining: {formatINR(selectedPO.total_amount - (selectedPO.paid_amount || 0))}
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Payment Amount (₹) *</label>
              <input
                type="number"
                min="1"
                max={selectedPO.total_amount - (selectedPO.paid_amount || 0)}
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Payment Method</label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="upi">UPI Corporate</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Petty Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Reference / UTR / Remarks</label>
              <input
                type="text"
                placeholder="UTR ref or bank cheque number"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Record Payment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
export default SuppliersPage;