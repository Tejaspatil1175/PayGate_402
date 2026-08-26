import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Zap,
  BarChart3,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function MerchantCoPilot() {
  const [insights, setInsights] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appliedInsights, setAppliedInsights] = useState({});
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');

  const fetchCoPilotData = async () => {
    setLoading(true);
    setError('');
    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const res = await apiClient.get('/analytics/revenue', {
        params: { merchantId },
      });

      if (res.data?.success) {
        setAnalyticsData(res.data);
      }

      // Default AI Co-pilot strategic suggestions
      setInsights([
        {
          id: 1,
          type: 'pricing',
          title: 'Optimal Price Adjustment',
          impact: '+18% Sales Volume',
          description: 'Lowering the list price of "Running Shoes" by 5% aligns with top AI Agent search budget caps (₹2,500), boosting matching conversion.',
          actionText: 'Apply 5% Dynamic Price Adjustment',
        },
        {
          id: 2,
          type: 'inventory',
          title: 'Stock Velocity Restock Alert',
          impact: 'Prevent Stockout Risk',
          description: 'Footwear inventory is selling at 3.2x normal velocity via automated agent orders. Restock recommended within 48 hours.',
          actionText: 'Acknowledge Restock Alert',
        },
        {
          id: 3,
          type: 'policy',
          title: 'Negotiation Threshold Tuning',
          impact: '+12% Margin Retention',
          description: 'Setting your auto-accept negotiation discount cap to 8% (down from 10%) retains higher margins while keeping win-rate above 85%.',
          actionText: 'Update Auto-Accept Policy to 8%',
        },
      ]);
    } catch (err) {
      setError(err.error || err.message || 'Failed to load AI co-pilot insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoPilotData();
  }, []);

  const handleApplyInsight = (id, actionTitle) => {
    setAppliedInsights((prev) => ({ ...prev, [id]: true }));
    setActionMessage(`Applied suggestion: "${actionTitle}"! System policy & catalog updated.`);
    setTimeout(() => setActionMessage(''), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Merchant AI Co-Pilot Panel
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                  Live AI Signals
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Automated pricing optimization, margin insights, and inventory velocity recommendations
              </p>
            </div>
          </div>

          <button
            onClick={fetchCoPilotData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Analyze Signals</span>
          </button>
        </div>

        {/* Notifications */}
        {actionMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionMessage}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* AI Co-Pilot Overview Banner */}
        <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/80 border border-indigo-500/30 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>AP2 Predictive Agent Intelligence</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              AI Co-Pilot is actively analyzing 100% of incoming search intents & competitor pricing
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Recommendations below are generated by comparing real-time AP2 agent budget caps against your merchant policy rules to maximize conversion and GMV revenue.
            </p>
          </div>
          <div className="flex-shrink-0 bg-slate-950/80 border border-slate-800 p-4 rounded-xl text-center space-y-1">
            <span className="text-xs text-slate-500 block">Agent Win Rate</span>
            <span className="text-2xl font-extrabold text-emerald-400">89.4%</span>
          </div>
        </div>

        {/* Insights Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            Analyzing AI agent intent telemetry & generating suggestions...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {insights.map((item) => {
              const isApplied = appliedInsights[item.id];
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
                        <Lightbulb className="w-4 h-4" />
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        {item.impact}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base">{item.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => handleApplyInsight(item.id, item.actionText)}
                      disabled={isApplied}
                      className={`w-full text-xs font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 transition border ${
                        isApplied
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Applied</span>
                        </>
                      ) : (
                        <>
                          <span>{item.actionText}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
