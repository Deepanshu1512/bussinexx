import React, { useState } from 'react';
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
  FileText
} from 'lucide-react';
import { User } from '../types';
import { useStore } from '../context/StoreContext';

interface LayoutProps {
  children: React.ReactNode;
  businessName?: string;
  user?: User | null;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  businessName = 'Bussinex',
  user,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { stores, selectedStoreId, setSelectedStoreId, currentStore } = useStore();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Inventory', path: '/inventory', icon: Boxes },
    { name: 'Sales & Orders', path: '/orders', icon: ShoppingCart },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    {
      name: 'Business Brain',
      path: '/brain',
      icon: Sparkles,
      special: true,
      badge: 'AI Core',
    },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row text-zinc-100 font-sans">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-base">BUSSINEX</span>
            <span className="text-[10px] text-zinc-400 block -mt-1 font-mono">ENTERPRISE</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Store Switcher for Mobile */}
          {stores.length > 0 && (
            <select
              value={selectedStoreId === null ? 'all' : selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value === 'all' ? null : Number(e.target.value))}
              className="py-1 px-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            >
              <option value="all">🏬 All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar for Desktop */}
      <aside
        className={`fixed md:sticky top-0 inset-y-0 left-0 z-40 w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="p-6 pb-5 flex items-center justify-between border-b border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold tracking-tight text-white text-base leading-none">
                  BUSSINEX
                </h1>
                <p className="text-[10px] font-mono tracking-wider text-indigo-400/90 mt-1 uppercase">
                  Multi-Store Platform
                </p>
              </div>
            </div>
          </div>

          {/* Quick Business Identifier & Store Switcher */}
          <div className="px-5 py-3.5 bg-zinc-900/40 border-b border-zinc-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="truncate pr-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono font-medium">
                  Business Account
                </span>
                <span className="text-xs font-semibold text-zinc-200 truncate block">
                  {businessName}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-mono">
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

          {/* Navigation Items */}
          <nav className="p-4 space-y-1 flex-1">
            <div className="px-3 pb-2 pt-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase font-mono">
              Core Modules
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              if (item.special) {
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 mt-2 mb-2 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                        : 'text-zinc-300 hover:text-white bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isActive
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-zinc-800 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
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
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-zinc-800/80 text-white font-semibold border border-zinc-700/50 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-300'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Session & System Health (Clean, Business-Friendly) */}
        <div className="p-4 border-t border-zinc-800/60 bg-zinc-950/80 space-y-3">
          {/* User Profile Card */}
          {user ? (
            <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
              <div 
                onClick={() => navigate('/login')}
                className="flex items-center gap-2.5 truncate pr-2 cursor-pointer hover:opacity-85 transition-opacity"
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
              className="w-full p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-between text-indigo-300 text-xs transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold">Sign In / Switch Account</span>
              </div>
            </button>
          )}

          {/* Business System Status (No Developer Jargon) */}
          <div className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-zinc-300 font-medium">System Status</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">Operational</span>
          </div>

          {/* Legal and Compliance Links */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1 pt-0.5">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              Enterprise Protected
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
        <header className="hidden md:flex items-center justify-between px-8 py-4 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-200">
              {navItems.find((n) => n.path === location.pathname)?.name || 'Platform'}
            </h2>
            <span className="text-zinc-600">/</span>
            <span className="text-xs text-zinc-400 font-mono">
              {businessName}
            </span>
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

            <button
              onClick={() => navigate('/brain')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500/10 to-violet-500/10 hover:from-indigo-500/20 hover:to-violet-500/20 text-indigo-400 border border-indigo-500/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask Business Brain</span>
            </button>

            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Order</span>
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
};
