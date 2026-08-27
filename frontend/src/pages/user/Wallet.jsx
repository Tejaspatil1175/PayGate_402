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

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchWalletData = async () => {
    setLoading(true);
    setError('');
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

        {/* Notifications */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

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

          {/* Quick Top-Up Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <span>Instant Wallet Top-Up</span>
              </div>
              <form onSubmit={handleTopUp} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    required
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 font-bold outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(String(amt))}
                      className="flex-1 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-bold text-slate-600 transition"
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={topUpLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
                >
                  {topUpLoading ? 'Processing...' : 'Top-Up via Razorpay'}
                </button>
              </form>
            </div>
            <p className="text-[11px] text-slate-400 mt-4 text-center font-medium">
              Non-custodial AP2 ledger instant settlement
            </p>
          </div>
        </div>

        {/* Spend Caps & Guardrails Settings */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>Autonomous Spending Guardrails</span>
          </div>

          <form onSubmit={handleUpdateCaps} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Per-Transaction Cap (₹)</label>
              <input
                type="number"
                min="500"
                required
                value={perTxCap}
                onChange={(e) => setPerTxCap(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Per-Day Cap (₹)</label>
              <input
                type="number"
                min="1000"
                required
                value={perDayCap}
                onChange={(e) => setPerDayCap(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm text-slate-900 font-bold outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={capSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl py-2.5 px-4 transition shadow-sm disabled:opacity-50"
            >
              {capSaving ? 'Saving Guardrails...' : 'Update Spend Caps'}
            </button>
          </form>
        </div>

        {/* Transaction History Ledger */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Wallet Ledger & Audit History</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {history.length} transactions recorded
            </span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
              No wallet transactions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {history.map((tx, idx) => {
                const isCredit = tx.type === 'credit';
                return (
                  <div key={idx} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl border ${
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
                        <div className="font-bold text-slate-900">{tx.description || tx.type}</div>
                        <div className="text-slate-400 text-[11px]">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-IN') : 'Recent'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {isCredit ? '+' : '-'}₹{(tx.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Bal: ₹{(tx.balanceAfter || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
