import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, Outlet } from 'react-router-dom';
import {
  ShieldCheck,
  Store,
  Sliders,
  Package,
  Sparkles,
  Settings,
  Search,
  Bell,
  LogOut,
} from 'lucide-react';

export default function MerchantLayout() {
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const storedMerchant = localStorage.getItem('paygate_merchant');
    if (storedMerchant) {
      try {
        setMerchant(JSON.parse(storedMerchant));
      } catch (err) {
        console.error('Error parsing stored merchant:', err);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('paygate_token');
    localStorage.removeItem('paygate_merchant');
    localStorage.removeItem('paygate_role');
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/merchant/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navItems = [
    {
      to: '/merchant/catalog',
      label: 'Catalog Inventory',
      icon: <Store className="w-4 h-4" />,
    },
    {
      to: '/merchant/policy',
      label: 'Policy Builder',
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      to: '/merchant/orders',
      label: 'Live Orders',
      icon: <Package className="w-4 h-4" />,
    },
    {
      to: '/merchant/copilot',
      label: 'AI Co-Pilot',
      icon: <Sparkles className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#1E293B] flex font-sans">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between py-6 px-4 shrink-0 shadow-sm sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Brand Logo */}
          <Link to="/merchant/catalog" className="flex items-center gap-3 px-2 py-1 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1 leading-none">
                <span
                  style={{ color: '#0f172a' }}
                  className="font-bold text-lg text-slate-900 tracking-tight"
                >
                  PayGate
                </span>
                <span
                  style={{ color: '#4f46e5' }}
                  className="font-bold text-lg text-indigo-600 tracking-tight"
                >
                  402
                </span>
              </div>
              <span
                style={{ color: '#64748b' }}
                className="text-xs text-slate-500 font-medium tracking-normal mt-1 leading-none"
              >
                Merchant Portal
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1 text-sm font-medium">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 ${isActive
                    ? 'bg-indigo-50 text-indigo-600 font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`transition-colors duration-150 ${isActive
                        ? 'text-indigo-600'
                        : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                    >
                      {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-100 pt-4 px-2 space-y-1">
          <Link
            to="/merchant/catalog"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-900 text-sm transition"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-sm transition"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ----------------- MAIN VIEW WRAPPER ----------------- */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* ----------------- TOP HEADER BAR ----------------- */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between gap-4 shrink-0 z-30 shadow-xs">
          {/* Global Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products or orders..."
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500 focus:bg-white rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
            />
          </form>

          {/* User Profile & Notifications */}
          <div className="flex items-center gap-4">
            
            {/* Gemini API Status Indicator */}
            <div className="hidden sm:flex items-center justify-center w-8 h-8 bg-emerald-50 rounded-full border border-emerald-200 cursor-default" title="Gemini API Connected">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>

            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 relative transition">
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
            </button>

            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shadow-xs shrink-0 bg-slate-100 flex items-center justify-center text-indigo-600 font-bold uppercase">
                {merchant?.businessName?.[0] || 'M'}
              </div>
              <div className="text-left hidden sm:block leading-tight">
                <span className="text-xs font-bold text-slate-800 block max-w-[140px] truncate">
                  {merchant?.businessName || merchant?.email || 'Merchant User'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Verified Seller</span>
              </div>
            </div>
          </div>
        </header>

        {/* ----------------- NESTED USER PAGE CONTENT ----------------- */}
        <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
