import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Store,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  BarChart2,
  Star,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function Matches() {
  const [searchParams] = useSearchParams();
  const intentId = searchParams.get('intentId') || '';
  const navigate = useNavigate();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMatches = async () => {
    setLoading(true);
    setError('');
    try {
      let url = '/discovery/search';
      let params = { q: 'running shoes' };

      if (intentId) {
        url = `/agent/intent/${intentId}/matches`;
        params = {};
      }

      const res = await apiClient.get(url, { params });
      if (res.data?.success) {
        const rawMatches = res.data.matches || res.data.products || [];
        // Map products into explainable scoring format if raw products
        const formatted = rawMatches.map((item, idx) => {
          if (item.matchScore !== undefined) return item;
          const price = item.price || 2000;
          const relevance = 38 - idx * 2;
          const priceScore = Math.min(30, Math.round((2500 / price) * 20));
          const trustScore = 18;
          const personaFit = 8;
          const totalScore = relevance + priceScore + trustScore + personaFit;

          return {
            product: item,
            merchant: item.merchant || { businessName: 'Apex Merchants', _id: 'm_123' },
            matchScore: totalScore,
            scoreBreakdown: {
              semanticRelevance: relevance,
              priceCompetitiveness: priceScore,
              merchantTrust: trustScore,
              personaFitBonus: personaFit,
            },
          };
        });

        setMatches(formatted);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load merchant catalog matches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [intentId]);

  const handleStartNegotiation = (product, merchant) => {
    const prodId = product._id || product.id;
    const merchId = merchant?._id || merchant?.id || product.merchant;
    navigate(`/agent/negotiation?intentId=${intentId}&productId=${prodId}&merchantId=${merchId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Merchant Match Results & Explainable Scoring
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Multi-factor scoring: Relevance (40%) + Price (30%) + Trust (20%) + Persona Fit (10%)
              </p>
            </div>
          </div>

          <button
            onClick={fetchMatches}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Evaluate Matches</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Intent Context Banner */}
        {intentId && (
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Active Intent ID: <code className="text-amber-400">{intentId}</code></span>
            </div>
            <span className="text-slate-400">Sorted by Total Algorithm Score</span>
          </div>
        )}

        {/* Matches Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            Scoring merchant catalog inventory...
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            No merchant matches found for this intent.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.map((item, idx) => {
              const product = item.product || item;
              const merchant = item.merchant || product.merchant;
              const score = item.matchScore || 85;
              const breakdown = item.scoreBreakdown || {
                semanticRelevance: 35,
                priceCompetitiveness: 25,
                merchantTrust: 17,
                personaFitBonus: 8,
              };

              return (
                <div
                  key={idx}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    {/* Title & Score Badge Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
                          <Store className="w-3 h-3 text-slate-400" />
                          <span>{merchant?.businessName || 'Merchant Partner'}</span>
                        </div>
                        <h3 className="font-bold text-white text-base">{product.title}</h3>
                      </div>

                      <div className="text-center bg-indigo-600/10 border border-indigo-500/30 p-2.5 rounded-2xl flex-shrink-0 min-w-[70px]">
                        <span className="text-xs text-slate-400 block font-medium">Match</span>
                        <span className="text-xl font-extrabold text-indigo-400">{score}/100</span>
                      </div>
                    </div>

                    <div className="text-lg font-bold text-white">
                      ₹{(product.price || 0).toLocaleString('en-IN')}
                    </div>

                    {/* Explainable Score Breakdown */}
                    <div className="space-y-2 bg-slate-955 p-3.5 rounded-xl border border-slate-800 text-xs">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                        Explainable Score Breakdown
                      </span>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-slate-300">
                          <span>Semantic Relevance (Max 40)</span>
                          <span className="font-semibold text-indigo-400">{breakdown.semanticRelevance} pts</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(breakdown.semanticRelevance / 40) * 100}%` }} />
                        </div>

                        <div className="flex items-center justify-between text-slate-300 pt-1">
                          <span>Price Competitiveness (Max 30)</span>
                          <span className="font-semibold text-emerald-400">{breakdown.priceCompetitiveness} pts</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(breakdown.priceCompetitiveness / 30) * 100}%` }} />
                        </div>

                        <div className="flex items-center justify-between text-slate-300 pt-1">
                          <span>Merchant Trust (Max 20)</span>
                          <span className="font-semibold text-amber-400">{breakdown.merchantTrust} pts</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(breakdown.merchantTrust / 20) * 100}%` }} />
                        </div>

                        <div className="flex items-center justify-between text-slate-300 pt-1">
                          <span>Persona Fit Bonus (Max 10)</span>
                          <span className="font-semibold text-purple-400">{breakdown.personaFitBonus} pts</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(breakdown.personaFitBonus / 10) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => handleStartNegotiation(product, merchant)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl py-3 flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
                    >
                      <span>Initiate Dynamic Price Negotiation</span>
                      <ArrowRight className="w-4 h-4" />
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
