import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Award,
  Users,
  FileText,
  Printer,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Package,
  Store as StoreIcon,
  Calendar
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { api } from '../services/api';
import { ExecutiveSummary, RevenuePoint, TopProduct, CategoryStat, TopCustomer } from '../types';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { useStore } from '../context/StoreContext';
import { formatINR, formatINRCompact, formatDate } from '../utils/formatters';

export const AnalyticsPage: React.FC = () => {
  const { stores, selectedStoreId, currentStore } = useStore();
  const [days, setDays] = useState<number>(30);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [timeline, setTimeline] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  // Executive Report Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const storeParam = selectedStoreId || undefined;
      const [sum, time, prods, cats, custs] = await Promise.all([
        api.getAnalyticsSummary(storeParam),
        api.getRevenueTimeline(days, storeParam),
        api.getTopProducts(6, storeParam),
        api.getCategoryStats(storeParam),
        api.getTopCustomers(5, storeParam),
      ]);
      setSummary(sum);
      setTimeline(time || []);
      setTopProducts(prods || []);
      setCategoryStats(cats || []);
      setTopCustomers(custs || []);
    } catch (err: any) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days, selectedStoreId]);

  const handleGenerateReport = async () => {
    try {
      setLoadingReport(true);
      setReportModalOpen(true);
      const report = await api.getExecutiveReport(selectedStoreId || undefined);
      setReportData(report);
    } catch (err: any) {
      console.error('Report error:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const hasData = (summary && summary.totalOrders > 0) || timeline.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Business Intelligence & Analytics</h1>
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
            Real-time multi-store telemetry, unit economics, gross margins & executive financial summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Days selector */}
          <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800 text-xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg transition-colors font-mono ${
                  days === d ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Executive Report</span>
          </button>
        </div>
      </div>

      {/* Top Financial Breakdown Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Gross Revenue"
            value={formatINR(summary.grossRevenue || 0)}
            trend={{
              value: `${summary.totalOrders || 0} Orders`,
              isPositive: true,
              label: 'processed',
            }}
            icon={TrendingUp}
            glowVariant="sky"
          />

          <StatCard
            title="Cost of Goods (COGS)"
            value={formatINR(summary.cogs || 0)}
            subtitle="Direct product acquisition cost"
            icon={BarChart3}
            glowVariant="amber"
          />

          <StatCard
            title="Net Gross Profit"
            value={formatINR(summary.netProfit || 0)}
            trend={{
              value: `${summary.profitMargin || 0}%`,
              isPositive: (summary.profitMargin || 0) >= 30,
              label: 'profit margin',
            }}
            icon={Award}
            glowVariant="emerald"
          />

          <StatCard
            title="Avg Order Value (AOV)"
            value={formatINR(summary.avgOrderValue || 0)}
            subtitle={`${formatINR(summary.totalDiscounts || 0)} discounts applied`}
            icon={Users}
            glowVariant="purple"
          />
        </div>
      )}

      {/* Revenue Over Time Area Chart */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Revenue Timeline (INR)</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Financial trajectory over the selected {days}-day period
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
            Window: Last {days} Days
          </span>
        </div>

        <div className="h-72 w-full">
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#52525b"
                  fontSize={11}
                  tickFormatter={(val) => val ? String(val).slice(5) : ''}
                  tickLine={false}
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={11}
                  tickFormatter={(val) => formatINRCompact(val)}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#27272a',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#f4f4f5',
                  }}
                  formatter={(val: any) => [formatINR(val), 'Gross Revenue']}
                  labelFormatter={(lbl) => formatDate(String(lbl || ''))}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#analyticsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs space-y-2">
              <Calendar className="w-6 h-6 text-zinc-600" />
              <span>No orders recorded in this time window. Create new sales orders to populate revenue charts.</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Top Products vs Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products by Profit Contribution */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white tracking-tight">
              Top Products by Revenue & Profit
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ranked by total gross revenue and unit velocity
            </p>
          </div>

          <div className="overflow-x-auto">
            {topProducts.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="py-2.5">Product</th>
                    <th className="py-2.5">Units</th>
                    <th className="py-2.5">Revenue</th>
                    <th className="py-2.5 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  {topProducts.map((p) => (
                    <tr key={p.product_id} className="hover:bg-zinc-900/60">
                      <td className="py-3 pr-2">
                        <div className="font-semibold text-white truncate max-w-[180px]">
                          {p.product_name}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-500">{p.product_sku}</div>
                      </td>
                      <td className="py-3 font-mono text-zinc-300">{p.units_sold}</td>
                      <td className="py-3 font-mono font-semibold text-white">
                        {formatINR(p.total_revenue)}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-emerald-400">
                        {formatINR(p.gross_profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-zinc-500">
                No product sales data recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Category Contribution Bar Chart */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white tracking-tight">
              Department Performance
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">Revenue distribution across categories</p>
          </div>

          <div className="h-64 w-full">
            {categoryStats.length > 0 && categoryStats.some(c => c.total_revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryStats} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#52525b"
                    fontSize={10}
                    tickFormatter={(val) => val ? String(val).split(' ')[0] : ''}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#52525b"
                    fontSize={11}
                    tickFormatter={(val) => formatINRCompact(val)}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#09090b',
                      borderColor: '#27272a',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#f4f4f5',
                    }}
                    formatter={(val: any) => [formatINR(val), 'Total Revenue']}
                  />
                  <Bar dataKey="total_revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                No sales recorded across product categories yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Customer Accounts Section */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Key Account Concentration
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Clients driving the greatest cumulative lifetime revenue
            </p>
          </div>
          <Badge variant="purple">VIP & Wholesale Accounts</Badge>
        </div>

        <div className="overflow-x-auto">
          {topCustomers.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
                <tr>
                  <th className="py-2.5">Client Account</th>
                  <th className="py-2.5">Tier</th>
                  <th className="py-2.5">Completed Orders</th>
                  <th className="py-2.5">Last Purchase</th>
                  <th className="py-2.5 text-right">Lifetime Value (LTV)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {topCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/60">
                    <td className="py-3">
                      <div className="font-semibold text-white">{c.name}</div>
                      {c.company && <div className="text-[11px] text-zinc-500">{c.company}</div>}
                    </td>
                    <td className="py-3">
                      <Badge variant={c.tier === 'vip' ? 'purple' : 'sky'}>{(c.tier || 'new').toUpperCase()}</Badge>
                    </td>
                    <td className="py-3 font-mono text-zinc-300">{c.total_orders || 0} orders</td>
                    <td className="py-3 text-zinc-400 font-mono text-[11px]">
                      {c.last_order ? formatDate(c.last_order) : '—'}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-indigo-400 text-sm">
                      {formatINR(c.lifetime_value || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center text-xs text-zinc-500">
              No customer order activity recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* EXECUTIVE REPORT MODAL */}
      <Modal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="Executive Business Health Report"
        subtitle="Comprehensive operational & financial briefing"
        maxWidth="3xl"
      >
        {loadingReport ? (
          <div className="py-16 text-center text-xs text-zinc-400">
            Generating full executive report from live database...
          </div>
        ) : reportData ? (
          <div className="space-y-6">
            {/* Report Header */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider block font-semibold">
                  Report Status: Verified Clean
                </span>
                <span className="text-xs text-zinc-400">
                  Generated: {formatDate(reportData.generatedAt)}
                </span>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Report</span>
              </button>
            </div>

            {/* Financial Highlights */}
            <div>
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono mb-3">
                1. Financial Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                <div>
                  <span className="text-zinc-500 block">Gross Revenue</span>
                  <span className="font-mono font-bold text-white text-base mt-0.5 block">
                    {formatINR(reportData.summary?.grossRevenue || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Cost of Goods</span>
                  <span className="font-mono font-bold text-zinc-300 text-base mt-0.5 block">
                    {formatINR(reportData.summary?.cogs || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Net Profit</span>
                  <span className="font-mono font-bold text-emerald-400 text-base mt-0.5 block">
                    {formatINR(reportData.summary?.netProfit || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Gross Margin</span>
                  <span className="font-mono font-bold text-indigo-400 text-base mt-0.5 block">
                    {reportData.summary?.profitMargin || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Strategic Observations */}
            <div>
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono mb-3">
                2. Strategic Observations & Risk Matrix
              </h4>
              <div className="space-y-2">
                {reportData.observations?.map((obs: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      obs.type === 'positive'
                        ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-200'
                        : obs.type === 'urgent'
                        ? 'bg-rose-950/40 border-rose-500/20 text-rose-200'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    {obs.type === 'positive' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                    {obs.type === 'urgent' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                    {obs.type === 'insight' && <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}
                    <span>{obs.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Stock Warning List */}
            {reportData.lowStockAlerts && reportData.lowStockAlerts.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono mb-3">
                  3. Safety Stock Threshold Warnings ({reportData.lowStockAlerts.length} items)
                </h4>
                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2">Current Stock</th>
                        <th className="px-4 py-2">Min Threshold</th>
                        <th className="px-4 py-2 text-right">Unit Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                      {reportData.lowStockAlerts.map((l: any) => (
                        <tr key={l.id}>
                          <td className="px-4 py-2.5 font-semibold text-white">{l.name}</td>
                          <td className="px-4 py-2.5 font-mono text-amber-400 font-bold">{l.current_stock}</td>
                          <td className="px-4 py-2.5 font-mono text-zinc-400">{l.min_stock_threshold}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-300">{formatINR(l.cost_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default AnalyticsPage;
