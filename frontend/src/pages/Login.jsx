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
    <div className="min-h-screen bg-[#FBF9F4] text-[#1A1612] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-[#E7E2D6] rounded-2xl p-8 shadow-xl shadow-slate-200/60 z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 mb-3 shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#120F0B]">
            Welcome to PayGate 402
          </h1>
          <p className="text-sm text-[#57534E] mt-1">
            Sign in to access your AP2 agentic commerce dashboard
          </p>
        </div>

        {/* Role Tab Switcher */}
        <div className="flex bg-[#F4EFE6] p-1.5 rounded-xl border border-[#E7E2D6] mb-6">
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
                    : 'text-[#57534E] hover:text-[#120F0B] hover:bg-white/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#78716C]" />
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
                    : 'pranav@gmail.com'
                }
                className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-3 pl-11 text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#78716C]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-3 pl-11 text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-sm"
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
          <div className="mt-8 text-center text-sm text-[#57534E]">
            Don't have an account?{' '}
            <Link
              to={activeTab === 'merchant' ? '/merchant/register' : '/register'}
              className="text-indigo-600 hover:text-indigo-700 font-semibold transition"
            >
              Register here
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
