import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  Edit2,
  Trash2,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Package,
  Layers,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { api } from '../services/api';
import { Product, Category } from '../types';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';

export const InventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Restock Inventory');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Form State for Create/Edit Product
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category_id: '',
    cost_price: '',
    selling_price: '',
    current_stock: '',
    min_stock_threshold: '10',
    status: 'active' as 'active' | 'draft' | 'archived',
    description: '',
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        api.getProducts({
          search: search || undefined,
          category_id: selectedCategory,
          low_stock: stockFilter === 'low' ? true : undefined,
        }),
        api.getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err: any) {
      showNotification(err.message || 'Error fetching inventory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedCategory, stockFilter]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      category_id: categories[0]?.id ? String(categories[0].id) : '',
      cost_price: '',
      selling_price: '',
      current_stock: '10',
      min_stock_threshold: '5',
      status: 'active',
      description: '',
    });
    setProductModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      name: p.name,
      category_id: p.category_id ? String(p.category_id) : '',
      cost_price: String(p.cost_price),
      selling_price: String(p.selling_price),
      current_stock: String(p.current_stock),
      min_stock_threshold: String(p.min_stock_threshold),
      status: p.status,
      description: p.description || '',
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.name || !formData.sku) {
        showNotification('Name and SKU are required', 'error');
        return;
      }

      const payload = {
        sku: formData.sku,
        name: formData.name,
        category_id: formData.category_id ? Number(formData.category_id) : null,
        cost_price: Number(formData.cost_price) || 0,
        selling_price: Number(formData.selling_price) || 0,
        current_stock: Number(formData.current_stock) || 0,
        min_stock_threshold: Number(formData.min_stock_threshold) || 10,
        status: formData.status,
        description: formData.description,
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
        showNotification(`Product '${payload.name}' updated successfully!`);
      } else {
        await api.createProduct(payload);
        showNotification(`New product '${payload.name}' created!`);
      }

      setProductModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete or archive '${name}'?`)) return;
    try {
      const res = await api.deleteProduct(id);
      showNotification(res.message);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleOpenAdjust = (p: Product) => {
    setSelectedProductForAdjust(p);
    setAdjustQty(0);
    setAdjustReason('Restock Inventory');
    setAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust) return;
    if (adjustQty === 0) {
      showNotification('Quantity adjustment must not be zero.', 'error');
      return;
    }

    try {
      await api.adjustStock(selectedProductForAdjust.id, adjustQty, adjustReason);
      showNotification(
        `Stock adjusted by ${adjustQty > 0 ? `+${adjustQty}` : adjustQty} units for '${selectedProductForAdjust.name}'.`
      );
      setAdjustModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.createCategory(newCatName.trim(), newCatDesc.trim());
      showNotification(`Category '${newCatName}' created!`);
      setNewCatName('');
      setNewCatDesc('');
      setCategoryModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Filtered view logic for out of stock
  const displayedProducts = products.filter((p) => {
    if (stockFilter === 'out') return p.current_stock === 0;
    return true;
  });

  // Calculate quick metrics
  const totalStockCount = products.reduce((acc, p) => acc + p.current_stock, 0);
  const lowStockCount = products.filter((p) => p.current_stock <= p.min_stock_threshold).length;
  const totalCostValue = products.reduce((acc, p) => acc + p.current_stock * p.cost_price, 0);

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Inventory Management</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time catalog oversight, SKU pricing, automated stock thresholds & auditing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
          >
            <Layers className="w-4 h-4 text-zinc-400" />
            <span>Categories</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Top Inventory Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <p className="text-xs text-zinc-400 font-medium">Active SKUs</p>
          <p className="text-xl font-bold text-white font-mono mt-1">{products.length}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <p className="text-xs text-zinc-400 font-medium">Total Units on Hand</p>
          <p className="text-xl font-bold text-sky-400 font-mono mt-1">{totalStockCount.toLocaleString()}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <p className="text-xs text-zinc-400 font-medium">Low Stock Alerts</p>
          <p className={`text-xl font-bold font-mono mt-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {lowStockCount}
          </p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <p className="text-xs text-zinc-400 font-medium">Inventory Asset Value</p>
          <p className="text-xl font-bold text-white font-mono mt-1">
            ${totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
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
            placeholder="Search by name, SKU, or specs..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-sky-500/50"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Stock Filter Pills */}
          <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800 text-xs">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                stockFilter === 'all' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                stockFilter === 'low' ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                stockFilter === 'out' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-400">Loading catalog items...</div>
        ) : displayedProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800/60">
                <tr>
                  <th className="px-6 py-3.5">SKU & Product</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Unit Cost</th>
                  <th className="px-6 py-3.5">Selling Price</th>
                  <th className="px-6 py-3.5">Stock Level</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {displayedProducts.map((p) => {
                  const isLow = p.current_stock <= p.min_stock_threshold && p.current_stock > 0;
                  const isOut = p.current_stock === 0;

                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white tracking-tight">{p.name}</div>
                        <div className="font-mono text-[11px] text-sky-400/80 mt-0.5">{p.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {p.category_name || <span className="text-zinc-600">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-400">
                        ${p.cost_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-white">
                        ${p.selling_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {p.current_stock}
                          </span>
                          <span className="text-zinc-500 text-[10px]">/ min {p.min_stock_threshold}</span>
                          {isLow && (
                            <Badge variant="amber" size="sm">
                              Low
                            </Badge>
                          )}
                          {isOut && (
                            <Badge variant="rose" size="sm">
                              Out
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            p.status === 'active'
                              ? 'emerald'
                              : p.status === 'draft'
                              ? 'zinc'
                              : 'rose'
                          }
                          dot
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            title="Adjust Stock Qty"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Product Details"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            title="Delete / Archive Product"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="No products found"
            description="Adjust your search criteria or add new items to your catalog."
            actionText="+ Add Product"
            onAction={handleOpenAdd}
          />
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        subtitle="Manage product specifications, pricing, and stock thresholds"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Product SKU *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. HW-MBP-16"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dell UltraSharp 27 4K"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="">Unassigned</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Catalog Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="active">Active (Available for Sale)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Unit Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Current Stock Count</label>
              <input
                type="number"
                min="0"
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                placeholder="10"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Min Safety Threshold</label>
              <input
                type="number"
                min="0"
                value={formData.min_stock_threshold}
                onChange={(e) => setFormData({ ...formData, min_stock_threshold: e.target.value })}
                placeholder="5"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Hardware specifications, warranty info, or vendor lead times..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setProductModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
            >
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Adjust Inventory Stock"
        subtitle={`Audit update for '${selectedProductForAdjust?.name}'`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveAdjust} className="space-y-4">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-400">Current Stock:</span>
            <span className="text-sm font-bold font-mono text-white">
              {selectedProductForAdjust?.current_stock} units
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Quantity Adjustment (+ or -)
            </label>
            <input
              type="number"
              required
              value={adjustQty}
              onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
              placeholder="e.g. +10 or -3"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              New stock will be:{' '}
              <strong className="text-sky-400">
                {(selectedProductForAdjust?.current_stock || 0) + adjustQty} units
              </strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Reason for Adjustment</label>
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
            >
              <option value="Restock Inventory">Vendor Restock / Delivery</option>
              <option value="Physical Audit Discrepancy">Physical Audit Discrepancy</option>
              <option value="Damaged Goods Write-off">Damaged / Defective Write-off</option>
              <option value="Customer Return">Customer Return</option>
              <option value="Internal Use">Internal Use</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setAdjustModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Manager Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Category Manager"
        subtitle="Manage product categories and department taxonomies"
        maxWidth="lg"
      >
        <div className="space-y-6">
          <form onSubmit={handleCreateCategory} className="space-y-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">Add New Category</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category Name..."
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Short description..."
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all cursor-pointer"
            >
              + Create Category
            </button>
          </form>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-zinc-400 font-mono uppercase tracking-wider">Existing Categories</h4>
            <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
              {categories.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">{c.name}</span>
                    {c.description && <p className="text-[11px] text-zinc-500">{c.description}</p>}
                  </div>
                  <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                    {c.product_count || 0} products
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
