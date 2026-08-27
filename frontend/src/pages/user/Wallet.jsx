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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Balance Hero Card */}
          <div className="md:col-span-2 bg-gradient-to-tr from-indigo-600 via-indigo-700 to-indigo-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <CreditCard className="w-40 h-40 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">
                Available AP2 Balance
              </div>
              <div className="text-4xl font-black text-white tracking-tight mb-6">
                ₹{(wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4 text-xs">
              <div>
                <span className="text-indigo-200 block">Spent Today</span>
                <span className="text-white font-bold text-base">
                  ₹{(wallet?.dailySpent || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-indigo-200 block">Remaining Daily Cap</span>
                <span className="text-emerald-300 font-bold text-base">
                  ₹{Math.max(0, (wallet?.perDayCap || 50000) - (wallet?.dailySpent || 0)).toLocaleString('en-IN')}
                </span>
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
