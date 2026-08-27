import React, { useState, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  PlusCircle,
  History,
  Sliders,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ShieldCheck,
  CreditCard,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Zap,
  Landmark,
  Smartphone,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Search,
  Filter,
  FileText,
} from 'lucide-react';
import apiClient from '../../api/client';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function UserWallet() {
  const [wallet, setWallet] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [topUpLoading, setTopUpLoading] = useState(false);

  const [perTxCap, setPerTxCap] = useState('10000');
  const [perDayCap, setPerDayCap] = useState('50000');
  const [capSaving, setCapSaving] = useState(false);

  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [ledgerSearch, setLedgerSearch] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Auto-dismiss notification toasts after a few seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const [balRes, histRes] = await Promise.all([
        apiClient.get('/wallet/balance', { params: { userId } }),
        apiClient.get('/wallet/history', { params: { userId } }),
      ]);

      if (balRes.data?.success) {
        setWallet(balRes.data.wallet);
        setPerTxCap(String(balRes.data.wallet.perTransactionCap || 10000));
        setPerDayCap(String(balRes.data.wallet.perDayCap || 50000));
      }
      if (histRes.data?.success) {
        setHistory(histRes.data.ledger || []);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const handleTopUp = async (e) => {
    e.preventDefault();
    if (!topUpAmount || Number(topUpAmount) <= 0) return;

    setTopUpLoading(true);
    setMessage('');
    setError('');

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.post('/wallet/topup', {
        userId,
        amount: Number(topUpAmount),
      });

      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Failed to create top-up order');
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        setError('Could not load Razorpay checkout. Check your internet connection and try again.');
        setTopUpLoading(false);
        return;
      }

      const { orderId, amount, currency, key } = res.data;

      const options = {
        key,
        amount: Math.round(amount * 100),
        currency: currency || 'INR',
        name: 'PayGate 402',
        description: 'AP2 Agent Wallet Top-Up',
        order_id: orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        notes: {
          purpose: 'wallet_topup',
          userId,
        },
        theme: { color: '#4f46e5' },
        handler: function () {
          setMessage('Payment successful! Confirming with the server...');
          setTimeout(fetchWalletData, 2500);
        },
        modal: {
          ondismiss: function () {
            setTopUpLoading(false);
            setError('Payment was cancelled before completion.');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setError(response?.error?.description || 'Payment failed. Please try again.');
        setTopUpLoading(false);
      });
      rzp.open();
      setTopUpLoading(false);
    } catch (err) {
      setError(err.error || err.message || 'Top-up failed');
      setTopUpLoading(false);
    }
  };

  const handleUpdateCaps = async (e) => {
    e.preventDefault();
    setCapSaving(true);
    setMessage('');
    setError('');

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.put('/wallet/caps', {
        userId,
        perTransactionCap: Number(perTxCap),
        perDayCap: Number(perDayCap),
      });

      if (res.data?.success) {
        setMessage('Wallet spend caps updated successfully!');
        setWallet(res.data.wallet);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update caps');
    } finally {
      setCapSaving(false);
    }
  };

  const handleCopyWalletId = () => {
    const id = wallet?.walletId || wallet?._id || 'AP2-MESH-402';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(String(id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const dailyCap = wallet?.perDayCap || 50000;
  const dailySpent = wallet?.dailySpent || 0;
  const remainingCap = Math.max(0, dailyCap - dailySpent);
  const capPercent = Math.min(100, Math.round((dailySpent / (dailyCap || 1)) * 100));

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <WalletIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                AP2 Agent Wallet
              </h1>
              <p className="text-sm text-slate-500">
                Shared autonomous spending ledger & custom transaction guardrails
              </p>
            </div>
          </div>
          <button
            onClick={fetchWalletData}
            disabled={loading}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        {/* Top Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Balance Card (Razorpay Signature Royal Blue) */}
          <div className="lg:col-span-2 bg-gradient-to-br from-[#0c2340] via-[#0a2c54] to-[#071d37] border border-[#1b3d68] text-white rounded-2xl p-5 md:p-6 shadow-md flex flex-col justify-between space-y-5 relative overflow-hidden group">
            {/* Ambient Razorpay Blue Glow */}
            <div className="absolute -top-20 -right-20 w-56 h-56 bg-[#3395FF]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-[#00D2D3]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Background Wallet Watermark Logo & Concentric Geometric Rings */}
            <div className="absolute right-2 -bottom-4 opacity-[0.09] text-sky-200 pointer-events-none select-none transition-transform duration-700 group-hover:scale-105">
              <WalletIcon className="w-44 h-44 stroke-[1.2]" />
            </div>
            <div className="absolute -right-12 -bottom-12 w-60 h-60 border border-white/5 rounded-full pointer-events-none" />
            <div className="absolute -right-24 -bottom-24 w-84 h-84 border border-white/5 rounded-full pointer-events-none" />

            {/* Top Bar: Title, Verified Tag & Eye Action */}
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#133863] border border-[#23528b] flex items-center justify-center text-[#3395FF] shadow-xs">
                  <WalletIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">
                      Wallet Balance
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      ● Active
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-mono">
                    <span>ID: AP2-{(wallet?._id || wallet?.walletId || '4020').slice(-6).toUpperCase()}</span>
                    <button
                      type="button"
                      onClick={handleCopyWalletId}
                      className="hover:text-white transition text-sky-300"
                      title="Copy ID"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-400 inline" />
                      ) : (
                        <Copy className="w-3 h-3 inline" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Eye Toggle Button */}
              <button
                type="button"
                onClick={() => setShowBalance((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#163863]/80 hover:bg-[#1f4a80] border border-[#2b588e] text-xs font-semibold text-slate-200 hover:text-white transition cursor-pointer"
                title={showBalance ? 'Hide Balance' : 'Show Balance'}
              >
                {showBalance ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-[#528FF0]" />
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>

            {/* Main Balance Display */}
            <div className="relative z-10 space-y-1">
              <span className="text-[11px] font-bold text-[#528FF0] uppercase tracking-wider block">
                AVAILABLE FUNDS
              </span>
              <div
                onClick={() => setShowBalance((prev) => !prev)}
                className="inline-flex items-center gap-3 cursor-pointer group/bal select-none"
              >
                {showBalance ? (
                  <div className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-baseline gap-1.5">
                    <span className="text-2xl text-[#3395FF] font-bold">₹</span>
                    <span>
                      {(wallet?.balance || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl md:text-3xl font-mono font-black text-sky-300 tracking-widest">
                      ₹******
                    </span>
                    <span className="text-[11px] font-bold text-sky-200 group-hover/bal:text-white bg-[#1a406e] group-hover/bal:bg-[#23538c] px-2 py-0.5 rounded-md border border-[#2c5b96] transition">
                      reveal
                    </span>
                  </div>
                )}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#133863] text-sky-200 border border-[#23528b] self-center">
                  INR
                </span>
              </div>
            </div>

            {/* Guardrails Policy & Usage Bar */}
            <div className="relative z-10 space-y-2.5 pt-3 border-t border-[#1b3d68]">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-medium">Daily Limit ({capPercent}% used)</span>
                <span className="font-semibold text-white">
                  {showBalance ? `₹${dailySpent.toLocaleString('en-IN')} / ₹${dailyCap.toLocaleString('en-IN')}` : '₹****** / ₹******'}
                </span>
              </div>
              <div className="w-full bg-[#061528] rounded-full h-2 overflow-hidden border border-[#1b3d68]/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#3395FF] to-[#00D2D3] transition-all duration-500"
                  style={{ width: `${capPercent}%` }}
                />
              </div>

              {/* Compact Stats Row */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="bg-[#081c36]/90 border border-[#1a3c66] rounded-xl p-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    SPENT TODAY
                  </span>
                  <span className="font-bold text-white text-sm">
                    {showBalance ? `₹${dailySpent.toLocaleString('en-IN')}` : '₹******'}
                  </span>
                </div>
                <div className="bg-[#081c36]/90 border border-[#1a3c66] rounded-xl p-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    REMAINING DAILY
                  </span>
                  <span className="font-bold text-emerald-300 text-sm">
                    {showBalance ? `₹${remainingCap.toLocaleString('en-IN')}` : '₹******'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Top-Up Form (Razorpay Powered Checkout) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Instant Top-Up</h3>
                    <span className="text-[10px] text-slate-400 font-medium">Non-custodial AP2 credit</span>
                  </div>
                </div>

                {/* Razorpay Brand Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0c2340] text-white text-[10px] font-bold shadow-2xs">
                  <svg className="w-3 h-3 fill-current text-[#3395FF]" viewBox="0 0 24 24">
                    <path d="M22.436 0l-11.91 7.773-1.164 4.238 6.477-4.225-4.887 16.214h4.94l6.544-24zM1.564 24l5.922-19.646 5.864-3.827-4.73 15.688-6.056 3.955-1-4.17 4.195-2.738 1.94-6.435-4.267 2.785-1.868 6.198z" />
                  </svg>
                  <span>Razorpay</span>
                </div>
              </div>

              <form onSubmit={handleTopUp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Enter Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      min="100"
                      max="100000"
                      required
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="1000"
                      className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl pl-8 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 font-bold outline-none transition"
                    />
                  </div>
                </div>

                {/* Preset Amount Pills */}
                <div className="flex items-center gap-1.5">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(String(amt))}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        topUpAmount === String(amt)
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600'
                      }`}
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>

                {/* Pay via Razorpay Button with Official Logo */}
                <button
                  type="submit"
                  disabled={topUpLoading}
                  className="w-full bg-[#0c2340] hover:bg-[#071d37] text-white text-xs font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-current text-[#3395FF]" viewBox="0 0 24 24">
                    <path d="M22.436 0l-11.91 7.773-1.164 4.238 6.477-4.225-4.887 16.214h4.94l6.544-24zM1.564 24l5.922-19.646 5.864-3.827-4.73 15.688-6.056 3.955-1-4.17 4.195-2.738 1.94-6.435-4.267 2.785-1.868 6.198z" />
                  </svg>
                  <span>{topUpLoading ? 'Processing Checkout...' : 'Pay via Razorpay'}</span>
                </button>
              </form>
            </div>

            {/* Supported Payment Methods Strip */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                Supported Payment Options
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 text-center">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[9px] font-bold text-slate-700">UPI / QR</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 text-center">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[9px] font-bold text-slate-700">Cards</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 text-center">
                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[9px] font-bold text-slate-700">NetBanking</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 text-center">
                  <WalletIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[9px] font-bold text-slate-700">Wallets</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-0.5 font-medium">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>100% Secure • 256-bit SSL Encrypted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Spend Caps & Autonomous Guardrails Settings (Compact Version) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>Autonomous Spending Guardrails</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    ● Enforced by AP2
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Cryptographic spend limits for automated voice checkout routines & agents.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleUpdateCaps} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Per-Transaction Cap */}
              <div className="bg-[#F8FAFC] border border-slate-200/90 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Per-Transaction Cap
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold">Single purchase limit</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      min="500"
                      max="1000000"
                      required
                      value={perTxCap}
                      onChange={(e) => setPerTxCap(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-900 font-bold outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {[2000, 5000, 10000, 25000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPerTxCap(String(val))}
                        className={`py-1 px-1.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                          perTxCap === String(val)
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        ₹{val >= 1000 ? `${val / 1000}k` : val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Per-Day Spending Cap */}
              <div className="bg-[#F8FAFC] border border-slate-200/90 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Daily Cumulative Cap
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold">24h total ceiling</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      min="1000"
                      max="5000000"
                      required
                      value={perDayCap}
                      onChange={(e) => setPerDayCap(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-900 font-bold outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {[10000, 25000, 50000, 100000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPerDayCap(String(val))}
                        className={`py-1 px-1.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                          perDayCap === String(val)
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        ₹{val >= 100000 ? `${val / 100000}L` : `${val / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>Hardware-Bound AP2 Vault</span>
                </div>
                <span className="hidden sm:inline">•</span>
                <div className="hidden sm:flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Sub-second Verification</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={capSaving}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl py-2 px-5 flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{capSaving ? 'Updating...' : 'Update Spend Caps'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Transaction History Ledger */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-7 shadow-xs space-y-5">
          {/* Header & Cryptographic Verify Tag */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">
                    Wallet Ledger & Audit Trail
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Immutable Hash
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Double-entry cryptographic ledger record for AP2 transactions.
                </p>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'credit', label: 'Inflow (+)' },
                  { id: 'debit', label: 'Outflow (-)' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLedgerFilter(tab.id)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                      ledgerFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none w-36 sm:w-44 transition"
                />
              </div>
            </div>
          </div>

          {/* Ledger Volume Statistics Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Recorded</span>
              <span className="text-sm font-black text-slate-800">{history.length} Transactions</span>
            </div>
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Inflow</span>
              <span className="text-sm font-black text-emerald-600">
                +₹{history.filter((t) => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outflow</span>
              <span className="text-sm font-black text-slate-700">
                -₹{history.filter((t) => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Ledger List */}
          {(() => {
            const filtered = history.filter((tx) => {
              if (ledgerFilter === 'credit' && tx.type !== 'credit') return false;
              if (ledgerFilter === 'debit' && tx.type !== 'debit') return false;
              if (ledgerSearch.trim()) {
                const q = ledgerSearch.toLowerCase();
                const desc = (tx.description || tx.type || '').toLowerCase();
                const id = (tx._id || tx.transactionId || '').toLowerCase();
                return desc.includes(q) || id.includes(q);
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-slate-600 font-bold text-xs">No transactions match your filter.</p>
                  <p className="text-slate-400 text-[11px]">Top up your wallet or make a purchase to see new ledger entries.</p>
                </div>
              );
            }

            return (
              <div className="space-y-2.5">
                {filtered.map((tx, idx) => {
                  const isCredit = tx.type === 'credit';
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200/70 hover:border-indigo-200 bg-white hover:bg-slate-50/70 transition flex items-center justify-between gap-4 text-xs group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-2xs shrink-0 ${
                            isCredit
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : 'bg-indigo-50 border-indigo-200 text-indigo-600'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {tx.description || (isCredit ? 'Wallet Top-Up' : 'Agent Payment')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                isCredit
                                  ? 'bg-emerald-100/70 text-emerald-800'
                                  : 'bg-indigo-100/70 text-indigo-800'
                              }`}
                            >
                              {isCredit ? 'CREDIT' : 'DEBIT'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-slate-400 text-[11px] font-mono mt-0.5">
                            <span>
                              {tx.timestamp
                                ? new Date(tx.timestamp).toLocaleString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Recent'}
                            </span>
                            <span>•</span>
                            <span>TX-{(tx._id || tx.transactionId || `AP2-${idx}`).slice(-8).toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-black text-sm md:text-base ${
                            isCredit ? 'text-emerald-600' : 'text-slate-900'
                          }`}
                        >
                          {isCredit ? '+' : '-'}₹
                          {(tx.amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Post Balance: ₹{(tx.balanceAfter || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Floating Notification Pop-ups (Toasts) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 md:px-0">
        {error && (
          <div className="pointer-events-auto bg-slate-900 text-white border border-rose-500/50 p-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-bounce-short">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 pr-1">
              <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Error Notification</h4>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {message && (
          <div className="pointer-events-auto bg-slate-900 text-white border border-emerald-500/50 p-4 rounded-2xl shadow-2xl flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 pr-1">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Success Notification</h4>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">{message}</p>
            </div>
            <button
              type="button"
              onClick={() => setMessage('')}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
