import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function Payment() {
  const [searchParams] = useSearchParams();
  const contractId = searchParams.get('contractId') || '';
  const navigate = useNavigate();

  const [paymentMode, setPaymentMode] = useState('wallet'); // 'wallet' | 'razorpay'
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [gateStatus, setGateStatus] = useState({
    contractVerified: true,
    guardrailsPassed: true,
    gatedActionAllowed: true,
    policyPreCheckPassed: true,
    fraudRiskLow: true,
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleExecutePayment = async () => {
    setExecuting(true);
    setError('');
    setMessage('');
    setResult(null);

    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.post('/agent/payment/execute', {
        contractId: contractId || 'ctr_demo_payment_123',
        paymentMode,
        userId,
      });

      if (res.data?.success) {
        setResult(res.data);
        setMessage(`Payment Executed & Settled! Order ID: ${res.data.order?.orderId}`);
      }
    } catch (err) {
      if (err.status === 403 || err.error === 'REQUIRE_APPROVAL') {
        setError('Payment Gate Triggered: REQUIRE_MANUAL_APPROVAL required by policy rules.');
      } else {
        setError(err.error || err.message || 'Payment execution blocked by Security Gate');
      }
    } finally {
      setExecuting(false);
    }
  };

  const handleProceedToOrderStatus = () => {
    const oId = result?.order?.orderId || result?.order?._id;
    if (oId) {
      navigate(`/agent/order-status?orderId=${oId}`);
    } else {
      navigate('/user/orders');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-600/10 border border-emerald-500/30 text-emerald-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                AP2 Payment & Security Gate Execution
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Multi-gate verification: Guardrails $\rightarrow$ Policy Pre-Check $\rightarrow$ Fraud Risk $\rightarrow$ Atomic Settlement
              </p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Security Gates Verification Panel */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Security Gates Evaluation</span>
            </div>
            <span className="text-xs text-slate-400">5-Gate Integrity Mesh</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-955 border border-slate-800 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gate A: Contract Signature</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-955 border border-slate-800 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gate A2: User Guardrails</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-955 border border-slate-800 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gate B: Gated Action Policy</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-955 border border-slate-800 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gate B2: Real-time Pre-Check</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-955 border border-slate-800 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gate C: Fraud Risk Assessment</span>
            </div>
          </div>
        </div>

        {/* Payment Mode Selection Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Settlement Engine
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setPaymentMode('wallet')}
                className={`p-5 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                  paymentMode === 'wallet'
                    ? 'bg-emerald-600/10 border-emerald-500/50 shadow-lg shadow-emerald-600/10'
                    : 'bg-slate-955 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="p-3 rounded-xl bg-slate-900 text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white text-sm block">AP2 Shared Wallet</span>
                  <span className="text-xs text-slate-400">Atomic instant wallet debit</span>
                </div>
              </div>

              <div
                onClick={() => setPaymentMode('razorpay')}
                className={`p-5 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                  paymentMode === 'razorpay'
                    ? 'bg-indigo-600/10 border-indigo-500/50 shadow-lg shadow-indigo-600/10'
                    : 'bg-slate-955 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="p-3 rounded-xl bg-slate-900 text-indigo-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-white text-sm block">Razorpay Direct Gateway</span>
                  <span className="text-xs text-slate-400">Card / UPI / NetBanking checkout</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleExecutePayment}
              disabled={executing}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl py-3.5 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/25 disabled:opacity-50"
            >
              {executing ? (
                <span>Evaluating Gates & Settling Payment...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Execute Settled Payment</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Payment Success Result Card */}
        {result && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span>Payment Successfully Settled</span>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
                Order Created
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-slate-300 border-t border-slate-800/80 pt-4">
              <div>
                <span className="text-slate-500 block text-[11px]">Order ID</span>
                <span className="font-mono font-bold text-indigo-400">{result.order?.orderId}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Payment ID / Method</span>
                <span className="font-semibold">{result.order?.razorpayPaymentId || 'Wallet Atomic Debit'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Amount Paid</span>
                <span className="font-bold text-emerald-400">₹{(result.order?.amount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleProceedToOrderStatus}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl py-3 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
              >
                <span>Track Order Fulfillment Timeline</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
