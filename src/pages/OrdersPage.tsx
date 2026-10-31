import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Ban,
  Package,
  CreditCard,
  Building,
  User,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { Order, Product, Customer } from '../types';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // View Order Modal
  const [viewOrderModalOpen, setViewOrderModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Create Order Wizard Modal
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer' | 'cash' | 'invoice' | 'credit'>('card');
  const [orderStatus, setOrderStatus] = useState<'completed' | 'processing' | 'pending'>('completed');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Order Items in Wizard
  interface OrderItemDraft {
    product_id: number;
    name: string;
    sku: string;
    unit_price: number;
    available_stock: number;
    quantity: number;
  }
  const [draftItems, setDraftItems] = useState<OrderItemDraft[]>([]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [ords, prods, custs] = await Promise.all([
        api.getOrders({
          search: search || undefined,
          status: statusFilter || undefined,
        }),
        api.getProducts({ status: 'active' }),
        api.getCustomers(),
      ]);
      setOrders(ords);
      setProducts(prods);
      setCustomers(custs);
    } catch (err: any) {
      showNotification(err.message || 'Error loading orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleOpenCreateOrder = () => {
    setSelectedCustomerId(customers[0]?.id ? String(customers[0].id) : '');
    setPaymentMethod('card');
    setOrderStatus('completed');
    setDiscountAmount(0);
    setOrderNotes('');
    setDraftItems([]);
    setCreateOrderModalOpen(true);
  };

  const handleAddItemToDraft = (productId: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const existingIndex = draftItems.findIndex((it) => it.product_id === productId);
    if (existingIndex > -1) {
      const updated = [...draftItems];
      if (updated[existingIndex].quantity + 1 > prod.current_stock) {
        showNotification(`Cannot exceed current stock (${prod.current_stock} available).`, 'error');
        return;
      }
      updated[existingIndex].quantity += 1;
      setDraftItems(updated);
    } else {
      if (prod.current_stock <= 0) {
        showNotification(`'${prod.name}' is currently out of stock.`, 'error');
        return;
      }
      setDraftItems([
        ...draftItems,
        {
          product_id: prod.id,
          name: prod.name,
          sku: prod.sku,
          unit_price: prod.selling_price,
          available_stock: prod.current_stock,
          quantity: 1,
        },
      ]);
    }
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveDraftItem(index);
      return;
    }
    const item = draftItems[index];
    if (newQty > item.available_stock) {
      showNotification(`Cannot exceed stock level of ${item.available_stock}.`, 'error');
      return;
    }
    const updated = [...draftItems];
    updated[index].quantity = newQty;
    setDraftItems(updated);
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems(draftItems.filter((_, i) => i !== index));
  };

  // Live Financial Calculations
  const calculatedSubtotal = draftItems.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);
  const validatedDiscount = Math.min(discountAmount, calculatedSubtotal);
  const taxableAmount = Math.max(0, calculatedSubtotal - validatedDiscount);
  const taxRate = 0.085; // 8.5% standard tax
  const calculatedTax = Number((taxableAmount * taxRate).toFixed(2));
  const calculatedTotal = Number((taxableAmount + calculatedTax).toFixed(2));

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draftItems.length === 0) {
      showNotification('Please add at least one product to the order.', 'error');
      return;
    }

    try {
      const payload = {
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
        items: draftItems.map((d) => ({
          product_id: d.product_id,
          quantity: d.quantity,
          unit_price: d.unit_price,
        })),
        payment_method: paymentMethod,
        status: orderStatus,
        discount_amount: validatedDiscount,
        notes: orderNotes,
      };

      const newOrder = await api.createOrder(payload);
      showNotification(`Order '${newOrder.order_number}' placed successfully! Inventory updated.`);
      setCreateOrderModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleViewOrder = async (orderId: number) => {
    try {
      const order = await api.getOrder(orderId);
      setActiveOrder(order);
      setViewOrderModalOpen(true);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    try {
      const updated = await api.updateOrderStatus(orderId, newStatus);
      setActiveOrder(updated);
      showNotification(`Order '${updated.order_number}' marked as ${newStatus}.`);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Sales & Order Fulfillment</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Transaction safety, live pricing calculations, client billing & real-time inventory deductions.
          </p>
        </div>

        <button
          onClick={handleOpenCreateOrder}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Order</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, client, or company..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['', 'completed', 'processing', 'pending', 'cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors capitalize ${
                statusFilter === st
                  ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                  : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
              }`}
            >
              {st === '' ? 'All Orders' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-400">Loading order records...</div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800/60">
                <tr>
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Client & Account</th>
                  <th className="px-6 py-3.5">Date Placed</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-6 py-3.5">Fulfillment</th>
                  <th className="px-6 py-3.5 text-right">Total Amount</th>
                  <th className="px-6 py-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {orders.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => handleViewOrder(ord.id)}
                    className="hover:bg-zinc-900/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-medium text-sky-400">
                      {ord.order_number}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white tracking-tight">
                        {ord.customer_name || 'Walk-in Direct Customer'}
                      </div>
                      {ord.customer_company && (
                        <div className="text-[11px] text-zinc-500">{ord.customer_company}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 font-mono text-[11px]">
                      {ord.created_at.slice(0, 16)}
                    </td>
                    <td className="px-6 py-4 capitalize text-zinc-300">
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                        {ord.payment_method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          ord.status === 'completed'
                            ? 'emerald'
                            : ord.status === 'processing'
                            ? 'sky'
                            : ord.status === 'pending'
                            ? 'amber'
                            : 'rose'
                        }
                        dot
                      >
                        {ord.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-white text-sm">
                      ${ord.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewOrder(ord.id);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="No orders found"
            description="Create your first client purchase order to test automatic inventory deduction."
            actionText="Create Order"
            onAction={handleOpenCreateOrder}
          />
        )}
      </div>

      {/* CREATE ORDER WIZARD MODAL */}
      <Modal
        isOpen={createOrderModalOpen}
        onClose={() => setCreateOrderModalOpen(false)}
        title="Create New Business Order"
        subtitle="Live pricing, stock validation, and instant inventory deduction"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveOrder} className="space-y-6">
          {/* Client Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Select Client Account</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="">Walk-in / Direct Client</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ''} — {c.tier.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="card">Credit Card (Stripe/POS)</option>
                <option value="bank_transfer">ACH / Wire Transfer</option>
                <option value="invoice">Net 30 Enterprise Invoice</option>
                <option value="cash">Cash Settlement</option>
              </select>
            </div>
          </div>

          {/* Product Line Item Picker */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Add Products to Order</label>
            <div className="flex gap-2">
              <select
                id="productSelector"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItemToDraft(Number(e.target.value));
                    e.target.value = '';
                  }
                }}
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="">-- Choose a product from catalog to add line item --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.current_stock <= 0}>
                    {p.name} (${p.selling_price.toFixed(2)}) — {p.current_stock} in stock
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Order Items Table */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
            {draftItems.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5">Item</th>
                    <th className="px-4 py-2.5">Price</th>
                    <th className="px-4 py-2.5">Qty</th>
                    <th className="px-4 py-2.5 text-right">Subtotal</th>
                    <th className="px-4 py-2.5 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {draftItems.map((item, idx) => (
                    <tr key={item.product_id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="font-mono text-[10px] text-zinc-500">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-300">
                        ${item.unit_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max={item.available_stock}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-center text-xs text-white font-mono"
                          />
                          <span className="text-[10px] text-zinc-500">max {item.available_stock}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-white">
                        ${(item.unit_price * item.quantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftItem(idx)}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-xs text-zinc-500">
                No items added yet. Select products above to populate this order.
              </div>
            )}
          </div>

          {/* Pricing Summary */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Items Subtotal:</span>
              <span className="font-mono font-semibold text-white">${calculatedSubtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Discount ($):</span>
              <input
                type="number"
                min="0"
                max={calculatedSubtotal}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-24 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-right text-xs text-white font-mono"
              />
            </div>

            <div className="flex justify-between text-xs text-zinc-400">
              <span>Sales Tax (8.5%):</span>
              <span className="font-mono text-zinc-300">${calculatedTax.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm font-bold text-white">
              <span>Grand Total:</span>
              <span className="font-mono text-sky-400 text-base">${calculatedTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes and Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Order Status</label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="completed">Completed (Fulfill & Deduct Stock Now)</option>
                <option value="processing">Processing (Deduct Stock, Awaiting Delivery)</option>
                <option value="pending">Pending (Hold Order, Do Not Deduct Stock)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Internal Order Notes</label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Purchase order ref, delivery gate code..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setCreateOrderModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={draftItems.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
            >
              Confirm & Place Order (${calculatedTotal.toFixed(2)})
            </button>
          </div>
        </form>
      </Modal>

      {/* VIEW ORDER RECEIPT MODAL */}
      <Modal
        isOpen={viewOrderModalOpen}
        onClose={() => setViewOrderModalOpen(false)}
        title={activeOrder ? `Order Receipt — ${activeOrder.order_number}` : 'Order Details'}
        subtitle="Transaction summary and fulfillment ledger"
        maxWidth="xl"
      >
        {activeOrder && (
          <div className="space-y-6">
            {/* Top Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-500 block">Status</span>
                <span className="font-semibold text-white capitalize mt-0.5 block">
                  {activeOrder.status}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Payment</span>
                <span className="font-semibold text-white capitalize mt-0.5 block">
                  {activeOrder.payment_method.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Date</span>
                <span className="font-mono text-zinc-300 mt-0.5 block">
                  {activeOrder.created_at.slice(0, 10)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Total</span>
                <span className="font-mono font-bold text-sky-400 mt-0.5 block">
                  ${activeOrder.total_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
              <div className="font-semibold text-white flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-sky-400" />
                {activeOrder.customer_name || 'Walk-in Client'}
              </div>
              {activeOrder.customer_company && (
                <div className="text-zinc-400 flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-zinc-500" />
                  {activeOrder.customer_company}
                </div>
              )}
              {activeOrder.customer_address && (
                <div className="text-zinc-500 mt-1">{activeOrder.customer_address}</div>
              )}
            </div>

            {/* Line Items */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5">Item</th>
                    <th className="px-4 py-2.5">Unit Price</th>
                    <th className="px-4 py-2.5">Qty</th>
                    <th className="px-4 py-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {activeOrder.items?.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{it.product_name}</div>
                        <div className="font-mono text-[10px] text-zinc-500">{it.product_sku}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-300">${it.unit_price.toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{it.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-white">
                        ${it.line_total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Breakdown */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-mono text-white">${activeOrder.subtotal.toFixed(2)}</span>
              </div>
              {activeOrder.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount:</span>
                  <span className="font-mono">-${activeOrder.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-400">
                <span>Tax:</span>
                <span className="font-mono text-zinc-300">${activeOrder.tax_amount.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-zinc-800 flex justify-between text-sm font-bold text-white">
                <span>Total Amount:</span>
                <span className="font-mono text-sky-400 text-base">${activeOrder.total_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Status Transition Action Buttons */}
            <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">Update Fulfillment State:</span>
              <div className="flex items-center gap-2">
                {activeOrder.status !== 'completed' && (
                  <button
                    onClick={() => handleUpdateStatus(activeOrder.id, 'completed')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                  >
                    Mark Fulfilled & Completed
                  </button>
                )}
                {activeOrder.status !== 'processing' && (
                  <button
                    onClick={() => handleUpdateStatus(activeOrder.id, 'processing')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition-colors"
                  >
                    Mark Processing
                  </button>
                )}
                {activeOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => handleUpdateStatus(activeOrder.id, 'cancelled')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors"
                  >
                    Cancel Order (Restock)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
