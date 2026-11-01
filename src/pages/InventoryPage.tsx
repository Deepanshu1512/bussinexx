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
  ArrowRightLeft,
  FileSpreadsheet,
  Upload,
  Download,
  History,
  Barcode,
  Store as StoreIcon
} from 'lucide-react';
import { api } from '../services/api';
import { Product, Category, StockLog, Store } from '../types';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useStore } from '../context/StoreContext';
import { formatINR, formatDateTime } from '../utils/formatters';

export const InventoryPage: React.FC = () => {
  const { stores, selectedStoreId, currentStore } = useStore();
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

  // Stock Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferSourceStore, setTransferSourceStore] = useState<number | ''>('');
  const [transferDestStore, setTransferDestStore] = useState<number | ''>('');
  const [transferProduct, setTransferProduct] = useState<number | ''>('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Stock Audit History Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // CSV Import Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ importedCount: number; errors: string[] } | null>(null);

  // Form State for Create/Edit Product
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    category_id: '',
    cost_price: '',
    selling_price: '',
    current_stock: '',
    min_stock_threshold: '10',
    status: 'active' as 'active' | 'draft' | 'archived',
    description: '',
    store_id: ''
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
          store_id: selectedStoreId || undefined,
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
  }, [search, selectedCategory, stockFilter, selectedStoreId]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: '',
      name: '',
      category_id: categories[0]?.id ? String(categories[0].id) : '',
      cost_price: '',
      selling_price: '',
      current_stock: '10',
      min_stock_threshold: '5',
      status: 'active',
      description: '',
      store_id: selectedStoreId ? String(selectedStoreId) : (stores[0]?.id ? String(stores[0].id) : '')
    });
    setProductModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      category_id: p.category_id ? String(p.category_id) : '',
      cost_price: String(p.cost_price),
      selling_price: String(p.selling_price),
      current_stock: String(p.current_stock),
      min_stock_threshold: String(p.min_stock_threshold),
      status: p.status,
      description: p.description || '',
      store_id: selectedStoreId ? String(selectedStoreId) : ''
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
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim() || undefined,
        name: formData.name.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        cost_price: Number(formData.cost_price) || 0,
        selling_price: Number(formData.selling_price) || 0,
        current_stock: Number(formData.current_stock) || 0,
        min_stock_threshold: Number(formData.min_stock_threshold) || 10,
        status: formData.status,
        description: formData.description.trim(),
        store_id: formData.store_id ? Number(formData.store_id) : (selectedStoreId || undefined)
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
    if (!window.confirm(`Are you sure you want to delete '${name}'? This action cannot be undone.`)) return;
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
      await api.adjustStock(selectedProductForAdjust.id, adjustQty, adjustReason, selectedStoreId || undefined);
      showNotification(
        `Stock adjusted by ${adjustQty > 0 ? `+${adjustQty}` : adjustQty} units for '${selectedProductForAdjust.name}'.`
      );
      setAdjustModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleOpenTransfer = (p?: Product) => {
    if (stores.length < 2) {
      showNotification('You need at least 2 registered stores to transfer inventory.', 'error');
      return;
    }
    setTransferSourceStore(selectedStoreId || stores[0].id);
    const dest = stores.find(s => s.id !== (selectedStoreId || stores[0].id));
    setTransferDestStore(dest ? dest.id : stores[1].id);
    setTransferProduct(p ? p.id : (products[0]?.id || ''));
    setTransferQty(1);
    setTransferNotes('');
    setTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceStore || !transferDestStore || !transferProduct || transferQty <= 0) {
      showNotification('Please fill all transfer fields with valid quantities.', 'error');
      return;
    }
    if (transferSourceStore === transferDestStore) {
      showNotification('Source and destination store must be different.', 'error');
      return;
    }

    setTransferLoading(true);
    try {
      await api.stores.transferStock({
        source_store_id: Number(transferSourceStore),
        destination_store_id: Number(transferDestStore),
        product_id: Number(transferProduct),
        quantity: Number(transferQty),
        notes: transferNotes
      });
      showNotification('Inter-store stock transfer completed successfully!');
      setTransferModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Stock transfer failed.', 'error');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleOpenAuditLogs = async () => {
    setAuditModalOpen(true);
    setAuditLoading(true);
    try {
      const logs = await api.getStockLogs(selectedStoreId || undefined);
      setStockLogs(logs || []);
    } catch (err: any) {
      showNotification(err.message || 'Unable to load stock history.', 'error');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const csvData = await api.exportProductsCSV(selectedStoreId || undefined);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `inventory-${currentStore ? currentStore.name.toLowerCase().replace(/\s+/g, '-') : 'all'}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Inventory CSV exported successfully!');
    } catch (err: any) {
      showNotification(err.message || 'Failed to export CSV.', 'error');
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) {
      showNotification('Please provide CSV content to import.', 'error');
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importProductsCSV(csvContent, selectedStoreId || undefined);
      setImportResult(res);
      if (res.importedCount > 0) {
        showNotification(`Successfully processed ${res.importedCount} products.`);
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'Import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(String(event.target?.result || ''));
    };
    reader.readAsText(file);
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Inventory Management</h1>
            {currentStore ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                🏬 {currentStore.name}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                🏬 Consolidated (All Stores)
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time stock tracking, multi-store transfers, barcode management & audit history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Transfer Stock Button */}
          {stores.length > 1 && (
            <button
              onClick={() => handleOpenTransfer()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-indigo-400 border border-zinc-800 transition-colors"
              title="Transfer stock between stores"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Transfer Stock</span>
            </button>
          )}

          {/* Audit Logs Button */}
          <button
            onClick={handleOpenAuditLogs}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
            title="View Stock Movement Audit Trail"
          >
            <History className="w-4 h-4 text-zinc-400" />
            <span>Audit Trail</span>
          </button>

          {/* CSV Import/Export */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>Export</span>
          </button>

          <button
            onClick={() => { setImportModalOpen(true); setImportResult(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
            title="Import CSV"
          >
            <Upload className="w-4 h-4 text-zinc-400" />
            <span>Import</span>
          </button>

          <button
            onClick={() => setCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
          >
            <Layers className="w-4 h-4 text-zinc-400" />
            <span>Categories</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Top Inventory Metrics Strip (Formatted in INR) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <p className="text-xs text-zinc-400 font-medium">Catalog SKUs</p>
          <p className="text-xl font-bold text-white font-mono mt-1">{products.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <p className="text-xs text-zinc-400 font-medium">Total Units on Hand</p>
          <p className="text-xl font-bold text-indigo-400 font-mono mt-1">{totalStockCount.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <p className="text-xs text-zinc-400 font-medium">Low Stock Alerts</p>
          <p className={`text-xl font-bold font-mono mt-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {lowStockCount}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <p className="text-xs text-zinc-400 font-medium">Inventory Asset Value</p>
          <p className="text-xl font-bold text-white font-mono mt-1">
            {formatINR(totalCostValue)}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown */}
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Stock Filter Pills */}
          <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-xs">
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
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-400">Loading catalog items...</div>
        ) : displayedProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800">
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
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {displayedProducts.map((p) => {
                  const isLow = p.current_stock <= p.min_stock_threshold && p.current_stock > 0;
                  const isOut = p.current_stock === 0;

                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white tracking-tight">{p.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-indigo-400">{p.sku}</span>
                          {p.barcode && (
                            <span className="font-mono text-[10px] text-zinc-500 flex items-center gap-0.5">
                              <Barcode className="w-3 h-3" />
                              {p.barcode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {p.category_name || <span className="text-zinc-600">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-400">
                        {formatINR(p.cost_price)}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-white">
                        {formatINR(p.selling_price)}
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
                          {stores.length > 1 && (
                            <button
                              onClick={() => handleOpenTransfer(p)}
                              title="Transfer Stock to Another Store"
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            title="Adjust Stock Quantity"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
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
                            title="Delete Product"
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
            description="Your inventory is empty. Add new products or import via CSV to start tracking inventory."
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
                placeholder="e.g. ELEC-LAPTOP-01"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Barcode / EAN</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="e.g. 8901234567890"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Dell UltraSharp 27 4K Monitor"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
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
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="active">Active (Available for Sale)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Unit Cost Price (₹ INR)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Selling Price (₹ INR)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
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
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
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
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Specifications, warranty terms, or vendor details..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
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
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
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
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              New stock will be:{' '}
              <strong className="text-indigo-400">
                {(selectedProductForAdjust?.current_stock || 0) + adjustQty} units
              </strong>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Reason for Adjustment</label>
            <select
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
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
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Inter-Store Stock Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Inter-Store Stock Transfer"
        subtitle="Transfer physical inventory securely between business branches"
        maxWidth="lg"
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">From Store (Source) *</label>
              <select
                required
                value={transferSourceStore}
                onChange={(e) => setTransferSourceStore(Number(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏬 {s.name} {s.city ? `(${s.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">To Store (Destination) *</label>
              <select
                required
                value={transferDestStore}
                onChange={(e) => setTransferDestStore(Number(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏬 {s.name} {s.city ? `(${s.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Select Product *</label>
              <select
                required
                value={transferProduct}
                onChange={(e) => setTransferProduct(Number(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Stock: {p.current_stock}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Transfer Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={transferQty}
                onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Dispatch / Transit Notes</label>
            <input
              type="text"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              placeholder="e.g. Branch restocking order #409, shipped via internal courier"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setTransferModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer disabled:opacity-50"
            >
              {transferLoading ? 'Transferring...' : 'Execute Transfer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Audit History Modal */}
      <Modal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        title="Stock Movement Audit Trail"
        subtitle="Complete immutable transaction log of stock changes across all stores"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {auditLoading ? (
            <div className="py-12 text-center text-xs text-zinc-400">Loading audit records...</div>
          ) : stockLogs.length > 0 ? (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Date & Time</th>
                    <th className="px-4 py-2.5">Store</th>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">Change</th>
                    <th className="px-4 py-2.5">Balance</th>
                    <th className="px-4 py-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {stockLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-900/60">
                      <td className="px-4 py-3 font-mono text-zinc-400 text-[11px]">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {log.store_name || 'Primary Store'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-white block">{log.product_name}</span>
                        <span className="font-mono text-[10px] text-zinc-500">{log.product_sku}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">
                        <span className={log.change_qty > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-white">
                        {log.new_stock}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-[11px]">
                        {log.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-zinc-500">
              No stock movements recorded yet. All changes are logged automatically upon orders and adjustments.
            </div>
          )}
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Inventory via CSV"
        subtitle="Batch upload or update products using standard CSV format"
        maxWidth="lg"
      >
        <form onSubmit={handleImportCSV} className="space-y-4">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <p className="text-xs text-zinc-300 font-medium">Expected CSV Columns:</p>
            <p className="text-[11px] font-mono text-indigo-400">
              sku, name, cost_price, selling_price, current_stock, min_stock_threshold, barcode
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Choose CSV File</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Or Paste CSV Data Directly</label>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="sku,name,cost_price,selling_price,current_stock,min_stock_threshold,barcode&#10;LAPTOP-01,Pro Laptop 15,45000,55000,20,5,8901234567890"
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          {importResult && (
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
              <p className="text-xs text-emerald-400 font-semibold">
                Successfully imported {importResult.importedCount} items!
              </p>
              {importResult.errors.length > 0 && (
                <div className="text-[11px] text-rose-400 space-y-0.5">
                  <p className="font-semibold">Import warnings:</p>
                  {importResult.errors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setImportModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={importing || !csvContent.trim()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer disabled:opacity-50"
            >
              {importing ? 'Processing CSV...' : 'Start Import'}
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
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Short description..."
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer"
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

export default InventoryPage;
