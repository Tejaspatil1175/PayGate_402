import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  ShieldCheck,
  Wallet,
  Bot,
  ShoppingBag,
  Package,
  Calendar,
  Settings,
  Search,
  Bell,
  Heart,
  Mic,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export default function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
      setMobileMenuOpen(false);
    }
  };

  const navItems = [
    {
      to: '/discovery',
      label: 'Catalog',
      icon: <ShoppingBag className="w-5 h-5 lg:w-4 lg:h-4" />,
    },
    {
      to: '/wallet',
      label: 'Wallet',
      icon: <Wallet className="w-5 h-5 lg:w-4 lg:h-4" />,
    },
    {
      to: '/user/marketplace',
      label: 'Agents',
      icon: <Bot className="w-5 h-5 lg:w-4 lg:h-4" />,
    },
    {
      to: '/voice',
      label: 'Voice AI',
      icon: <Mic className="w-5 h-5 lg:w-4 lg:h-4" />,
    },
    {
      to: '/user/orders',
      label: 'Orders',
      icon: <Package className="w-5 h-5 lg:w-4 lg:h-4" />,
    },
    {
      to: '/user/tasks',
      label: 'Scheduling',
      icon: <Calendar className="w-5 h-5 lg:w-4 lg:h-4" />,
    },
    {
      to: '/wishlist',
      label: 'Wishlist',
      icon: <Heart className="w-5 h-5 lg:w-4 lg:h-4" />,
    },
  ];

  // Primary 5 items for mobile bottom bar
  const mobileBottomNavItems = [
    { to: '/discovery', label: 'Catalog', icon: <ShoppingBag className="w-5 h-5" /> },
    { to: '/wallet', label: 'Wallet', icon: <Wallet className="w-5 h-5" /> },
    { to: '/voice', label: 'Voice AI', icon: <Mic className="w-5 h-5" />, isHighlight: true },
    { to: '/user/marketplace', label: 'Agents', icon: <Bot className="w-5 h-5" /> },
    { to: '/user/orders', label: 'Orders', icon: <Package className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#1E293B] flex font-sans overflow-x-hidden">
      {/* ----------------- MOBILE DRAWER BACKDROP & SIDEBAR ----------------- */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-[#E2E8F0] flex flex-col justify-between py-6 px-4 shadow-xl transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:w-64 lg:shadow-sm lg:h-screen lg:shrink-0 lg:sticky ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Brand Logo & Close Button for Mobile */}
          <div className="flex items-center justify-between px-2 py-1">
            <Link
              to="/discovery"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1 leading-none">
                  <span className="font-bold text-lg text-slate-900 tracking-tight">
                    PayGate
                  </span>
                  <span className="font-bold text-lg text-indigo-600 tracking-tight">
                    402
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium tracking-normal mt-1 leading-none">
                  Agentic Commerce
                </span>
              </div>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-sm font-medium">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
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
            onClick={() => setMobileMenuOpen(false)}
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
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-30 shadow-xs">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, agents..."
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] focus:border-indigo-500 focus:bg-white rounded-xl pl-9 pr-3 py-1.5 sm:py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
              />
            </form>
          </div>

          {/* User Profile & Status */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Status Indicator */}
            <div
              className="hidden md:flex items-center justify-center w-8 h-8 bg-emerald-50 rounded-full border border-emerald-200 cursor-default"
              title="Gemini API Connected"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>

            <Link
              to="/wishlist"
              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-50 relative transition"
              title="Wishlist"
            >
              <Heart className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-slate-200 shadow-xs shrink-0 bg-slate-100">
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
                <span className="text-xs font-bold text-slate-800 block max-w-[120px] md:max-w-[140px] truncate">
                  {user?.name || user?.email || 'Tejas Patil'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Buyer Account</span>
              </div>
            </div>
          </div>
        </header>

        {/* ----------------- NESTED USER PAGE CONTENT ----------------- */}
        <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar pb-16 lg:pb-0">
          <Outlet />
        </div>

        {/* ----------------- MOBILE BOTTOM NAVIGATION BAR ----------------- */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-2 py-1.5 flex items-center justify-around shadow-lg">
          {mobileBottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-semibold transition-all ${
                  item.isHighlight
                    ? isActive
                      ? 'text-white bg-indigo-600 shadow-md shadow-indigo-600/30 px-3 py-1.5 -translate-y-1'
                      : 'text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 -translate-y-1'
                    : isActive
                    ? 'text-indigo-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {item.icon}
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
