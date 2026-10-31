import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  PackageCheck,
  CreditCard,
  RefreshCw,
  Plus,
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
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
        <p className="text-xs text-zinc-400 font-mono tracking-wider uppercase">
          Loading business telemetry...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Unable to load dashboard"
        description={error || 'An unexpected error occurred while querying business data.'}
        actionText="Retry Query"
        onAction={fetchDashboard}
      />
    );
  }

  const summary = data?.summary || {
    grossRevenue: 0,
    netProfit: 0,
    profitMargin: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    activeCustomers: 0,
    lowStockCount: 0,
  };
  const revenueTimeline = data?.revenueTimeline || [];
  const categoryStats = data?.categoryStats || [];
  const recentOrders = data?.recentOrders || [];
  const inventoryHealth = data?.inventoryHealth || {
    lowStockCount: 0,
    totalStockValueCost: 0,
    totalProducts: 0,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Business Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time financial performance, inventory health, and operational velocity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/brain')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500/20 to-indigo-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 text-sky-300 border border-sky-500/30 transition-all cursor-pointer shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Consult Business Brain</span>
          </button>

          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Order</span>
          </button>
        </div>
      </div>

      {/* Critical Stock Alert Banner */}
      {inventoryHealth.lowStockCount > 0 && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-300 tracking-tight">
                Inventory Attention Required
              </h4>
              <p className="text-xs text-amber-200/80 mt-0.5">
                {inventoryHealth.lowStockCount} product(s) have fallen below their safety thresholds.
                Restock now to prevent fulfillment backlogs.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors shrink-0"
          >
            <span>Review Items</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Key Performance Indicators (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gross Revenue"
          value={`$${Number(summary.grossRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={{
            value: `${summary.totalOrders || 0} Orders`,
            isPositive: true,
            label: 'completed',
          }}
          icon={DollarSign}
          glowVariant="sky"
        />

        <StatCard
          title="Net Profit"
          value={`$${Number(summary.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={{
            value: `${summary.profitMargin || 0}%`,
            isPositive: (summary.profitMargin || 0) >= 30,
            label: 'profit margin',
          }}
          icon={TrendingUp}
          glowVariant="emerald"
        />

        <StatCard
          title="Average Order Value"
          value={`$${Number(summary.avgOrderValue || 0).toFixed(2)}`}
          subtitle={`${summary.activeCustomers || 0} active purchasing clients`}
          icon={ShoppingBag}
          glowVariant="purple"
        />

        <StatCard
          title="Inventory Assets"
          value={`$${Number(inventoryHealth.totalStockValueCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={{
            value: `${inventoryHealth.lowStockCount || 0} Low`,
            isPositive: (inventoryHealth.lowStockCount || 0) === 0,
            label: `${inventoryHealth.totalProducts || 0} active SKUs`,
          }}
          icon={PackageCheck}
          glowVariant="amber"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Revenue Trajectory
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Aggregated daily revenue from customer purchases
              </p>
            </div>
            <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-500/20">
              Last 14 Days
            </span>
          </div>

          <div className="h-64 w-full">
            {revenueTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
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
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
                No revenue points recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Category Share Bar Chart */}
        <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Category Yield
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Revenue generated per product category</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Sales']}
                  />
                  <Bar dataKey="total_revenue" fill="#818cf8" radius={[6, 6, 0, 0]} />
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

      {/* Recent Orders Section */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Recent Transactions
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Latest client purchases processed by the system
            </p>
          </div>

          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800/60">
                <tr>
                  <th className="px-6 py-3">Order Number</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Payment</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                {recentOrders.map((order: any) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate('/orders')}
                    className="hover:bg-zinc-900/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-3.5 font-mono text-sky-400 font-medium">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-white">{order.customer_name || 'Walk-in Customer'}</div>
                      {order.customer_company && (
                        <div className="text-[11px] text-zinc-500">{order.customer_company}</div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 capitalize flex items-center gap-1.5 text-zinc-400">
                      <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                      {order.payment_method.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge
                        variant={
                          order.status === 'completed'
                            ? 'emerald'
                            : order.status === 'processing'
                            ? 'sky'
                            : order.status === 'pending'
                            ? 'amber'
                            : 'rose'
                        }
                        dot
                      >
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-white">
                      ${order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-zinc-500">
            No transaction records found.
          </div>
        )}
      </div>
    </div>
  );
};
