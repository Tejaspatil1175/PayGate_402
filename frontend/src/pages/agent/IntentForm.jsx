import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Tag,
  DollarSign,
  Key,
  CheckCircle2,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function IntentForm() {
  const [agentId, setAgentId] = useState('agent_procure_bot_007');
  const [itemKeywords, setItemKeywords] = useState('Nike Running Shoes');
  const [category, setCategory] = useState('Footwear');
  const [budgetCap, setBudgetCap] = useState('3500');
  const [brandPreference, setBrandPreference] = useState('Nike');
  const [nonce, setNonce] = useState(`nonce_${Math.random().toString(36).substring(2, 10)}`);

  const [loading, setLoading] = useState(false);
  const [submittedIntent, setSubmittedIntent] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmitIntent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSubmittedIntent(null);

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.post('/agent/intent', {
        agentId,
        category,
        itemKeywords,
        budgetCap: Number(budgetCap),
        brandPreference,
        nonce,
        userId,
      });

      if (res.data?.success) {
        setSubmittedIntent(res.data.intent || res.data);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to submit purchasing intent');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToMatches = () => {
    if (submittedIntent?._id || submittedIntent?.intentId) {
      const id = submittedIntent._id || submittedIntent.intentId;
      navigate(`/agent/matches?intentId=${id}`);
    } else {
      navigate('/agent/matches');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-6">
          <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              AI Agent Intent Submission
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-400">
              Submit structured agent purchasing intent with cryptographic nonce & budget cap
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Intent Submission Form Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <form onSubmit={handleSubmitIntent} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                  Agent ID / Identifier
                </label>
                <div className="relative">
                  <Bot className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 pl-10 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                  Cryptographic Nonce
                </label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={nonce}
                    onChange={(e) => setNonce(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 pl-10 text-sm text-amber-400 font-mono outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                  Item Keywords
                </label>
                <input
                  type="text"
                  required
                  value={itemKeywords}
                  onChange={(e) => setItemKeywords(e.target.value)}
                  placeholder="e.g. Nike Running Shoes"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                >
                  <option value="Footwear">Footwear</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Home">Home & Kitchen</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                  Budget Cap (₹)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    required
                    min="1"
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 pl-10 text-sm text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider font-semibold mb-1.5">
                  Brand Preference
                </label>
                <input
                  type="text"
                  value={brandPreference}
                  onChange={(e) => setBrandPreference(e.target.value)}
                  placeholder="e.g. Nike, Adidas"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Submitting Intent...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit AP2 Purchasing Intent</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Submitted Intent Confirmation Card */}
        {submittedIntent && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span>Intent Registered & Active in Gateway</span>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                AP2 Verified
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-300 border-t border-slate-800/80 pt-4">
              <div>
                <span className="text-slate-500 block text-[11px]">Agent ID</span>
                <span className="font-semibold">{submittedIntent.agentId || agentId}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Item / Category</span>
                <span className="font-semibold">{submittedIntent.itemKeywords || itemKeywords} ({submittedIntent.category || category})</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Budget Cap</span>
                <span className="font-bold text-emerald-400">₹{submittedIntent.budgetCap || budgetCap}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Nonce</span>
                <code className="text-amber-400">{submittedIntent.nonce || nonce}</code>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleProceedToMatches}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl py-3 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
              >
                <span>Proceed to Merchant Catalog Matching</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
