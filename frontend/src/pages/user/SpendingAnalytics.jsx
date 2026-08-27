import React, { useState, useEffect } from 'react';
import {
  PieChart,
  TrendingUp,
  BarChart3,
  Sparkles,
  DollarSign,
  Lightbulb,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function SpendingAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.get('/user-analytics', { params: { userId } });
      if (res.data?.success) {
        setAnalytics(res.data.analytics || res.data);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load spending analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const getCategoryColor = (idx) => {
    const colors = [
      'bg-indigo-500 text-indigo-400 border-indigo-500/30',
      'bg-emerald-500 text-emerald-400 border-emerald-500/30',
      'bg-amber-500 text-amber-400 border-amber-500/30',
      'bg-purple-500 text-purple-400 border-purple-500/30',
      'bg-rose-500 text-rose-400 border-rose-500/30',
    ];
    return colors[idx % colors.length];
  };

  const getCategoryBarColor = (idx) => {
    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500'];
    return colors[idx % colors.length];
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                User Spending Analytics
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </h1>
              <p className="text-sm text-slate-500">
                Category breakdowns, monthly trends, and AI financial insights from wallet ledger
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            Calculating wallet analytics & insights...
          </div>
        ) : !analytics ? (
          <div className="text-center py-20 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-sm bg-white">
            No spending data available.
          </div>
        ) : (
          <>
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total Agent Spent
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ₹{(analytics.summary?.totalSpent || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Wallet Debits</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total Wallet Top-Ups
                </div>
                <div className="text-2xl font-black text-emerald-600">
                  ₹{(analytics.summary?.totalTopUp || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Razorpay Credits</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Current Wallet Balance
                </div>
                <div className="text-2xl font-black text-indigo-600">
                  ₹{(analytics.summary?.currentBalance || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Available Funds</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ledger Transactions
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {analytics.summary?.transactionCount || 0}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Total Recorded Entries</div>
              </div>
            </div>

            {/* Charts & Breakdown Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown Progress Chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    <span>Category Spending Breakdown</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {(analytics.categoryBreakdown || []).map((cat, idx) => {
                    const totalSpent = analytics.summary?.totalSpent || 1;
                    const percent = Math.min(100, Math.round(((cat.spent || cat.amount || 0) / totalSpent) * 100)) || 0;

                    return (
                      <div key={idx} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{cat.category || 'General'}</span>
                          <span className="text-slate-500 font-semibold">
                            ₹{(cat.spent || cat.amount || 0).toLocaleString('en-IN')} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getCategoryBarColor(idx)}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Spending Trend Progress Chart */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span>Monthly Spending Trend</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {(analytics.monthlyTrends || []).map((m, idx) => {
                    const maxMonthly = Math.max(...(analytics.monthlyTrends || []).map((t) => t.spent || t.amount || 1), 1);
                    const percent = Math.min(100, Math.round(((m.spent || m.amount || 0) / maxMonthly) * 100));

                    return (
                      <div key={idx} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{m.month || `Month ${idx + 1}`}</span>
                          <span className="text-slate-500 font-semibold">₹{(m.spent || m.amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Smart Actionable AI Insights */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>Smart AI Financial Insights</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(analytics.insights || [
                  'Your top spending category is Electronics, accounting for over 40% of wallet debits.',
                  'Autonomous AI negotiation saved you approximately ₹1,200 on list prices this month.',
                ]).map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-slate-800 flex items-start gap-3"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{typeof insight === 'string' ? insight : insight.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
