import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Store, ShieldCheck, Mail, Lock, ArrowRight } from 'lucide-react';
import apiClient from '../api/client';

export default function Login() {
  const [activeTab, setActiveTab] = useState('user'); // 'user' | 'merchant' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let endpoint = '/user/auth/login';
      let redirectPath = '/user/dashboard';
      let userKey = 'paygate_user';

      if (activeTab === 'merchant') {
        endpoint = '/merchant/auth/login';
        redirectPath = '/merchant/dashboard';
        userKey = 'paygate_merchant';
      } else if (activeTab === 'admin') {
        endpoint = '/admin/auth/login';
        redirectPath = '/admin/dashboard';
        userKey = 'paygate_admin';
      }

      const response = await apiClient.post(endpoint, { email, password });

      if (response.data?.success) {
        const { token } = response.data;
        const profileData = response.data.user || response.data.merchant || response.data.admin;

        localStorage.setItem('paygate_token', token);
        localStorage.setItem('paygate_role', activeTab);
        if (profileData) {
          localStorage.setItem(userKey, JSON.stringify(profileData));
        }

        navigate(redirectPath);
      }
    } catch (err) {
      setError(err.error || err.message || 'Login failed. Please check credentials.');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl z-10">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            Welcome to PayGate 402
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Sign in to access your AP2 agentic commerce dashboard
          </p>
        </div>

        {/* Role Tab Switcher */}
        <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80 mb-6">
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
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  activeTab === 'admin'
                    ? 'admin@paygate402.com'
                    : activeTab === 'merchant'
                    ? 'merchant@store.com'
                    : 'alice@example.com'
                }
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 pl-11 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 pl-11 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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

        {/* Registration link (hidden for Admin per step 46) */}
        {activeTab !== 'admin' && (
          <div className="mt-8 text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link
              to={activeTab === 'merchant' ? '/merchant/register' : '/user/register'}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition"
            >
              Register here
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
