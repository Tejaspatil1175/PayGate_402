import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import apiClient from '../../api/client';

export default function UserRegister() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/user/auth/register', {
        name,
        email,
        password,
      });

      if (response.data?.success) {
        const { token, user } = response.data;
        if (token) localStorage.setItem('paygate_token', token);
        if (user) localStorage.setItem('paygate_user', JSON.stringify(user));

        localStorage.setItem('paygate_role', 'user');
        navigate('/discovery');
      }
    } catch (err) {
      setError(err.error || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#1A1612] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-[#E7E2D6] rounded-2xl p-8 shadow-xl shadow-slate-200/60 z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 mb-3 shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#120F0B]">
            Create Buyer Account
          </h1>
          <p className="text-sm text-[#57534E] mt-1">
            Join PayGate 402 for autonomous AP2 agentic commerce
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#78716C]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pranav Patil"
                className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-3 pl-11 text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-sm"
              />
            </div>
          </div>

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
                placeholder="pranav@gmail.com"
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
                minLength={6}
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
              <span>Creating Account...</span>
            ) : (
              <>
                <span>Sign Up & Activate Wallet</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-[#57534E]">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold transition">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
