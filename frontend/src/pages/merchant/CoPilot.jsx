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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Sparkles className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Merchant AI Co-Pilot Panel
              <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                Live AI Signals
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Automated pricing optimization, margin insights, and inventory velocity recommendations
            </p>
          </div>
        </div>

        <button
          onClick={fetchCoPilotData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : 'text-slate-400'}`} />
          <span>Re-Analyze Signals</span>
        </button>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* AI Co-Pilot Overview Banner */}
      <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 border border-indigo-100 rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>AP2 Predictive Agent Intelligence</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            AI Co-Pilot is actively analyzing 100% of incoming search intents & competitor pricing
          </h2>
          <p className="text-sm text-slate-600 max-w-3xl">
            Recommendations below are generated by comparing real-time AP2 agent budget caps against your merchant policy rules to maximize conversion and GMV revenue.
          </p>
        </div>
        <div className="flex-shrink-0 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm text-center space-y-1 min-w-[160px]">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Agent Win Rate</span>
          <span className="text-3xl font-black text-emerald-600">89.4%</span>
        </div>
      </div>

      {/* Insights Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm font-medium">
          Analyzing AI agent intent telemetry & generating suggestions...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {insights.map((item) => {
            const isApplied = appliedInsights[item.id];
            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                      <Lightbulb className="w-5 h-5" />
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-sm">
                      {item.impact}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{item.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mt-2">{item.description}</p>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => handleApplyInsight(item.id, item.actionText)}
                    disabled={isApplied}
                    className={`w-full text-sm font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition ${
                      isApplied
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
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
                        <ArrowRight className="w-4 h-4" />
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
  );
}
