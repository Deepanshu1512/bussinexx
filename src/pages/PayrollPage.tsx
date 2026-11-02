import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  DollarSign,
  TrendingUp,
  Download,
  Building,
  Edit2,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Eye,
  Store as StoreIcon
} from 'lucide-react';
import { api } from '../services/api';
import { Payroll, PayrollItem, SalarySlip } from '../types';
import { useStore } from '../context/StoreContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { formatINR, formatDate, formatPhone } from '../utils/formatters';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const PayrollPage: React.FC = () => {
  const { stores, selectedStoreId } = useStore();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);

  // Month & Year Filter / Generator
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Calculation / Run Wizard
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [calculatedPayroll, setCalculatedPayroll] = useState<any | null>(null);
  const [runNotes, setRunNotes] = useState('');
  const [calculating, setCalculating] = useState(false);

  // Item Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<PayrollItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    bonus: 0,
    allowances: 0,
    deductions: 0,
    advanceDeduction: 0,
  });

  // Disbursement Modal
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [disburseMethod, setDisburseMethod] = useState<'bank_transfer' | 'upi' | 'cheque' | 'cash'>('bank_transfer');
  const [disburseNotes, setDisburseNotes] = useState('');

  // Salary Slip Modal
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [activeSalarySlip, setActiveSalarySlip] = useState<SalarySlip | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadPayrolls = async () => {
    try {
      setLoading(true);
      const data = await api.payroll.list({
        storeId: selectedStoreId || undefined,
        year: selectedYear,
      });
      setPayrolls(data);

      if (data.length > 0) {
        // Fetch detailed items of the first one if not set
        const detailed = await api.payroll.get(data[0].id);
        setSelectedPayroll(detailed);
      } else {
        setSelectedPayroll(null);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to load payroll batches', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrolls();
  }, [selectedYear, selectedStoreId]);

  const handleSelectBatch = async (batchId: number) => {
    try {
      const detailed = await api.payroll.get(batchId);
      setSelectedPayroll(detailed);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load payroll details', 'error');
    }
  };

  const handleOpenRunWizard = async () => {
    try {
      setCalculating(true);
      setRunModalOpen(true);
      const res = await api.payroll.calculate(selectedMonth, selectedYear, selectedStoreId || undefined);
      setCalculatedPayroll(res);
      setRunNotes(`Payroll calculation for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`);
    } catch (err: any) {
      showNotification(err.message || 'Calculation failed', 'error');
      setRunModalOpen(false);
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!calculatedPayroll) return;
    try {
      const res = await api.payroll.generate({
        month: selectedMonth,
        year: selectedYear,
        storeId: selectedStoreId || undefined,
        notes: runNotes,
        items: calculatedPayroll.items,
      });
      showNotification(res.message || 'Payroll finalized and locked');
      setRunModalOpen(false);
      loadPayrolls();
    } catch (err: any) {
      showNotification(err.message || 'Failed to generate payroll batch', 'error');
    }
  };

  const handleOpenAdjust = (item: PayrollItem) => {
    setAdjustingItem(item);
    setAdjustForm({
      bonus: item.bonus,
      allowances: item.allowances,
      deductions: item.deductions,
      advanceDeduction: item.advance_deduction,
    });
    setAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    try {
      await api.payroll.updateItem(adjustingItem.id, {
        bonus: Number(adjustForm.bonus),
        allowances: Number(adjustForm.allowances),
        deductions: Number(adjustForm.deductions),
        advance_deduction: Number(adjustForm.advanceDeduction),
      });
      showNotification('Payroll item adjustments updated');
      setAdjustModalOpen(false);
      if (selectedPayroll) handleSelectBatch(selectedPayroll.id);
    } catch (err: any) {
      showNotification(err.message || 'Failed to update adjustments', 'error');
    }
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayroll) return;
    try {
      const res = await api.payroll.disburse(selectedPayroll.id, disburseMethod, disburseNotes);
      showNotification(res.message || 'Payroll disbursed! Synchronized with expense registers.');
      setDisburseModalOpen(false);
      loadPayrolls();
    } catch (err: any) {
      showNotification(err.message || 'Disbursement failed', 'error');
    }
  };

  const handleViewSalarySlip = async (itemId: number) => {
    try {
      const slip = await api.payroll.getSalarySlip(itemId);
      setActiveSalarySlip(slip);
      setSlipModalOpen(true);
    } catch (err: any) {
      showNotification(err.message || 'Failed to generate salary slip', 'error');
    }
  };

  const handlePrintSlip = () => {
    window.print();
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

      {/* Header & Payroll Generation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-indigo-400" />
            Salary & Payroll Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Automated attendance-based calculations, overtime bonuses, salary slip PDFs and unified expense logging
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenRunWizard}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Run Monthly Payroll
          </button>
        </div>
      </div>

      {/* Year & Store Filters */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span className="text-xs text-zinc-400">Payroll Cycle:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white"
          >
            {[2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
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
            onClick={loadPayrolls}
            title="Refresh"
            className="p-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Batch Overview & Detailed List */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Payroll Batches Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase font-mono tracking-wider px-1">
            Payroll Batches ({selectedYear})
          </h3>
          {payrolls.length === 0 ? (
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-500 text-center">
              No payroll batches found for {selectedYear}. Click "Run Monthly Payroll" to compute.
            </div>
          ) : (
            payrolls.map((p) => {
              const isSelected = selectedPayroll?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectBatch(p.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-800/90 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-xs">
                      {MONTH_NAMES[p.month - 1]} {p.year}
                    </span>
                    <Badge variant={p.status === 'paid' ? 'emerald' : 'amber'}>
                      {p.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    {p.employee_count || (p.items ? p.items.length : 0)} Employees
                  </div>
                  <div className="text-sm font-bold text-indigo-400 mt-1">
                    {formatINR(p.total_net_salary)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Batch Details */}
        <div className="lg:col-span-3 space-y-4">
          {selectedPayroll ? (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 backdrop-blur-sm space-y-5">
              {/* Batch Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      Payroll Batch: {MONTH_NAMES[selectedPayroll.month - 1]} {selectedPayroll.year}
                    </h2>
                    <Badge variant={selectedPayroll.status === 'paid' ? 'emerald' : 'amber'}>
                      {selectedPayroll.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Store: {selectedPayroll.store_name || 'All Stores'} • Created on {formatDate(selectedPayroll.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedPayroll.status !== 'paid' && (
                    <button
                      onClick={() => setDisburseModalOpen(true)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      Disburse & Log Expense
                    </button>
                  )}
                  {selectedPayroll.status === 'paid' && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4" />
                      Disbursed on {formatDate(selectedPayroll.payment_date)}
                    </span>
                  )}
                </div>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Gross Wages</span>
                  <div className="text-lg font-bold text-white mt-0.5">{formatINR(selectedPayroll.total_gross_salary)}</div>
                </div>
                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Total Deductions</span>
                  <div className="text-lg font-bold text-rose-400 mt-0.5">-{formatINR(selectedPayroll.total_deductions)}</div>
                </div>
                <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Net Payout Liability</span>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">{formatINR(selectedPayroll.total_net_salary)}</div>
                </div>
              </div>

              {/* Employee Breakdown Table */}
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 uppercase font-mono tracking-wider">
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Base</th>
                      <th className="py-2.5 px-3">Attendance</th>
                      <th className="py-2.5 px-3">OT Pay</th>
                      <th className="py-2.5 px-3">Bonus/Allow.</th>
                      <th className="py-2.5 px-3">Deductions</th>
                      <th className="py-2.5 px-3">Net Take-Home</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {selectedPayroll.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{item.employee_name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {item.employee_code} • {item.designation}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-300">
                          {formatINR(item.base_salary)}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <div className="text-emerald-400 text-[11px]">{item.present_days} Pres.</div>
                          <div className="text-zinc-500 text-[10px]">{item.absent_days} Abs. / {item.unpaid_leave_days} LWP</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-indigo-400">
                          {formatINR(item.overtime_pay)}
                          <span className="block text-[10px] text-zinc-500">({item.overtime_hours}h)</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-cyan-400">
                          +{formatINR(item.bonus + item.allowances)}
                        </td>
                        <td className="py-3 px-3 font-mono text-rose-400">
                          -{formatINR(item.deductions + item.advance_deduction)}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-white">
                          {formatINR(item.net_salary)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {selectedPayroll.status !== 'paid' && (
                              <button
                                onClick={() => handleOpenAdjust(item)}
                                title="Adjust Incentives / Deductions"
                                className="p-1 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleViewSalarySlip(item.id)}
                              title="Generate Official Salary Slip"
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-indigo-400" />
                              Slip
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-center">
              <EmptyState
                icon={CreditCard}
                title="No batch selected"
                description="Select a payroll batch from the sidebar or click 'Run Monthly Payroll' to calculate wages."
                actionText="Run Monthly Payroll"
                onAction={handleOpenRunWizard}
              />
            </div>
          )}
        </div>
      </div>

      {/* Run Payroll Calculation Preview Modal */}
      <Modal
        isOpen={runModalOpen}
        onClose={() => setRunModalOpen(false)}
        title={`Preview Payroll Calculation: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
        maxWidth="3xl"
      >
        {calculating ? (
          <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Computing attendance, shifts, overtime and leave balances...</span>
          </div>
        ) : calculatedPayroll ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 p-3.5 bg-zinc-900 rounded-xl border border-zinc-800">
              <div>
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Employees Scanned</span>
                <span className="text-base font-bold text-white block">{calculatedPayroll.employee_count}</span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Total Gross</span>
                <span className="text-base font-bold text-white block">{formatINR(calculatedPayroll.total_gross_salary)}</span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Net Payout Estimated</span>
                <span className="text-base font-bold text-emerald-400 block">{formatINR(calculatedPayroll.total_net_salary)}</span>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Batch Run Notes</label>
              <input
                type="text"
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <span className="font-semibold text-zinc-300 block">Calculation Guardrails</span>
              <p>• Duplicate prevention: Only one payroll batch is permitted per store per month.</p>
              <p>• All leave deductions reflect approved Loss-of-Pay days from Leave Management.</p>
              <p>• Overtime is calculated at the employee's configured hourly rate.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRunModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerate}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20"
              >
                Lock & Generate Payroll Batch
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Adjustment Modal */}
      {adjustingItem && (
        <Modal
          isOpen={adjustModalOpen}
          onClose={() => setAdjustModalOpen(false)}
          title={`Adjust Item: ${adjustingItem.employee_name}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveAdjust} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Performance Bonus (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={adjustForm.bonus}
                  onChange={(e) => setAdjustForm({ ...adjustForm, bonus: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Custom Allowances (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={adjustForm.allowances}
                  onChange={(e) => setAdjustForm({ ...adjustForm, allowances: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Deductions / Penalties (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={adjustForm.deductions}
                  onChange={(e) => setAdjustForm({ ...adjustForm, deductions: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono text-rose-400"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Salary Advance Recovery (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={adjustForm.advanceDeduction}
                  onChange={(e) => setAdjustForm({ ...adjustForm, advanceDeduction: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white font-mono text-rose-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Save Adjustments
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Disburse Modal */}
      {selectedPayroll && (
        <Modal
          isOpen={disburseModalOpen}
          onClose={() => setDisburseModalOpen(false)}
          title={`Disburse Payroll: ${MONTH_NAMES[selectedPayroll.month - 1]} ${selectedPayroll.year}`}
          maxWidth="md"
        >
          <form onSubmit={handleDisburseSubmit} className="space-y-4 text-xs">
            <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800">
              <span className="text-zinc-500 uppercase font-mono text-[10px] block">Total Amount to Disburse</span>
              <span className="text-2xl font-bold text-emerald-400 block mt-1">
                {formatINR(selectedPayroll.total_net_salary)}
              </span>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Payment Method *</label>
              <select
                value={disburseMethod}
                onChange={(e) => setDisburseMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              >
                <option value="bank_transfer">Direct Bank Transfer / NEFT</option>
                <option value="upi">UPI Corporate</option>
                <option value="cheque">Company Cheque</option>
                <option value="cash">Petty Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Disbursement Notes / Bank Ref</label>
              <input
                type="text"
                placeholder="e.g. UTR / NEFT batch reference 2026110198"
                value={disburseNotes}
                onChange={(e) => setDisburseNotes(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
              />
            </div>

            <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <span className="font-semibold text-emerald-400 block">Unified Financial Synchronizer</span>
              <p>• Automatically logs a corresponding operating expense under 'Salaries & Wages'.</p>
              <p>• Avoids double counting in your Profit & Loss reports.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDisburseModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Confirm Payout
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Salary Slip Modal */}
      {activeSalarySlip && (
        <Modal
          isOpen={slipModalOpen}
          onClose={() => setSlipModalOpen(false)}
          title={`Salary Slip: ${activeSalarySlip.employee_name}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Printable Slip Container */}
            <div id="salary-slip-printable" className="p-6 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 text-zinc-200">
              {/* Slip Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-white uppercase">
                    BUSSINEX ENTERPRISE
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Store: {activeSalarySlip.store_name}
                  </p>
                  <p className="text-[10px] text-indigo-400 font-mono mt-0.5">
                    Pay Slip for {activeSalarySlip.period_label}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {activeSalarySlip.status.toUpperCase()}
                  </span>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    {activeSalarySlip.payment_date ? `Paid on ${formatDate(activeSalarySlip.payment_date)}` : 'Payment Pending'}
                  </div>
                </div>
              </div>

              {/* Employee & Bank Info */}
              <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div><span className="text-zinc-500">Employee:</span> <span className="text-white font-semibold">{activeSalarySlip.employee_name}</span></div>
                  <div><span className="text-zinc-500">Employee ID:</span> <span className="font-mono text-indigo-400">{activeSalarySlip.employee_code}</span></div>
                  <div><span className="text-zinc-500">Designation:</span> <span>{activeSalarySlip.designation}</span></div>
                  <div><span className="text-zinc-500">Department:</span> <span>{activeSalarySlip.department}</span></div>
                </div>
                <div className="space-y-1">
                  <div><span className="text-zinc-500">Bank Name:</span> <span>{activeSalarySlip.bank_name || 'Standard Account'}</span></div>
                  <div><span className="text-zinc-500">Account No:</span> <span className="font-mono">{activeSalarySlip.bank_account_number || '••••••••'}</span></div>
                  <div><span className="text-zinc-500">IFSC Code:</span> <span className="font-mono">{activeSalarySlip.bank_ifsc || '—'}</span></div>
                  <div><span className="text-zinc-500">Working Days:</span> <span>{activeSalarySlip.present_days} Pres. ({activeSalarySlip.absent_days} Abs.)</span></div>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="grid grid-cols-2 gap-6">
                {/* Earnings */}
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-300 font-mono text-[11px] uppercase border-b border-zinc-800 pb-1">
                    Earnings
                  </h4>
                  <div className="flex justify-between py-0.5">
                    <span className="text-zinc-400">Basic Salary</span>
                    <span className="font-mono text-white">{formatINR(activeSalarySlip.base_salary)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-zinc-400">Overtime ({activeSalarySlip.overtime_hours} hrs)</span>
                    <span className="font-mono text-white">+{formatINR(activeSalarySlip.overtime_pay)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-zinc-400">Bonus & Incentives</span>
                    <span className="font-mono text-white">+{formatINR(activeSalarySlip.bonus)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-zinc-400">Allowances</span>
                    <span className="font-mono text-white">+{formatINR(activeSalarySlip.allowances)}</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-1.5 flex justify-between font-bold">
                    <span>Gross Earnings</span>
                    <span className="text-indigo-400 font-mono">{formatINR(activeSalarySlip.gross_earnings)}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-300 font-mono text-[11px] uppercase border-b border-zinc-800 pb-1">
                    Deductions
                  </h4>
                  <div className="flex justify-between py-0.5">
                    <span className="text-zinc-400">Unpaid Leaves ({activeSalarySlip.unpaid_leave_days} d)</span>
                    <span className="font-mono text-rose-400">Included in Base</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-zinc-400">Salary Advance Recovery</span>
                    <span className="font-mono text-rose-400">-{formatINR(activeSalarySlip.advance_deduction)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-zinc-400">Statutory / Other Deductions</span>
                    <span className="font-mono text-rose-400">-{formatINR(activeSalarySlip.deductions)}</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-1.5 flex justify-between font-bold">
                    <span>Total Deductions</span>
                    <span className="text-rose-400 font-mono">-{formatINR(activeSalarySlip.total_deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-zinc-400 text-[10px] uppercase font-mono block">Take-Home Net Salary</span>
                  <span className="text-xs text-zinc-500">Transferred via company payroll register</span>
                </div>
                <div className="text-xl font-extrabold text-emerald-400 font-mono">
                  {formatINR(activeSalarySlip.net_salary)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-zinc-500 font-mono">
                System-generated authentic document
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSlipModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default PayrollPage;