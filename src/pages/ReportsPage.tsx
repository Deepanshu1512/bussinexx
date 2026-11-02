import React, { useState, useEffect } from 'react';
import {
  FileText,
  TrendingUp,
  Boxes,
  Users,
  Store as StoreIcon,
  Download,
  Printer,
  Calendar,
  RefreshCw,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useStore } from '../context/StoreContext';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import { formatINR, formatDate } from '../utils/formatters';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ReportsPage: React.FC = () => {
  const { stores, selectedStoreId } = useStore();
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'workforce' | 'stores'>('sales');
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [workforceMonth, setWorkforceMonth] = useState(new Date().getMonth() + 1);
  const [workforceYear, setWorkforceYear] = useState(new Date().getFullYear());

  // Report Data
  const [salesReport, setSalesReport] = useState<any | null>(null);
  const [inventoryReport, setInventoryReport] = useState<any | null>(null);
  const [workforceReport, setWorkforceReport] = useState<any | null>(null);
  const [storeComparison, setStoreComparison] = useState<any[]>([]);

  // Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      const storeParam = selectedStoreId || undefined;

      if (activeTab === 'sales') {
        const data = await api.reports.getSalesReport({
          storeId: storeParam,
          startDate,
          endDate,
        });
        setSalesReport(data);
      } else if (activeTab === 'inventory') {
        const data = await api.reports.getInventoryReport(storeParam);
        setInventoryReport(data);
      } else if (activeTab === 'workforce') {
        const data = await api.reports.getWorkforceReport({
          storeId: storeParam,
          month: workforceMonth,
          year: workforceYear,
        });
        setWorkforceReport(data);
      } else if (activeTab === 'stores') {
        const data = await api.reports.getStoreComparison();
        setStoreComparison(data);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [activeTab, startDate, endDate, workforceMonth, workforceYear, selectedStoreId]);

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = `bussinex-report-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeTab === 'sales' && salesReport?.daily_timeline) {
      csvContent += 'Date,Orders Count,Gross Revenue,Discounts,Tax,Net Sales\n';
      salesReport.daily_timeline.forEach((row: any) => {
        csvContent += `${row.sale_date},${row.orders_count},${row.gross_revenue},${row.discounts},${row.tax_collected},${row.net_sales}\n`;
      });
    } else if (activeTab === 'inventory' && inventoryReport?.items) {
      csvContent += 'SKU,Product Name,Stock Units,Cost Price,Selling Price,Cost Value,Retail Value\n';
      inventoryReport.items.forEach((row: any) => {
        csvContent += `"${row.sku}","${row.name}",${row.current_stock},${row.cost_price},${row.selling_price},${row.cost_value},${row.retail_value}\n`;
      });
    } else if (activeTab === 'workforce' && workforceReport?.employee_breakdown) {
      csvContent += 'Employee Code,Name,Designation,Present Days,Absent Days,Late Count,OT Hours\n';
      workforceReport.employee_breakdown.forEach((row: any) => {
        csvContent += `"${row.employee_code}","${row.full_name}","${row.designation}",${row.present_days},${row.absent_days},${row.late_count},${row.total_overtime_hours}\n`;
      });
    } else if (activeTab === 'stores') {
      csvContent += 'Store Code,Store Name,City,Orders Count,Gross Sales,Expenses,Net Store Profit\n';
      storeComparison.forEach((s: any) => {
        csvContent += `"${s.store_code}","${s.store_name}","${s.city || ''}",${s.order_count},${s.gross_sales},${s.operating_expenses},${s.net_store_profit}\n`;
      });
    } else {
      showNotification('No data available to export', 'error');
      return;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Report CSV exported successfully');
  };

  const handlePrint = () => {
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

      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-indigo-400" />
            Executive Reports & Audit Statements
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Consolidated enterprise intelligence: sales margins, inventory valuation, workforce productivity, and store P&L
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-800 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'sales'
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Sales & Margin Timeline
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'inventory'
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Inventory Valuation & Potential Profit
        </button>
        <button
          onClick={() => setActiveTab('workforce')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'workforce'
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Workforce & Attendance Metrics
        </button>
        <button
          onClick={() => setActiveTab('stores')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'stores'
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <StoreIcon className="w-4 h-4" />
          Multi-Store Comparison
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        {activeTab === 'sales' && (
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
        )}

        {activeTab === 'workforce' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Month:</span>
            <select
              value={workforceMonth}
              onChange={(e) => setWorkforceMonth(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              value={workforceYear}
              onChange={(e) => setWorkforceYear(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white"
            >
              {[2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        )}

        {(activeTab === 'inventory' || activeTab === 'stores') && (
          <div className="text-xs text-zinc-400 font-mono">
            {activeTab === 'inventory' ? 'Live inventory snapshot across active stores' : 'Comparative store performance analytics'}
          </div>
        )}

        <div className="flex items-center gap-2">
          {stores.length > 0 && activeTab !== 'stores' && (
            <span className="text-xs text-zinc-400">
              🏬 {selectedStoreId ? stores.find(s => s.id === selectedStoreId)?.name : 'All Stores (Consolidated)'}
            </span>
          )}
          <button
            onClick={loadReportData}
            title="Refresh Report"
            className="p-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* REPORT CONTENT AREA */}
      {loading ? (
        <div className="p-16 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">Aggregating multi-source analytics and ledger records...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: Sales & Margin Timeline */}
          {activeTab === 'sales' && salesReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Total Orders</span>
                  <div className="text-2xl font-bold text-white mt-1">{salesReport.summary.total_orders}</div>
                  <div className="text-xs text-zinc-500 mt-1">Completed purchases</div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Gross Revenue</span>
                  <div className="text-2xl font-bold text-white mt-1">{formatINR(salesReport.summary.gross_revenue)}</div>
                  <div className="text-xs text-emerald-400 mt-1">
                    Avg Order: {formatINR(salesReport.summary.avg_order_value)}
                  </div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Estimated Cost (COGS)</span>
                  <div className="text-2xl font-bold text-zinc-300 mt-1">{formatINR(salesReport.summary.cogs)}</div>
                  <div className="text-xs text-zinc-500 mt-1">Purchase inventory cost</div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Gross Margin %</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {salesReport.summary.profit_margin_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">Gross Profit: {formatINR(salesReport.summary.gross_profit)}</div>
                </div>
              </div>

              {/* Daily Timeline Table */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                  <span className="font-bold text-zinc-200 text-xs uppercase font-mono">
                    Daily Sales Timeline Breakdown
                  </span>
                  <span className="text-zinc-500 text-xs font-mono">
                    {salesReport.daily_timeline?.length || 0} active days
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Orders</th>
                        <th className="py-2.5 px-4">Gross Sales</th>
                        <th className="py-2.5 px-4">Discounts</th>
                        <th className="py-2.5 px-4">GST / Tax</th>
                        <th className="py-2.5 px-4 text-right">Net Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {salesReport.daily_timeline?.map((day: any, i: number) => (
                        <tr key={i} className="hover:bg-zinc-800/30">
                          <td className="py-3 px-4 font-mono text-zinc-300">{formatDate(day.sale_date)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-white">{day.orders_count}</td>
                          <td className="py-3 px-4 font-mono text-zinc-300">{formatINR(day.gross_revenue)}</td>
                          <td className="py-3 px-4 font-mono text-amber-400">-{formatINR(day.discounts)}</td>
                          <td className="py-3 px-4 font-mono text-indigo-400">+{formatINR(day.tax_collected)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right">
                            {formatINR(day.net_sales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Inventory Valuation */}
          {activeTab === 'inventory' && inventoryReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Total Stock Units</span>
                  <div className="text-2xl font-bold text-white mt-1">{inventoryReport.summary.total_units}</div>
                  <div className="text-xs text-zinc-500 mt-1">Across {inventoryReport.summary.total_products} distinct SKUs</div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Cost Valuation</span>
                  <div className="text-2xl font-bold text-zinc-300 mt-1">{formatINR(inventoryReport.summary.total_cost_value)}</div>
                  <div className="text-xs text-zinc-500 mt-1">Total capital invested</div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Retail Realization Value</span>
                  <div className="text-2xl font-bold text-white mt-1">{formatINR(inventoryReport.summary.total_retail_value)}</div>
                  <div className="text-xs text-emerald-400 mt-1">At catalog selling prices</div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Potential Gross Profit</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {formatINR(inventoryReport.summary.potential_gross_profit)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">Expected profit on liquidation</div>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                  <span className="font-bold text-zinc-200 text-xs uppercase font-mono">
                    Product Valuation & Profit Margin
                  </span>
                  <span className="text-zinc-500 text-xs font-mono">
                    {inventoryReport.items?.length || 0} catalog items
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono">
                        <th className="py-2.5 px-4">SKU / Product</th>
                        <th className="py-2.5 px-4">Stock</th>
                        <th className="py-2.5 px-4">Cost Price</th>
                        <th className="py-2.5 px-4">Selling Price</th>
                        <th className="py-2.5 px-4">Cost Value</th>
                        <th className="py-2.5 px-4">Retail Value</th>
                        <th className="py-2.5 px-4 text-right">Potential Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {inventoryReport.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-zinc-800/30">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{item.name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{item.sku}</div>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className={item.current_stock <= item.min_stock_threshold ? 'text-rose-400 font-bold' : 'text-zinc-300'}>
                              {item.current_stock}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-zinc-400">{formatINR(item.cost_price)}</td>
                          <td className="py-3 px-4 font-mono text-zinc-200">{formatINR(item.selling_price)}</td>
                          <td className="py-3 px-4 font-mono text-zinc-400">{formatINR(item.cost_value)}</td>
                          <td className="py-3 px-4 font-mono text-white font-medium">{formatINR(item.retail_value)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right">
                            {formatINR(item.potential_profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Workforce Metrics */}
          {activeTab === 'workforce' && workforceReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Registered Staff</span>
                  <div className="text-2xl font-bold text-white mt-1">{workforceReport.summary.total_employees}</div>
                  <div className="text-xs text-zinc-500 mt-1">{workforceReport.summary.working_days_in_month} working days in month</div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Attendance Rate</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {workforceReport.summary.attendance_rate_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">{workforceReport.summary.total_punches} present punches</div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Late Arrivals</span>
                  <div className="text-2xl font-bold text-amber-400 mt-1">{workforceReport.summary.total_late_arrivals}</div>
                  <div className="text-xs text-zinc-500 mt-1">Across all registered shifts</div>
                </div>
                <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
                  <span className="text-xs text-zinc-500 uppercase font-mono block">Overtime Liability</span>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">{formatINR(workforceReport.summary.estimated_overtime_cost)}</div>
                  <div className="text-xs text-zinc-500 mt-1">For {workforceReport.summary.total_overtime_hours} hours OT</div>
                </div>
              </div>

              {/* Employee Breakdown */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                  <span className="font-bold text-zinc-200 text-xs uppercase font-mono">
                    Employee Attendance & Punctuality Roll
                  </span>
                  <span className="text-zinc-500 text-xs font-mono">
                    {MONTH_NAMES[workforceMonth - 1]} {workforceYear}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono">
                        <th className="py-2.5 px-4">Employee</th>
                        <th className="py-2.5 px-4">Designation</th>
                        <th className="py-2.5 px-4">Present Days</th>
                        <th className="py-2.5 px-4">Absent Days</th>
                        <th className="py-2.5 px-4">Late Arrivals</th>
                        <th className="py-2.5 px-4 text-right">OT Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {workforceReport.employee_breakdown?.map((emp: any) => (
                        <tr key={emp.employee_id} className="hover:bg-zinc-800/30">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{emp.full_name}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">{emp.employee_code}</div>
                          </td>
                          <td className="py-3 px-4 text-zinc-300">{emp.designation}</td>
                          <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{emp.present_days}</td>
                          <td className="py-3 px-4 font-mono text-rose-400">{emp.absent_days}</td>
                          <td className="py-3 px-4 font-mono text-amber-400">{emp.late_count}</td>
                          <td className="py-3 px-4 font-mono text-indigo-400 text-right font-medium">
                            {emp.total_overtime_hours} hrs
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Multi-Store Comparison */}
          {activeTab === 'stores' && (
            <div className="space-y-4">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                  <span className="font-bold text-zinc-200 text-xs uppercase font-mono">
                    Store-by-Store Profitability & Operations Comparison
                  </span>
                  <span className="text-zinc-500 text-xs font-mono">
                    {storeComparison.length} Active Stores
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono">
                        <th className="py-2.5 px-4">Store Code & Name</th>
                        <th className="py-2.5 px-4">Location</th>
                        <th className="py-2.5 px-4">Staff Count</th>
                        <th className="py-2.5 px-4">Orders Count</th>
                        <th className="py-2.5 px-4">Gross Sales</th>
                        <th className="py-2.5 px-4">Operating Costs</th>
                        <th className="py-2.5 px-4 text-right">Net Store Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {storeComparison.map((s: any) => (
                        <tr key={s.store_id} className="hover:bg-zinc-800/30">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">{s.store_name}</div>
                            <div className="text-[10px] text-indigo-400 font-mono">{s.store_code}</div>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400">
                            {s.city || 'India'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-zinc-300">
                            {s.employee_count} staff
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-white">
                            {s.order_count}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                            {formatINR(s.gross_sales)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-rose-400">
                            -{formatINR(s.operating_expenses)}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-extrabold text-right">
                            <span className={s.net_store_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {formatINR(s.net_store_profit)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default ReportsPage;