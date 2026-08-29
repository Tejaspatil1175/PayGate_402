import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Activity,
  ShieldAlert,
  Store,
  Cpu,
  Sliders,
  LogOut,
  Bell,
  Search,
  CheckCircle2,
  Shield,
  Layers,
  Terminal,
} from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [admin, setAdmin] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const storedAdmin = localStorage.getItem('paygate_admin');
    if (storedAdmin) {
      try {
        setAdmin(JSON.parse(storedAdmin));
      } catch (err) {
        console.error('Error parsing stored admin:', err);
      }
    } else {
      setAdmin({ name: 'System Administrator', email: 'admin@paygate402.io', role: 'admin' });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('paygate_token');
    localStorage.removeItem('paygate_admin');
    localStorage.removeItem('paygate_role');
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/admin/monitoring?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navItems = [
    {
      to: '/admin/overview',
      label: 'Macro Overview',
      icon: <Activity className="w-4 h-4" />,
    },
    {
      to: '/admin/monitoring',
      label: 'Security Monitoring',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      to: '/admin/merchant-health',
      label: 'Merchant Health',
      icon: <Store className="w-4 h-4" />,
    },
    {
      to: '/admin/system-health',
      label: 'System Infrastructure',
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      to: '/admin/config',
      label: 'Platform Config',
      icon: <Sliders className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#1E293B] flex font-sans">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between py-6 px-4 shrink-0 shadow-sm sticky top-0 h-screen overflow-y-auto z-40">
        <div className="space-y-6">
          {/* Brand Logo */}
          <Link to="/admin/overview" className="flex items-center gap-3 px-2 py-1 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-lg text-slate-900 tracking-tight">
                  PayGate
                </span>
                <span className="font-bold text-lg text-indigo-600 tracking-tight">
                  402
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Admin
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium tracking-normal mt-1 leading-none">
                Control Mesh Master
              </span>
            </div>
          </Link>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="px-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit / mesh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
          </form>

          {/* Navigation Links */}
          <nav className="space-y-1 px-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
              Control Modules
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition duration-150 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Admin Profile & Logout Box */}
        <div className="border-t border-slate-100 pt-4 px-2 space-y-3">
          <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {((admin?.name || admin?.email || 'A')[0]).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-900 truncate">
                {admin?.name || 'Root Admin'}
              </span>
              <span className="text-[10px] text-indigo-600 font-mono font-semibold truncate">
                SUPERADMIN
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition border border-rose-200/50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ----------------- MAIN VIEWPORT ----------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Mini Header Bar */}
        <header className="h-14 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-600">
              AP2 / x402 Protocol Mesh Engine · Live Telemetry
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Gate Enforcing</span>
            </div>

            <div className="text-slate-400 text-xs hidden sm:block">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
