import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  Award,
  Users,
  FileText,
  Printer,
  Sparkles,
  AlertCircle,
  CheckCircle,
  HelpCircle,
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
  Legend,
} from 'recharts';
import { api } from '../services/api';
import { ExecutiveSummary, RevenuePoint, TopProduct, CategoryStat, TopCustomer } from '../types';
import { StatCard } from '../components/StatCard';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';

export const AnalyticsPage: React.FC = () => {
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
      const [sum, time, prods, cats, custs] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getRevenueTimeline(days),
        api.getTopProducts(6),
        api.getCategoryStats(),
        api.getTopCustomers(5),
      ]);
      setSummary(sum);
      setTimeline(time);
      setTopProducts(prods);
      setCategoryStats(cats);
      setTopCustomers(custs);
    } catch (err: any) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const handleGenerateReport = async () => {
    try {
      setLoadingReport(true);
      setReportModalOpen(true);
      const report = await api.getExecutiveReport();
      setReportData(report);
    } catch (err: any) {
      console.error('Report error:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Business Intelligence & Analytics</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Data-driven insights, unit economics, cohort performance & executive reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white transition-all shadow-md shadow-sky-500/15 cursor-pointer"
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
            value={`$${summary.grossRevenue.toLocaleString()}`}
            trend={{
              value: `${summary.totalOrders} Orders`,
              isPositive: true,
              label: 'processed',
            }}
            icon={DollarSign}
            glowVariant="sky"
          />

          <StatCard
            title="Cost of Goods (COGS)"
            value={`$${summary.cogs.toLocaleString()}`}
            subtitle="Direct product acquisition cost"
            icon={BarChart3}
            glowVariant="amber"
          />

          <StatCard
            title="Net Gross Profit"
            value={`$${summary.netProfit.toLocaleString()}`}
            trend={{
              value: `${summary.profitMargin}%`,
              isPositive: summary.profitMargin >= 35,
              label: 'gross margin',
            }}
            icon={TrendingUp}
            glowVariant="emerald"
          />

          <StatCard
            title="Avg Order Value (AOV)"
            value={`$${summary.avgOrderValue.toFixed(2)}`}
            subtitle={`$${summary.totalDiscounts.toLocaleString()} discounts applied`}
            icon={Award}
            glowVariant="purple"
          />
        </div>
      )}

      {/* Revenue Over Time Area Chart */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Revenue Timeline</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cumulative financial trajectory over the selected {days}-day window
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
            Window: Last {days} Days
          </span>
        </div>

        <div className="h-72 w-full">
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#52525b"
                  fontSize={11}
                  tickFormatter={(val) => val.slice(5)}
                  tickLine={false}
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={11}
                  tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#f4f4f5',
                  }}
                  formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Gross Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#818cf8"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#analyticsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
              No timeline data points available for this period.
            </div>
          )}
        </div>
      </div>

      {/* Grid: Top Products vs Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products by Profit Contribution */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white tracking-tight">
              Top Products by Profit & Volume
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ranked by total gross revenue and unit velocity
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
                <tr>
                  <th className="py-2.5">Product</th>
                  <th className="py-2.5">Units</th>
                  <th className="py-2.5">Revenue</th>
                  <th className="py-2.5 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {topProducts.map((p) => (
                  <tr key={p.product_id} className="hover:bg-zinc-900/40">
                    <td className="py-3 pr-2">
                      <div className="font-semibold text-white truncate max-w-[180px]">
                        {p.product_name}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500">{p.product_sku}</div>
                    </td>
                    <td className="py-3 font-mono text-zinc-300">{p.units_sold}</td>
                    <td className="py-3 font-mono font-semibold text-white">
                      ${p.total_revenue.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-emerald-400">
                      ${p.gross_profit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Contribution Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white tracking-tight">
              Department Performance
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">Revenue distribution across product categories</p>
          </div>

          <div className="h-64 w-full">
            {categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryStats} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#52525b"
                    fontSize={10}
                    tickFormatter={(val) => val.split(' ')[0]}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#52525b"
                    fontSize={11}
                    tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderColor: '#27272a',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#f4f4f5',
                    }}
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Total Revenue']}
                  />
                  <Bar dataKey="total_revenue" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                No category data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Customer Accounts Section */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5">
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
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/60 text-zinc-400 font-mono uppercase text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-2.5">Client Account</th>
                <th className="py-2.5">Tier</th>
                <th className="py-2.5">Completed Orders</th>
                <th className="py-2.5">Last Purchase</th>
                <th className="py-2.5 text-right">Lifetime Value (LTV)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
              {topCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-900/40">
                  <td className="py-3">
                    <div className="font-semibold text-white">{c.name}</div>
                    {c.company && <div className="text-[11px] text-zinc-500">{c.company}</div>}
                  </td>
                  <td className="py-3">
                    <Badge variant={c.tier === 'vip' ? 'purple' : 'sky'}>{c.tier.toUpperCase()}</Badge>
                  </td>
                  <td className="py-3 font-mono text-zinc-300">{c.total_orders} orders</td>
                  <td className="py-3 text-zinc-400 font-mono text-[11px]">{c.last_order.slice(0, 10)}</td>
                  <td className="py-3 text-right font-mono font-bold text-sky-400 text-sm">
                    ${c.lifetime_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <span className="text-xs font-mono text-sky-400 uppercase tracking-wider block">
                  Report Status: Verified Clean
                </span>
                <span className="text-xs text-zinc-500">
                  Generated: {new Date(reportData.generatedAt).toLocaleString()}
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
                    ${reportData.summary.grossRevenue.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Cost of Goods</span>
                  <span className="font-mono font-bold text-zinc-300 text-base mt-0.5 block">
                    ${reportData.summary.cogs.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Net Profit</span>
                  <span className="font-mono font-bold text-emerald-400 text-base mt-0.5 block">
                    ${reportData.summary.netProfit.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Gross Margin</span>
                  <span className="font-mono font-bold text-sky-400 text-base mt-0.5 block">
                    {reportData.summary.profitMargin}%
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
                    {obs.type === 'insight' && <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}
                    <span>{obs.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Stock Warning List */}
            {reportData.lowStockAlerts && reportData.lowStockAlerts.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono mb-3">
                  3. Urgent Restock Requirements ({reportData.lowStockAlerts.length} items)
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
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-300">${l.cost_price.toFixed(2)}</td>
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
