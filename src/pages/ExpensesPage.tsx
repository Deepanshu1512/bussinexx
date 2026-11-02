import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Tag,
  Calendar,
  CreditCard,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building,
  Store as StoreIcon,
  PieChart,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { api } from '../services/api';
import { Expense, ExpenseCategory, FinancialOverview } from '../types';
import { useStore } from '../context/StoreContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { formatINR, formatDate } from '../utils/formatters';

export const ExpensesPage: React.FC = () => {
  const { stores, selectedStoreId } = useStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [financialOverview, setFinancialOverview] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  // Forms
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    categoryId: 1,
    storeId: selectedStoreId || (stores[0]?.id || 1),
    amount: 1000,
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer' as const,
    paymentStatus: 'paid' as const,
    vendorName: '',
    description: '',
  });

  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    code: '',
    description: '',
  });

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const storeParam = selectedStoreId || undefined;

      const [expensesData, categoriesData, overviewData] = await Promise.all([
        api.expenses.list({
          storeId: storeParam,
          categoryId: categoryFilter ? Number(categoryFilter) : undefined,
          startDate,
          endDate,
        }),
        api.expenses.getCategories(),
        api.expenses.getOverview({
          storeId: storeParam,
          startDate,
          endDate,
        }),
      ]);

      setExpenses(expensesData);
      setCategories(categoriesData);
      setFinancialOverview(overviewData);

      if (categoriesData.length > 0 && !expenseForm.categoryId) {
        setExpenseForm(prev => ({ ...prev, categoryId: categoriesData[0].id }));
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to load expenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, startDate, endDate, selectedStoreId]);

  const handleOpenCreateExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      title: '',
      categoryId: categories[0]?.id || 1,
      storeId: selectedStoreId || (stores[0]?.id || 1),
      amount: 1000,
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      paymentStatus: 'paid',
      vendorName: '',
      description: '',
    });
    setExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseForm({
      title: exp.title,
      categoryId: exp.category_id,
      storeId: exp.store_id || (stores[0]?.id || 1),
      amount: exp.amount,
      expenseDate: exp.expense_date.split('T')[0],
      paymentMethod: exp.payment_method as any,
      paymentStatus: exp.payment_status as any,
      vendorName: exp.vendor_name || '',
      description: exp.description || '',
    });
    setExpenseModalOpen(true);
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title.trim() || expenseForm.amount <= 0) {
      showNotification('Please provide a valid title and positive amount', 'error');
      return;
    }

    try {
      if (editingExpense) {
        await api.expenses.update(editingExpense.id, {
          title: expenseForm.title,
          category_id: Number(expenseForm.categoryId),
          store_id: Number(expenseForm.storeId),
          amount: Number(expenseForm.amount),
          expense_date: expenseForm.expenseDate,
          payment_method: expenseForm.paymentMethod,
          payment_status: expenseForm.paymentStatus,
          vendor_name: expenseForm.vendorName,
          description: expenseForm.description,
        });
        showNotification('Expense updated');
      } else {
        await api.expenses.create({
          title: expenseForm.title,
          category_id: Number(expenseForm.categoryId),
          store_id: Number(expenseForm.storeId),
          amount: Number(expenseForm.amount),
          expense_date: expenseForm.expenseDate,
          payment_method: expenseForm.paymentMethod,
          payment_status: expenseForm.paymentStatus,
          vendor_name: expenseForm.vendorName,
          description: expenseForm.description,
        });
        showNotification('Expense recorded into ledger');
      }
      setExpenseModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Operation failed', 'error');
    }
  };

  const handleDeleteExpense = async (exp: Expense) => {
    if (!confirm(`Are you sure you want to delete expense "${exp.title}"?`)) return;
    try {
      await api.expenses.delete(exp.id);
      showNotification('Expense deleted');
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete expense', 'error');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryData.name.trim()) return;
    try {
      await api.expenses.createCategory(newCategoryData);
      showNotification('Expense category created');
      setNewCategoryData({ name: '', code: '', description: '' });
      setCategoryModalOpen(false);
      const cats = await api.expenses.getCategories();
      setCategories(cats);
    } catch (err: any) {
      showNotification(err.message || 'Failed to create category', 'error');
    }
  };

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
            <Wallet className="w-6 h-6 text-indigo-400" />
            Expenses & Financial Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time operating costs, P&L statement, cash flows, and synchronized payroll/PO settlements
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Tag className="w-4 h-4 text-zinc-400" />
            Categories
          </button>
          <button
            onClick={handleOpenCreateExpense}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Financial Health Summary Cards (P&L) */}
      {financialOverview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium uppercase font-mono tracking-wider">Gross Revenue</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">{formatINR(financialOverview.revenue)}</div>
            <div className="text-xs text-zinc-500 mt-1">
              COGS: {formatINR(financialOverview.cogs)} • Margin: {financialOverview.profit_margin_pct.toFixed(1)}%
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium uppercase font-mono tracking-wider">Operating Expenses</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400">{formatINR(financialOverview.operating_expenses)}</div>
            <div className="text-xs text-zinc-500 mt-1">Includes wages & utilities</div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium uppercase font-mono tracking-wider">Net Profit</span>
              <DollarSign className="w-4 h-4 text-indigo-400" />
            </div>
            <div className={`text-2xl font-bold ${financialOverview.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatINR(financialOverview.net_profit)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Gross Profit {formatINR(financialOverview.gross_profit)} - OpEx
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium uppercase font-mono tracking-wider">Net Cash Flow</span>
              <Wallet className="w-4 h-4 text-cyan-400" />
            </div>
            <div className={`text-2xl font-bold ${financialOverview.cash_flow.net_cash_flow >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {formatINR(financialOverview.cash_flow.net_cash_flow)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              +{formatINR(financialOverview.cash_flow.total_inflows)} / -{formatINR(financialOverview.cash_flow.total_outflows)}
            </div>
          </div>
        </div>
      )}

      {/* Payables vs Receivables Strip */}
      {financialOverview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase font-mono">Accounts Payable (You Owe)</span>
                <p className="text-[11px] text-zinc-400">Pending supplier purchase orders & unpaid bills</p>
              </div>
            </div>
            <div className="text-lg font-bold text-rose-400 font-mono">
              {formatINR(financialOverview.accounts_payable)}
            </div>
          </div>

          <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase font-mono">Accounts Receivable (Owed to You)</span>
                <p className="text-[11px] text-zinc-400">Unsettled customer invoices & store tabs</p>
              </div>
            </div>
            <div className="text-lg font-bold text-emerald-400 font-mono">
              {formatINR(financialOverview.accounts_receivable)}
            </div>
          </div>
        </div>
      )}

      {/* Date & Category Filters */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-700/80">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none"
            />
            <span className="text-zinc-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Expense Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {stores.length > 0 && (
            <span className="text-xs text-zinc-400">
              🏬 {selectedStoreId ? stores.find(s => s.id === selectedStoreId)?.name : 'All Stores'}
            </span>
          )}
          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Loading ledger entries...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Wallet}
              title="No expenses logged for this range"
              description="Record daily expenses like rent, electricity, courier, or supplies."
              actionText="Record Expense"
              onAction={handleOpenCreateExpense}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono tracking-wider">
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Store</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method / Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{exp.title}</div>
                      {exp.vendor_name && (
                        <div className="text-[11px] text-zinc-500 font-mono">
                          Vendor: {exp.vendor_name}
                        </div>
                      )}
                      {exp.reference_type && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-indigo-400 font-mono">
                          Linked to {exp.reference_type} #{exp.reference_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {exp.category_name || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {exp.store_name || 'All Stores'}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                      -{formatINR(exp.amount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={exp.payment_status === 'paid' ? 'emerald' : 'amber'}>
                        {exp.payment_status.toUpperCase()}
                      </Badge>
                      <span className="block text-[10px] text-zinc-500 font-mono mt-0.5 uppercase">
                        {exp.payment_method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {!exp.reference_type ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditExpense(exp)}
                            title="Edit Expense"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp)}
                            title="Delete Expense"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-mono">
                          Auto-synchronized
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record / Edit Expense Modal */}
      <Modal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title={editingExpense ? 'Edit Expense Record' : 'Record Operating Expense'}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmitExpense} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-400 font-medium mb-1">Expense Title / Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Monthly High-Speed Fiber Internet Bill"
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Category *</label>
              <select
                value={expenseForm.categoryId}
                onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Store Allocation *</label>
              <select
                value={expenseForm.storeId}
                onChange={(e) => setExpenseForm({ ...expenseForm, storeId: Number(e.target.value) })}
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
              <label className="block text-zinc-400 font-medium mb-1">Expense Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Expense Date *</label>
              <input
                type="date"
                required
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Payment Method</label>
              <select
                value={expenseForm.paymentMethod}
                onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as any })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                <option value="bank_transfer">Bank Transfer / NEFT</option>
                <option value="upi">UPI</option>
                <option value="card">Corporate Card</option>
                <option value="cash">Petty Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Payment Status</label>
              <select
                value={expenseForm.paymentStatus}
                onChange={(e) => setExpenseForm({ ...expenseForm, paymentStatus: e.target.value as any })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Payee / Vendor Name</label>
            <input
              type="text"
              placeholder="e.g. Airtel Business Broadband / BESCOM"
              value={expenseForm.vendorName}
              onChange={(e) => setExpenseForm({ ...expenseForm, vendorName: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setExpenseModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {editingExpense ? 'Save Changes' : 'Record Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Manager Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Manage Expense Categories"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <form onSubmit={handleCreateCategory} className="space-y-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
            <span className="font-semibold text-zinc-300 font-mono uppercase text-[11px] block">
              Create New Category
            </span>
            <input
              type="text"
              required
              placeholder="Category Name (e.g. Marketing & Advertising)"
              value={newCategoryData.name}
              onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            />
            <input
              type="text"
              placeholder="Short Code (e.g. MKTG)"
              value={newCategoryData.code}
              onChange={(e) => setNewCategoryData({ ...newCategoryData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono"
            />
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category
            </button>
          </form>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {categories.map((c) => (
              <div key={c.id} className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-200 block">{c.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{c.code}</span>
                </div>
                {c.is_system ? (
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    System Core
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500">Custom</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default ExpensesPage;