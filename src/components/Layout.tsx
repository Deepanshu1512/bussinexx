import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Users,
  BarChart3,
  Sparkles,
  Settings,
  Menu,
  X,
  PlusCircle,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  Store as StoreIcon,
  ChevronDown,
  Check,
  Building2,
  FileText,
  Clock,
  CalendarDays,
  CreditCard,
  Truck,
  Wallet,
  Bell,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { User, NotificationItem } from '../types';
import { useStore } from '../context/StoreContext';
import { api } from '../services/api';
import { formatDate } from '../utils/formatters';

interface LayoutProps {
  children: React.ReactNode;
  businessName?: string;
  user?: User | null;
  onLogout?: () => void;
}

interface NavSection {
  title: string;
  items: {
    name: string;
    path: string;
    icon: any;
    special?: boolean;
    badge?: string;
  }[];
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  businessName = 'Bussinex',
  user,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scanning, setScanning] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { stores, selectedStoreId, setSelectedStoreId, currentStore } = useStore();

  const navSections: NavSection[] = [
    {
      title: 'Operations',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Inventory', path: '/inventory', icon: Boxes },
        { name: 'Sales & Orders', path: '/orders', icon: ShoppingCart },
      ],
    },
    {
      title: 'Human Resources',
      items: [
        { name: 'Employees', path: '/employees', icon: Users },
        { name: 'Attendance', path: '/attendance', icon: Clock },
        { name: 'Leaves', path: '/leaves', icon: CalendarDays },
        { name: 'Payroll & Slips', path: '/payroll', icon: CreditCard },
      ],
    },
    {
      title: 'CRM & Supply',
      items: [
        { name: 'Customers', path: '/customers', icon: Users },
        { name: 'Suppliers & POs', path: '/suppliers', icon: Truck },
      ],
    },
    {
      title: 'Finance & Reports',
      items: [
        { name: 'Expenses & P&L', path: '/expenses', icon: Wallet },
        { name: 'Audit Reports', path: '/reports', icon: FileText },
        { name: 'Analytics', path: '/analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'Intelligence & Config',
      items: [
        {
          name: 'Business Brain',
          path: '/brain',
          icon: Sparkles,
          special: true,
          badge: 'AI Core',
        },
        { name: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  const loadNotifications = async () => {
    try {
      const [list, countRes] = await Promise.all([
        api.notifications.list({ limit: 10 }),
        api.notifications.getUnreadCount(),
      ]);
      setNotifications(Array.isArray(list) ? list : (list as any)?.notifications || []);
      setUnreadCount(typeof countRes?.count === 'number' ? countRes.count : 0);
    } catch {
      // In guest or offline mode, graceful fallback
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.notifications.markAsRead(id);
      loadNotifications();
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      loadNotifications();
    } catch {
      // Ignore
    }
  };

  const handleScanAlerts = async () => {
    try {
      setScanning(true);
      await api.notifications.scan();
      await loadNotifications();
    } finally {
      setScanning(false);
    }
  };

  // Find active nav title
  const currentNav = navSections.flatMap(s => s.items).find(i => i.path === location.pathname);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row text-zinc-100 font-sans">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="truncate">
            <span className="font-bold tracking-tight text-white text-sm block leading-tight">BUSSINEX</span>
            <span className="text-[9px] text-zinc-400 block font-mono">ENTERPRISE</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Notification Icon for Mobile */}
          <button
            onClick={() => { setNotificationsOpen(!notificationsOpen); loadNotifications(); }}
            className="relative p-1.5 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {/* Store Switcher for Mobile */}
          {stores.length > 0 && (
            <select
              value={selectedStoreId === null ? 'all' : selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value === 'all' ? null : Number(e.target.value))}
              className="py-1 px-1.5 text-[11px] bg-zinc-800 border border-zinc-700 rounded-lg text-white max-w-[100px] sm:max-w-[140px] truncate"
            >
              <option value="all">🏬 All</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Notifications Popover */}
        {notificationsOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 p-3 bg-zinc-950/95 border-b border-zinc-800 shadow-2xl z-50 max-h-80 overflow-y-auto backdrop-blur-md">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-bold text-xs text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[10px] font-mono">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleScanAlerts}
                  disabled={scanning}
                  className="p-1 rounded text-zinc-400 hover:text-white"
                  title="Scan for alerts"
                >
                  <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1 rounded text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-zinc-800/60 text-xs">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-zinc-500 text-xs">
                  All caught up! No active alerts.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      handleMarkAsRead(n.id);
                      setNotificationsOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                    className={`py-2 px-2 rounded-lg transition-colors cursor-pointer ${
                      !n.is_read ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-xs ${!n.is_read ? 'text-indigo-300' : 'text-zinc-200'}`}>
                        {n.title}
                      </span>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <span className="text-[9px] text-zinc-600 block mt-1 font-mono">
                      {formatDate(n.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar for Desktop */}
      <aside
        className={`fixed md:sticky top-0 inset-y-0 left-0 z-40 w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="p-5 pb-4 flex items-center justify-between border-b border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold tracking-tight text-white text-base leading-none">
                  BUSSINEX
                </h1>
                <p className="text-[10px] font-mono tracking-wider text-indigo-400/90 mt-1 uppercase">
                  Enterprise Suite
                </p>
              </div>
            </div>
          </div>

          {/* Business Identifier & Store Switcher */}
          <div className="px-4 py-3 bg-zinc-900/40 border-b border-zinc-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="truncate pr-2">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-mono font-medium">
                  Business Account
                </span>
                <span className="text-xs font-semibold text-zinc-200 truncate block">
                  {businessName}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>

            {/* Store Switcher Widget */}
            {stores.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/60 flex items-center justify-between text-xs text-left text-zinc-300 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <StoreIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate font-medium text-white">
                      {currentStore ? currentStore.name : 'All Stores (Consolidated)'}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0 ml-1" />
                </button>

                {storeDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 py-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 text-xs">
                    <button
                      type="button"
                      onClick={() => { setSelectedStoreId(null); setStoreDropdownOpen(false); }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-zinc-800 ${
                        selectedStoreId === null ? 'text-indigo-400 font-semibold' : 'text-zinc-300'
                      }`}
                    >
                      <span>🏬 All Stores (Consolidated)</span>
                      {selectedStoreId === null && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                    <div className="border-t border-zinc-800 my-1" />
                    {stores.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setSelectedStoreId(s.id); setStoreDropdownOpen(false); }}
                        className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-zinc-800 ${
                          selectedStoreId === s.id ? 'text-indigo-400 font-semibold' : 'text-zinc-300'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="block truncate">{s.name}</span>
                          {s.city && <span className="text-[10px] text-zinc-500 block truncate">{s.city}</span>}
                        </div>
                        {selectedStoreId === s.id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </button>
                    ))}
                    <div className="border-t border-zinc-800 my-1" />
                    <button
                      type="button"
                      onClick={() => { navigate('/settings?tab=stores'); setStoreDropdownOpen(false); }}
                      className="w-full px-3 py-1.5 text-left text-indigo-400 hover:bg-zinc-800 flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-3 h-3" />
                      Manage Stores
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Categorized Navigation Sections */}
          <nav className="p-3 space-y-4 flex-1">
            {navSections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <div className="px-3 text-[10px] font-bold tracking-wider text-zinc-500 uppercase font-mono">
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  if (item.special) {
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 mt-1 mb-1 ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                            : 'text-zinc-300 hover:text-white bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-1 rounded-lg ${
                              isActive
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-zinc-800 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span>{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-zinc-800/80 text-white font-semibold border border-zinc-700/50 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-3.5 h-3.5 ${
                            isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-300'
                          }`}
                        />
                        <span>{item.name}</span>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* User Session & System Health */}
        <div className="p-3 border-t border-zinc-800/60 bg-zinc-950/80 space-y-2.5">
          {/* User Profile Card */}
          {user ? (
            <div className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
              <div
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 truncate pr-2 cursor-pointer hover:opacity-85 transition-opacity"
                title="Account Details"
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 shrink-0">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-semibold text-white block truncate leading-tight">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono block truncate">
                    {user.email}
                  </span>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="w-full p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-between text-indigo-300 text-xs transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold">Sign In / Switch Account</span>
              </div>
            </button>
          )}

          {/* Legal and Compliance Links */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              Role: {(user?.role || 'owner').toUpperCase()}
            </span>
            <Link
              to="/terms"
              className="text-[10px] text-zinc-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
            >
              <FileText className="w-3 h-3" />
              Terms
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-200">
              {currentNav?.name || 'Platform'}
            </h2>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-zinc-300 font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              {businessName}
            </span>
            {user?.is_demo && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                <Sparkles className="w-3 h-3" />
                Demo Mode
              </span>
            )}
            {currentStore && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                  🏬 {currentStore.name}
                </span>
              </>
            )}
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3">
            {/* Top Store Selector */}
            {stores.length > 0 && (
              <select
                value={selectedStoreId === null ? 'all' : selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value === 'all' ? null : Number(e.target.value))}
                className="py-1.5 px-3 text-xs bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">🏬 All Stores (Consolidated)</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏬 {s.name} {s.city ? `(${s.city})` : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setNotificationsOpen(!notificationsOpen); loadNotifications(); }}
                className="relative p-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white transition-all cursor-pointer"
                title="Notifications & Alerts"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl z-50 text-xs overflow-hidden">
                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-white">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[10px] font-mono">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleScanAlerts}
                        disabled={scanning}
                        title="Scan For Stock & Leave Alerts"
                        className="p-1 rounded text-zinc-400 hover:text-white"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-indigo-400' : ''}`} />
                      </button>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/60">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-zinc-500 text-xs">
                        All caught up! No active alerts.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkAsRead(n.id)}
                          className={`p-3 transition-colors cursor-pointer ${
                            !n.is_read ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'hover:bg-zinc-800/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-zinc-200 leading-tight">
                              {n.title}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1 rounded uppercase ${
                                n.type === 'alert'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : n.type === 'warning'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-indigo-500/20 text-indigo-400'
                              }`}
                            >
                              {n.module}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                            {n.message}
                          </p>
                          <span className="text-[9px] text-zinc-600 block mt-1 font-mono">
                            {formatDate(n.created_at)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/brain')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500/10 to-violet-500/10 hover:from-indigo-500/20 hover:to-violet-500/20 text-indigo-400 border border-indigo-500/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask Brain</span>
            </button>

            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Order</span>
            </button>

            {/* Prominent Header Logout Button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-zinc-800 hover:border-rose-500/30 transition-all cursor-pointer"
                title="Sign out of your business account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Content Viewport */}
        <div className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">{children}</div>
      </main>

      {/* Mobile Bottom Quick-Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 border-t border-zinc-800/80 backdrop-blur-lg px-2 py-1.5 flex items-center justify-around shadow-2xl">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`
          }
        >
          <Boxes className="w-4 h-4 mb-0.5" />
          <span>Stock</span>
        </NavLink>

        <NavLink
          to="/orders"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`
          }
        >
          <ShoppingCart className="w-4 h-4 mb-0.5" />
          <span>Orders</span>
        </NavLink>

        <NavLink
          to="/employees"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`
          }
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span>Staff</span>
        </NavLink>

        <NavLink
          to="/brain"
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`
          }
        >
          <Sparkles className="w-4 h-4 mb-0.5 text-indigo-400" />
          <span>AI Brain</span>
        </NavLink>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};
export default Layout;