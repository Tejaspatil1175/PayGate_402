import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  ShieldCheck,
  Store,
  Bot,
  Activity,
  User,
  ShoppingBag,
  Heart,
  Mic,
  PieChart,
  Clock,
  LogOut,
  Sparkles,
  Layers,
  Sliders,
  Package,
} from 'lucide-react';

import ProtectedRoute from './components/ProtectedRoute';
import UserLayout from './components/UserLayout';

// Buyer Pages
import Login from './pages/Login';
import UserRegister from './pages/user/Register';
import UserDashboard from './pages/user/Dashboard';
import UserWallet from './pages/user/Wallet';
import VoiceAssistant from './pages/user/VoiceAssistant';
import ProductDiscovery from './pages/user/ProductDiscovery';
import Wishlist from './pages/user/Wishlist';
import OrderTracking from './pages/user/OrderTracking';
import SpendingAnalytics from './pages/user/SpendingAnalytics';
import ScheduledTasks from './pages/user/ScheduledTasks';
import AgentMarketplace from './pages/user/AgentMarketplace';

// Merchant Pages
import MerchantRegister from './pages/merchant/Register';
import MerchantCatalog from './pages/merchant/Catalog';
import MerchantPolicy from './pages/merchant/Policy';
import MerchantOrders from './pages/merchant/Orders';
import MerchantCoPilot from './pages/merchant/CoPilot';

// Agent Pages
import IntentForm from './pages/agent/IntentForm';
import Matches from './pages/agent/Matches';
import Negotiation from './pages/agent/Negotiation';
import ContractReview from './pages/agent/ContractReview';
import Payment from './pages/agent/Payment';
import OrderStatus from './pages/agent/OrderStatus';

