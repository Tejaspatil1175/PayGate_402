import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  TrendingDown,
  Send,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Store,
  Bot,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function Negotiation() {
  const [searchParams] = useSearchParams();
  const intentId = searchParams.get('intentId') || '';
  const productId = searchParams.get('productId') || '';
  const merchantId = searchParams.get('merchantId') || '';
  const navigate = useNavigate();

  const [negotiation, setNegotiation] = useState(null);
  const [proposedPrice, setProposedPrice] = useState('2000');
  const [counterPrice, setCounterPrice] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleInitiate = async (priceToPropose) => {
    setLoading(true);
    setError('');
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.post('/agent/negotiation/initiate', {
        intentId,
        productId,
        merchantId,
        proposedPrice: Number(priceToPropose || proposedPrice),
        agentId: 'agent_procure_bot_007',
        userId,
      });

      if (res.data?.success) {
        const negDoc = res.data.negotiation || res.data;
        setNegotiation(negDoc);
        setMessage(`Negotiation round initiated! Status: ${negDoc.status}`);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to initiate negotiation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      handleInitiate('2000');
    }
  }, [productId]);

  const handleRespond = async (actionType) => {
    if (!negotiation?._id) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await apiClient.post(`/agent/negotiation/${negotiation._id}/respond`, {
        sender: 'agent',
        action: actionType, // 'counter' | 'accept' | 'reject'
        counterPrice: Number(counterPrice || negotiation.proposedPrice),
        note: note || `Agent ${actionType} action`,
      });

      if (res.data?.success) {
        const updated = res.data.negotiation;
        setNegotiation(updated);
        setMessage(`Action '${actionType}' recorded. Negotiation status: ${updated.status}`);
        setNote('');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to respond to negotiation');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToContract = () => {
    if (negotiation?._id) {
      navigate(`/agent/contract?negotiationId=${negotiation._id}`);
    } else {
      navigate('/agent/contract');
    }
  };

  const status = negotiation?.status || 'open';
  const isAccepted = status === 'accepted';
  const isRejected = status === 'rejected';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Automated Dynamic Price Negotiation
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Agent vs Merchant Policy Engine automated counter-offer negotiation rounds
              </p>
            </div>
          </div>

          {negotiation && (
            <span
              className={`text-xs font-bold uppercase px-3 py-1.5 rounded-xl border self-start md:self-auto ${
                isAccepted
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : isRejected
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              Status: {status}
            </span>
          )}
        </div>

        {/* Notifications */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Price Context & Discount Banner */}
        {negotiation && (
          <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-500 block uppercase tracking-wider font-semibold">
                Original List Price
              </span>
              <span className="text-lg line-through text-slate-400">
                ₹{(negotiation.originalPrice || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 block uppercase tracking-wider font-semibold">
                Current Proposed Price
              </span>
              <span className="text-3xl font-extrabold text-emerald-400">
                ₹{(negotiation.proposedPrice || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-center">
              <span className="text-xs text-slate-400 block font-medium">Discount</span>
              <span className="text-xl font-bold text-emerald-400">
                {negotiation.discountPercentage || 0}% OFF
              </span>
            </div>
          </div>
        )}

        {/* Negotiation Rounds Chat Log */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>Negotiation Round History</span>
          </div>

          {!negotiation ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm space-y-3">
              <p>No active negotiation loaded.</p>
              <button
                onClick={() => handleInitiate('2000')}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition"
              >
                Initiate New Negotiation Round
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {(negotiation.rounds || []).map((rnd, idx) => {
                const isAgent = rnd.sender === 'agent';
                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                      isAgent
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-slate-200'
                        : 'bg-slate-955 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 flex-shrink-0">
                      {isAgent ? <Bot className="w-4 h-4" /> : <Store className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="capitalize">{rnd.sender}</span>
                        <span className="text-emerald-400 font-bold">Proposed: ₹{rnd.proposedPrice}</span>
                      </div>
                      <p className="text-slate-400">{rnd.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Counter-Offer Controls */}
        {negotiation && !isAccepted && !isRejected && (
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="text-sm font-semibold text-slate-200">
              Agent Response & Counter-Offer Form
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Counter Price (₹)</label>
                <input
                  type="number"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  placeholder={`Current: ${negotiation.proposedPrice}`}
                  className="w-full bg-slate-955 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Counter-offering based on budget cap..."
                  className="w-full bg-slate-955 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => handleRespond('counter')}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl py-2.5 flex items-center justify-center gap-1.5 transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Counter-Offer</span>
              </button>

              <button
                onClick={() => handleRespond('accept')}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl py-2.5 px-5 flex items-center justify-center gap-1.5 transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Accept Terms</span>
              </button>

              <button
                onClick={() => handleRespond('reject')}
                disabled={loading}
                className="bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30 text-xs font-semibold rounded-xl py-2.5 px-5 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        )}

        {/* Accepted Contract Route Action Banner */}
        {isAccepted && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                <span>Negotiation Accepted & Agreement Reached!</span>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                Agreed Price: ₹{negotiation.proposedPrice}
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Merchant policy engine has accepted the negotiated terms. Click below to generate and sign your AP2 RSA-PSS Digital Commerce Contract.
            </p>

            <button
              onClick={handleProceedToContract}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
            >
              <span>Generate & Review AP2 RSA-PSS Digital Contract</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
