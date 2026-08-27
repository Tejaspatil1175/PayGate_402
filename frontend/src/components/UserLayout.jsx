import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, Outlet } from 'react-router-dom';
import {
  ShieldCheck,
  Wallet,
  Bot,
  Compass,
  ShoppingBag,
  Package,
  Calendar,
  PieChart,
  Settings,
  Search,
  Bell,
  Heart,
  Mic,
  LogOut,
} from 'lucide-react';

export default function UserLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('paygate_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing stored user:', err);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('paygate_token');
    localStorage.removeItem('paygate_user');
    localStorage.removeItem('paygate_role');
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/discovery?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navItems = [
    {
      to: '/discovery',
      label: 'Catalog',
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      to: '/wallet',
      label: 'Wallet',
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      to: '/user/marketplace',
      label: 'Agents',
      icon: <Bot className="w-4 h-4" />,
    },
    {
      to: '/wishlist',
      label: 'Wishlist',
      icon: <Heart className="w-4 h-4" />,
    },
    {
      to: '/voice',
      label: 'Voice AI',
      icon: <Mic className="w-4 h-4" />,
    },
    {
      to: '/user/orders',
      label: 'Orders',
      icon: <Package className="w-4 h-4" />,
    },
    {
      to: '/user/tasks',
      label: 'Scheduling',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#1E293B] flex font-sans">
      {/* ----------------- LEFT SIDEBAR NAVIGATION ----------------- */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between py-6 px-4 shrink-0 shadow-sm sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Brand Logo */}
          <Link to="/discovery" className="flex items-center gap-3 px-2 py-1 group">
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
                Agentic Commerce
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
                  `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`transition-colors duration-150 ${
                        isActive
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
            to="/wallet"
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* ----------------- TOP HEADER BAR ----------------- */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
          {/* Global Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, agents, or orders..."
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500 focus:bg-white rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
            />
          </form>

          {/* User Profile & Notifications */}
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 relative transition">
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
            </button>

            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 shadow-xs shrink-0 bg-slate-100">
                <img
                  src="/profile image.png"
                  alt={user?.name || 'Profile'}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/image.png';
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-left hidden sm:block leading-tight">
                <span className="text-xs font-bold text-slate-800 block max-w-[140px] truncate">
                  {user?.name || user?.email || 'Tejas Patil'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Buyer Account</span>
              </div>
            </div>
          </div>
        </header>

        {/* ----------------- NESTED USER PAGE CONTENT ----------------- */}
        <div className="flex-1">
          <Outlet />
        </div>

        {/* ----------------- BOTTOM FOOTER ----------------- */}
        <footer className="py-3 px-6 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
          PayGate 402 — Razorpay AI Buildathon | AP2 / x402 Payment Integrity Mesh
        </footer>
      </div>
    </div>
  );
}