// Admin Pages
import AdminOverview from './pages/admin/Overview';
import AdminMonitoring from './pages/admin/Monitoring';
import AdminMerchantHealth from './pages/admin/MerchantHealth';
import AdminSystemHealth from './pages/admin/SystemHealth';
import AdminConfig from './pages/admin/Config';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeRole, setActiveRole] = useState('user'); // 'user' | 'merchant' | 'agent' | 'admin'
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/merchant')) {
      setActiveRole('merchant');
    } else if (path.startsWith('/agent')) {
      setActiveRole('agent');
    } else if (path.startsWith('/admin')) {
      setActiveRole('admin');
    } else {
      setActiveRole('user');
    }

    const token = localStorage.getItem('paygate_token');
    const storedUser = localStorage.getItem('paygate_user');
    const storedMerchant = localStorage.getItem('paygate_merchant');
    const storedAdmin = localStorage.getItem('paygate_admin');
    const role = localStorage.getItem('paygate_role');

    if (token) {
      if (storedUser) {
        setUserProfile({ ...JSON.parse(storedUser), role: role || 'user' });
      } else if (storedMerchant) {
        setUserProfile({ ...JSON.parse(storedMerchant), role: 'merchant' });
      } else if (storedAdmin) {
        setUserProfile({ ...JSON.parse(storedAdmin), role: 'admin' });
      }
    } else {
      setUserProfile(null);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('paygate_token');
    localStorage.removeItem('paygate_user');
    localStorage.removeItem('paygate_merchant');
    localStorage.removeItem('paygate_admin');
    localStorage.removeItem('paygate_role');
    setUserProfile(null);
    navigate('/login');
  };

  const isAuthenticated = Boolean(userProfile || localStorage.getItem('paygate_token'));
  const isAuthPage = ['/login', '/register', '/merchant/register'].includes(location.pathname);

  const userRoutePrefixes = [
    '/dashboard',
    '/user/dashboard',
    '/discovery',
    '/wallet',
    '/voice',
    '/wishlist',
    '/user/orders',
    '/user/analytics',
    '/user/tasks',
    '/user/marketplace',
  ];
  const isUserRoute =
    activeRole === 'user' ||
    userRoutePrefixes.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  const shouldHideNavbar = isAuthPage || isUserRoute;

  // Determine default authenticated redirect
  const getDefaultRedirect = () => {
    const role = localStorage.getItem('paygate_role') || userProfile?.role;
    if (role === 'merchant') return '/merchant/catalog';
    if (role === 'admin') return '/admin/overview';
    return '/discovery';
  };

  const currentRoleLabel =
    activeRole === 'merchant'
      ? 'Merchant Portal'
      : activeRole === 'admin'
      ? 'Admin Mesh'
      : activeRole === 'agent'
      ? 'AI Agent Hub'
      : 'Buyer Hub';

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#1A1612] flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Role-Scoped Main Navbar (Hidden on Login, Registration & Unified Dashboard pages) */}
      {!shouldHideNavbar && isAuthenticated && (
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-[#E7E2D6] px-4 lg:px-8 py-2.5 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Brand Logo & Current Role Badge */}
            <div className="flex items-center justify-between">
              <Link to={getDefaultRedirect()} className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 leading-none">
                    <span
                      style={{ color: '#0f172a' }}
                      className="font-bold text-lg text-slate-900 tracking-tight"
                    >
                      PayGate <span style={{ color: '#4f46e5' }} className="text-indigo-600">402</span>
                    </span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {currentRoleLabel}
                    </span>
                  </div>
                  <span
                    style={{ color: '#64748b' }}
                    className="text-xs text-slate-500 font-medium tracking-normal mt-1 leading-none"
                  >
                    AP2 / x402 Payment Integrity Mesh
                  </span>
                </div>
              </Link>

              {/* Mobile Logout CTA */}
              <button
                onClick={handleLogout}
                className="lg:hidden p-2 rounded-xl border border-[#E7E2D6] bg-white text-[#78716C] hover:text-rose-600 shadow-sm"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Role-Scoped Center Navigation Links */}
            <nav className="flex items-center gap-1.5 overflow-x-auto text-xs py-1 scrollbar-none">
              {/* Buyer / User Links */}
              {activeRole === 'user' && (
                <>
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </NavLink>
                  <NavLink
                    to="/discovery"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Catalog</span>
                  </NavLink>
                  <NavLink
                    to="/voice"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Voice AI</span>
                  </NavLink>
                  <NavLink
                    to="/wishlist"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>Wishlist</span>
                  </NavLink>
                  <NavLink
                    to="/wallet"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <span>Wallet & Ledger</span>
                  </NavLink>
                  <NavLink
                    to="/user/orders"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <span>Orders</span>
                  </NavLink>
                  <NavLink
                    to="/user/analytics"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <span>Analytics</span>
                  </NavLink>
                  <NavLink
                    to="/user/tasks"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Scheduled</span>
                  </NavLink>
                  <NavLink
                    to="/user/marketplace"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Marketplace</span>
                  </NavLink>
                </>
              )}

              {/* Merchant Portal Links */}
              {activeRole === 'merchant' && (
                <>
                  <NavLink
                    to="/merchant/catalog"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Catalog Inventory</span>
                  </NavLink>
                  <NavLink
                    to="/merchant/policy"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Policy Builder</span>
                  </NavLink>
                  <NavLink
                    to="/merchant/orders"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Live Orders</span>
                  </NavLink>
                  <NavLink
                    to="/merchant/copilot"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                          : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Co-Pilot</span>
                  </NavLink>
                </>
              )}

              {/* AI Agent Hub Links */}
              {activeRole === 'agent' && (
                <>
                  <NavLink
                    to="/agent/intent"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    1. Intent
                  </NavLink>
                  <NavLink
                    to="/agent/matches"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    2. Matches
                  </NavLink>
                  <NavLink
                    to="/agent/negotiation"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    3. Negotiation
                  </NavLink>
                  <NavLink
                    to="/agent/contract"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    4. Contract
                  </NavLink>
                  <NavLink
                    to="/agent/payment"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    5. Payment
                  </NavLink>
                  <NavLink
                    to="/agent/order-status"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    6. Status
                  </NavLink>
                </>
              )}

              {/* Admin Mesh Links */}
              {activeRole === 'admin' && (
                <>
                  <NavLink
                    to="/admin/overview"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    Overview
                  </NavLink>
                  <NavLink
                    to="/admin/monitoring"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    Security Monitoring
                  </NavLink>
                  <NavLink
                    to="/admin/merchant-health"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    Merchant Health
                  </NavLink>
                  <NavLink
                    to="/admin/system-health"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    System Infrastructure
                  </NavLink>
                  <NavLink
                    to="/admin/config"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-xl font-medium transition ${
                        isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-[#57534E] hover:text-[#120F0B] hover:bg-[#F4EFE6]'
                      }`
                    }
                  >
                    Config
                  </NavLink>
                </>
              )}
            </nav>

            {/* User Profile & Sign Out CTA on the Right */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-[#FBF9F4] border border-[#E7E2D6] px-3 py-1.5 rounded-2xl shadow-sm">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {((userProfile?.name || userProfile?.businessName || userProfile?.email || 'U')[0]).toUpperCase()}
                </div>
                <div className="text-left leading-tight">
                  <div className="text-xs font-semibold text-[#120F0B] max-w-[130px] truncate">
                    {userProfile?.name || userProfile?.businessName || userProfile?.email || 'Active Session'}
                  </div>
                  <div className="text-[10px] text-indigo-600 capitalize font-medium">
                    {userProfile?.role || localStorage.getItem('paygate_role') || 'User'}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 rounded-lg text-[#78716C] hover:text-rose-600 hover:bg-rose-50 transition ml-1"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area with Protected Routes */}
      <main className="flex-1">
        <Routes>
          {/* Default Landing Route */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to={getDefaultRedirect()} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<UserRegister />} />
          <Route path="/merchant/register" element={<MerchantRegister />} />

          {/* Protected User/Buyer Portal Routes (Wrapped in sleek UserLayout sidebar + topbar) */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <UserLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/discovery" element={<ProductDiscovery />} />
            <Route path="/catalog" element={<ProductDiscovery />} />
            <Route path="/wallet" element={<UserWallet />} />
            <Route path="/user/marketplace" element={<AgentMarketplace />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/voice" element={<VoiceAssistant />} />
            <Route path="/user/orders" element={<OrderTracking />} />
            <Route path="/user/tasks" element={<ScheduledTasks />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/user/dashboard" element={<UserDashboard />} />
            <Route path="/user/analytics" element={<SpendingAnalytics />} />
          </Route>

          {/* Protected Merchant Portal Routes */}
          <Route
            path="/merchant/catalog"
            element={
              <ProtectedRoute allowedRoles={['merchant']}>
                <MerchantCatalog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/merchant/policy"
            element={
              <ProtectedRoute allowedRoles={['merchant']}>
                <MerchantPolicy />
              </ProtectedRoute>
            }
          />
          <Route
            path="/merchant/orders"
            element={
              <ProtectedRoute allowedRoles={['merchant']}>
                <MerchantOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/merchant/copilot"
            element={
              <ProtectedRoute allowedRoles={['merchant']}>
                <MerchantCoPilot />
              </ProtectedRoute>
            }
          />

          {/* Protected AI Agent Pipeline Routes */}
          <Route
            path="/agent/intent"
            element={
              <ProtectedRoute allowedRoles={['user', 'agent']}>
                <IntentForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/matches"
            element={
              <ProtectedRoute allowedRoles={['user', 'agent']}>
                <Matches />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/negotiation"
            element={
              <ProtectedRoute allowedRoles={['user', 'agent']}>
                <Negotiation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/contract"
            element={
              <ProtectedRoute allowedRoles={['user', 'agent']}>
                <ContractReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/payment"
            element={
              <ProtectedRoute allowedRoles={['user', 'agent']}>
                <Payment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/order-status"
            element={
              <ProtectedRoute allowedRoles={['user', 'agent']}>
                <OrderStatus />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/status"
            element={
              <ProtectedRoute allowedRoles={['user', 'agent']}>
                <OrderStatus />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Mesh Routes */}
          <Route
            path="/admin/overview"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminOverview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/monitoring"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminMonitoring />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/merchant-health"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminMerchantHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/system-health"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSystemHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/config"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminConfig />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route
            path="*"
            element={<Navigate to={isAuthenticated ? getDefaultRedirect() : '/login'} replace />}
          />
        </Routes>
      </main>
    </div>
  );
}
