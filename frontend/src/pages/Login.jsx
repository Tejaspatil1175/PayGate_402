import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Store,
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import apiClient from '../api/client';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  testGeminiConnection,
} from '../utils/gemini';

const DEMO_PROFILES = {
  user: {
    _id: 'usr_demo_buyer_001',
    name: 'Demo Buyer',
    email: 'buyer@demo.com',
    role: 'buyer',
    walletId: 'wal_demo_buyer_001',
    balance: 5000,
  },
  merchant: {
    _id: 'mer_demo_store_001',
    businessName: 'AP2 Apex Store',
    email: 'merchant@demo.com',
    role: 'merchant',
    status: 'approved',
    businessCategory: 'Electronics',
  },
  admin: {
    _id: 'adm_demo_super_001',
    name: 'PayGate Admin',
    email: 'admin@demo.com',
    role: 'admin',
  },
};

export default function Login() {
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'merchant' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Direct Frontend Gemini API Key Integration
  const [geminiKey, setGeminiKeyInput] = useState(getGeminiApiKey());
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState(null); // 'connected' | 'testing' | 'error' | null
  const [geminiMsg, setGeminiMsg] = useState('');

  // Auto-fill demo credentials on tab switch
  useEffect(() => {
    if (activeTab === 'user') {
      setEmail('buyer@demo.com');
      setPassword('Password123!');
    } else if (activeTab === 'merchant') {
      setEmail('merchant@demo.com');
      setPassword('Password123!');
    } else if (activeTab === 'admin') {
      setEmail('admin@demo.com');
      setPassword('Password123!');
    }
  }, [activeTab]);

  const handleTestGemini = async () => {
    setGeminiStatus('testing');
    setGeminiMsg('Testing Gemini 1.5 Flash connectivity...');
    const res = await testGeminiConnection(geminiKey.trim());
    if (res.success) {
      setGeminiStatus('connected');
      setGeminiMsg('Google Gemini API connected & ready!');
      setGeminiApiKey(geminiKey.trim());
    } else {
      setGeminiStatus('error');
      setGeminiMsg(res.error || 'Connection failed');
    }
  };

  const handleSaveGeminiKey = (newKey) => {
    setGeminiKeyInput(newKey);
    setGeminiApiKey(newKey);
  };

  const executeDirectLogin = (role = activeTab) => {
    const profile = DEMO_PROFILES[role] || DEMO_PROFILES.user;
    const token = `paygate_direct_jwt_${role}_${Date.now()}`;
    const userKey =
      role === 'merchant'
        ? 'paygate_merchant'
        : role === 'admin'
        ? 'paygate_admin'
        : 'paygate_user';
    const redirectPath =
      role === 'merchant'
        ? '/merchant/catalog'
        : role === 'admin'
        ? '/admin/overview'
        : '/discovery';

    localStorage.setItem('paygate_token', token);
    localStorage.setItem('paygate_role', role);
    localStorage.setItem(userKey, JSON.stringify(profile));

    if (geminiKey.trim()) {
      setGeminiApiKey(geminiKey.trim());
    }

    navigate(redirectPath);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Save Gemini key locally regardless of backend
    if (geminiKey.trim()) {
      setGeminiApiKey(geminiKey.trim());
    }

    try {
      let endpoint = '/user/auth/login';
      let redirectPath = '/discovery';
      let userKey = 'paygate_user';

      if (activeTab === 'merchant') {
        endpoint = '/merchant/auth/login';
        redirectPath = '/merchant/catalog';
        userKey = 'paygate_merchant';
      } else if (activeTab === 'admin') {
        endpoint = '/admin/auth/login';
        redirectPath = '/admin/overview';
        userKey = 'paygate_admin';
      }

      const response = await apiClient.post(endpoint, { email, password });

      if (response.data?.success) {
        const { token } = response.data;
        const profileData =
          response.data.user || response.data.merchant || response.data.admin;

        localStorage.setItem('paygate_token', token);
        localStorage.setItem('paygate_role', activeTab);
        if (profileData) {
          localStorage.setItem(userKey, JSON.stringify(profileData));
        }

        navigate(redirectPath);
      } else {
        // Backend didn't return success, use direct frontend login fallback
        console.warn('Backend login unsuccessful, using direct frontend login.');
        executeDirectLogin(activeTab);
      }
    } catch (err) {
      console.warn('Backend offline or unreachable, logging in directly in frontend mode:', err);
      // Seamless direct frontend login fallback!
      executeDirectLogin(activeTab);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'user', label: 'Buyer', icon: User },
    { id: 'merchant', label: 'Merchant', icon: Store },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#1A1612] flex items-center justify-center p-3 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 sm:-top-40 sm:-left-40 w-72 sm:w-96 h-72 sm:h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 sm:-bottom-40 sm:-right-40 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-[#E7E2D6] rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl shadow-slate-200/60 z-10 my-4">
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 mb-3 shadow-xs">
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#120F0B]">
            Welcome to PayGate 402
          </h1>
          <p className="text-xs sm:text-sm text-[#57534E] mt-1">
            Sign in to access your AP2 agentic commerce dashboard
          </p>
        </div>

        {/* Role Tab Switcher */}
        <div className="flex bg-[#F4EFE6] p-1 sm:p-1.5 rounded-xl border border-[#E7E2D6] mb-5 sm:mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setError('');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-[#57534E] hover:text-[#120F0B] hover:bg-white/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Direct Gemini API Key Integration Card */}
        <div className="mb-5 p-3 sm:p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Direct Gemini AI API Key</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Client-Side
            </span>
          </div>
          <div className="relative mb-2">
            <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400" />
            <input
              type={showGeminiKey ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => handleSaveGeminiKey(e.target.value)}
              placeholder="Paste Gemini API Key..."
              className="w-full bg-white border border-indigo-200 focus:border-indigo-500 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowGeminiKey(!showGeminiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-600"
              title={showGeminiKey ? 'Hide key' : 'Show key'}
            >
              {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleTestGemini}
              disabled={geminiStatus === 'testing'}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {geminiStatus === 'testing' ? 'Verifying...' : '⚡ Test Gemini Key'}
            </button>
            {geminiMsg && (
              <span
                className={`text-[10px] truncate ${
                  geminiStatus === 'connected'
                    ? 'text-emerald-600 font-medium'
                    : 'text-rose-600'
                }`}
              >
                {geminiMsg}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#78716C]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-3.5 py-2.5 sm:py-3 pl-10 sm:pl-11 text-xs sm:text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#78716C]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-3.5 py-2.5 sm:py-3 pl-10 sm:pl-11 pr-10 text-xs sm:text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl py-2.5 sm:py-3 px-4 flex items-center justify-center gap-2 transition shadow-md shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-xs sm:text-sm cursor-pointer"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In as {tabs.find((t) => t.id === activeTab)?.label}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Direct Frontend Login (No Backend Required) */}
        <div className="mt-4 pt-4 border-t border-[#E7E2D6]">
          <button
            type="button"
            onClick={() => executeDirectLogin(activeTab)}
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold rounded-xl py-2.5 px-3 flex items-center justify-center gap-1.5 transition text-xs cursor-pointer shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>⚡ Direct Instant Login as {tabs.find((t) => t.id === activeTab)?.label} (No Backend)</span>
          </button>
        </div>

        {/* Registration link */}
        {activeTab !== 'admin' && (
          <div className="mt-4 text-center text-xs text-[#57534E]">
            Don't have an account?{' '}
            <Link
              to={activeTab === 'merchant' ? '/merchant/register' : '/register'}
              className="text-indigo-600 hover:text-indigo-700 font-bold transition"
            >
              Register here
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
