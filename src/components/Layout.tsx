import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  Database,
  ArrowUpRight,
  ShieldCheck,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { User } from '../types';

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
  const location = useLocation();
  const navigate = useNavigate();

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
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-base">BUSSINEX</span>
            <span className="text-[10px] text-zinc-400 block -mt-1 font-mono">ENTERPRISE</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold tracking-tight text-white text-base leading-none">
                  BUSSINEX
                </h1>
                <p className="text-[10px] font-mono tracking-wider text-sky-400/90 mt-1 uppercase">
                  Business Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Quick Business Identifier */}
          <div className="px-6 py-3 bg-zinc-900/30 border-b border-zinc-800/40 flex items-center justify-between">
            <div className="truncate pr-2">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider block font-medium">
                Tenant Workspace
              </span>
              <span className="text-xs font-semibold text-zinc-300 truncate block">
                {businessName}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
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
                        ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-sky-300 border border-sky-500/30 shadow-lg shadow-sky-500/10'
                        : 'text-zinc-300 hover:text-white bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isActive
                            ? 'bg-sky-500 text-zinc-950 font-bold'
                            : 'bg-zinc-800 text-sky-400 group-hover:bg-sky-500 group-hover:text-zinc-950 transition-colors'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
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
                        isActive ? 'text-sky-400' : 'text-zinc-400 group-hover:text-zinc-300'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Session & System Health */}
        <div className="p-4 border-t border-zinc-800/60 bg-zinc-950/80 space-y-3">
          {/* User Profile Card */}
          {user ? (
            <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between">
              <div 
                onClick={() => navigate('/login')}
                className="flex items-center gap-2.5 truncate pr-2 cursor-pointer hover:opacity-85 transition-opacity"
                title="Click to Switch Enterprise Tenant"
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300 shrink-0">
                  <UserIcon className="w-3.5 h-3.5 text-sky-400" />
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate('/login')}
                  title="Switch Tenant"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-sky-400 hover:bg-zinc-800 transition-colors"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Sign Out / Reset Session"
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="w-full p-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 flex items-center justify-between text-sky-300 text-xs transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold">Sign In / Switch Tenant</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-sky-400 opacity-70" />
            </button>
          )}

          <div className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[11px] text-zinc-300 font-medium">PostgreSQL Engine</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono">ACID Safe</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              Multi-Tenant Isolated
            </span>
            <span className="font-mono text-zinc-500">Vercel Ready</span>
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
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/brain')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500/10 to-indigo-500/10 hover:from-sky-500/20 hover:to-indigo-500/20 text-sky-400 border border-sky-500/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask Business Brain</span>
              <ArrowUpRight className="w-3 h-3 opacity-60" />
            </button>

            <button
              onClick={() => navigate('/orders')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-zinc-950 transition-all shadow-md shadow-sky-500/15 cursor-pointer"
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
