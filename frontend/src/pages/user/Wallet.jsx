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
} from 'lucide-react';
import apiClient from '../../api/client';

export default function UserWallet() {
  const [wallet, setWallet] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
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

      if (res.data?.success) {
        setMessage(`Top-up order created: ${res.data.razorpayOrder.id}. Balance updated!`);
        fetchWalletData();
      }
    } catch (err) {
      setError(err.error || err.message || 'Top-up failed');
    } finally {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
                <WalletIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">AP2 Agent Wallet</h1>
                <p className="text-sm text-slate-400">
                  Shared autonomous spending ledger & custom transaction guardrails
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchWalletData}
            disabled={loading}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        {/* Notifications */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Top Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Balance Card */}
          <div className="md:col-span-2 bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-slate-900/60 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <CreditCard className="w-32 h-32 text-indigo-400" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
              Available Balance
            </div>
            <div className="text-4xl font-extrabold text-white tracking-tight mb-4">
              ₹{(wallet?.balance || 0).toLocaleString('en-IN')}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4 text-xs">
              <div>
                <span className="text-slate-500 block">Spent Today</span>
                <span className="text-slate-200 font-semibold text-sm">
                  ₹{(wallet?.dailySpent || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Remaining Daily Cap</span>
                <span className="text-emerald-400 font-semibold text-sm">
                  ₹{Math.max(0, (wallet?.perDayCap || 50000) - (wallet?.dailySpent || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Top-Up Form */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
                <PlusCircle className="w-4 h-4 text-indigo-400" />
                <span>Instant Wallet Top-Up</span>
              </div>
              <form onSubmit={handleTopUp} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    required
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={topUpLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {topUpLoading ? 'Processing Top-Up...' : 'Top-Up via Razorpay'}
                </button>
              </form>
            </div>
            <p className="text-[11px] text-slate-500 mt-4 text-center">
              Secured with Razorpay webhook automated instant credit
            </p>
          </div>
        </div>

        {/* Spend Caps & Guardrails Settings */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-4">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Autonomous Spending Guardrails</span>
          </div>

          <form onSubmit={handleUpdateCaps} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Per-Transaction Cap (₹)</label>
              <input
                type="number"
                min="500"
                required
                value={perTxCap}
                onChange={(e) => setPerTxCap(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Per-Day Cap (₹)</label>
              <input
                type="number"
                min="1000"
                required
                value={perDayCap}
                onChange={(e) => setPerDayCap(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-white outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={capSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl py-2.5 px-4 transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              {capSaving ? 'Saving...' : 'Update Spend Caps'}
            </button>
          </form>
        </div>

        {/* Transaction History Ledger */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Wallet Ledger & Audit History</span>
            </div>
            <span className="text-xs text-slate-500">{history.length} transactions recorded</span>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
              No wallet transactions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 overflow-x-auto">
              {history.map((tx, idx) => {
                const isCredit = tx.type === 'credit';
                return (
                  <div key={idx} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-xl border ${
                          isCredit
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">{tx.description || tx.type}</div>
                        <div className="text-slate-500 text-[11px]">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-IN') : 'Recent'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-sm ${isCredit ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {isCredit ? '+' : '-'}₹{(tx.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wider">
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
