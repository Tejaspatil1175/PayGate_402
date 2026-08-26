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
  Layers,
  Sliders,
  Sparkles,
  Package,
} from 'lucide-react';

import ProtectedRoute from './components/ProtectedRoute';

// Buyer Pages
import Login from './pages/Login';
import UserRegister from './pages/user/Register';
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
    // Auto-detect role from path
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

  // Determine default authenticated redirect
  const getDefaultRedirect = () => {
    const role = localStorage.getItem('paygate_role') || userProfile?.role;
    if (role === 'merchant') return '/merchant/catalog';
    if (role === 'admin') return '/admin/overview';
    return '/discovery';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Main Navbar */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center justify-between">
            <Link to={isAuthenticated ? getDefaultRedirect() : '/login'} className="flex items-center gap-2.5 group">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                  PayGate 402
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                    AP2 Mesh
                  </span>
                </span>
                <span className="text-[10px] text-slate-400">Autonomous Agentic Commerce Gateway</span>
              </div>
            </Link>

            {/* Mobile Auth Button */}
            <div className="md:hidden flex items-center gap-2">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 font-semibold text-white"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Role Hub Switcher Tabs (Only when authenticated) */}
          {isAuthenticated && (
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800/90 p-1 rounded-xl self-start md:self-auto overflow-x-auto max-w-full">
              <NavLink
                to="/discovery"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    isActive || activeRole === 'user'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Buyer Hub</span>
              </NavLink>

              <NavLink
                to="/merchant/catalog"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    isActive || activeRole === 'merchant'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <Store className="w-3.5 h-3.5" />
                <span>Merchant Portal</span>
              </NavLink>

              <NavLink
                to="/agent/intent"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    isActive || activeRole === 'agent'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI Agent Hub</span>
              </NavLink>

              <NavLink
                to="/admin/overview"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    isActive || activeRole === 'admin'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Admin Mesh</span>
              </NavLink>
            </div>
          )}

          {/* User Profile & Auth CTA */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800/80 px-3 py-1.5 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-xs">
                  {((userProfile?.name || userProfile?.businessName || userProfile?.email || 'U')[0]).toUpperCase()}
                </div>
                <div className="text-left leading-tight">
                  <div className="text-xs font-semibold text-slate-200 max-w-[120px] truncate">
                    {userProfile?.name || userProfile?.businessName || userProfile?.email || 'Active Session'}
                  </div>
                  <div className="text-[10px] text-indigo-400 capitalize">
                    {userProfile?.role || localStorage.getItem('paygate_role') || 'User'}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20"
                >
                  Sign In / Switch Role
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
                >
                  Create Buyer Account
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Context Sub-Navbar (When Authenticated) */}
        {isAuthenticated && (
          <div className="max-w-7xl mx-auto pt-2 border-t border-slate-800/40 flex items-center gap-2 overflow-x-auto text-xs py-1">
            {activeRole === 'user' && (
              <>
                <NavLink to="/discovery" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Catalog Discovery</NavLink>
                <NavLink to="/voice" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${isActive ? 'text-amber-400 font-semibold bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'}`}><Mic className="w-3 h-3" /> Voice AI Assistant</NavLink>
                <NavLink to="/wishlist" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${isActive ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-slate-200'}`}><Heart className="w-3 h-3" /> Wishlist</NavLink>
                <NavLink to="/wallet" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Wallet & Ledger</NavLink>
                <NavLink to="/user/orders" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Order Tracking</NavLink>
                <NavLink to="/user/analytics" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Spending Analytics</NavLink>
                <NavLink to="/user/tasks" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${isActive ? 'text-amber-400 font-semibold bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'}`}><Clock className="w-3 h-3" /> Scheduled Tasks</NavLink>
                <NavLink to="/user/marketplace" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Agent Marketplace</NavLink>
              </>
            )}

            {activeRole === 'merchant' && (
              <>
                <NavLink to="/merchant/catalog" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Catalog Inventory</NavLink>
                <NavLink to="/merchant/policy" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Policy Rule Builder</NavLink>
                <NavLink to="/merchant/orders" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Live Order Stream</NavLink>
                <NavLink to="/merchant/copilot" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${isActive ? 'text-amber-400 font-semibold bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'}`}><Sparkles className="w-3 h-3" /> AI Co-Pilot Suggestions</NavLink>
                <NavLink to="/merchant/register" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Store Onboarding</NavLink>
              </>
            )}

            {activeRole === 'agent' && (
              <>
                <NavLink to="/agent/intent" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>1. Intent Submission</NavLink>
                <NavLink to="/agent/matches" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>2. Match Results</NavLink>
                <NavLink to="/agent/negotiation" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>3. Price Negotiation</NavLink>
                <NavLink to="/agent/contract" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>4. Contract Review</NavLink>
                <NavLink to="/agent/payment" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>5. Gated Payment</NavLink>
                <NavLink to="/agent/order-status" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-indigo-400 font-semibold bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200'}`}>6. Fulfillment Status</NavLink>
              </>
            )}

            {activeRole === 'admin' && (
              <>
                <NavLink to="/admin/overview" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-purple-400 font-semibold bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Platform Overview</NavLink>
                <NavLink to="/admin/monitoring" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-purple-400 font-semibold bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Security Monitoring</NavLink>
                <NavLink to="/admin/merchant-health" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-purple-400 font-semibold bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Merchant Network Health</NavLink>
                <NavLink to="/admin/system-health" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-purple-400 font-semibold bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'}`}>System Infrastructure</NavLink>
                <NavLink to="/admin/config" className={({ isActive }) => `px-2.5 py-1 rounded-lg transition ${isActive ? 'text-purple-400 font-semibold bg-purple-500/10' : 'text-slate-400 hover:text-slate-200'}`}>Mesh Configuration</NavLink>
              </>
            )}
          </div>
        )}
      </header>

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

          {/* Protected User/Buyer Portal Routes */}
          <Route
            path="/discovery"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <ProductDiscovery />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <UserWallet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voice"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <VoiceAssistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wishlist"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <Wishlist />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/orders"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <OrderTracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/analytics"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <SpendingAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/tasks"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <ScheduledTasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/marketplace"
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <AgentMarketplace />
              </ProtectedRoute>
            }
          />

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
