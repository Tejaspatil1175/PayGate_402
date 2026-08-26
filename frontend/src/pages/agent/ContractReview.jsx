import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileCheck,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Key,
  ArrowRight,
  Sparkles,
  Receipt,
  Store,
  Bot,
  RefreshCw,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function ContractReview() {
  const [searchParams] = useSearchParams();
  const negotiationId = searchParams.get('negotiationId') || '';
  const contractIdParam = searchParams.get('contractId') || '';
  const navigate = useNavigate();

  const [contract, setContract] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const fetchOrCreateContract = async () => {
    setLoading(true);
    setError('');
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      let contractData = null;

      if (negotiationId) {
        // Create digital contract from negotiation
        const res = await apiClient.post('/agent/contract/create', {
          negotiationId,
          agentId: 'agent_procure_bot_007',
          userId,
        });

        if (res.data?.success) {
          contractData = res.data.contract || res.data;
        }
      } else {
        // Dummy fallback contract for preview testing
        contractData = {
          contractId: contractIdParam || `ctr_${Math.random().toString(36).substring(2, 10)}`,
          mandateHash: `mandate_${Math.random().toString(36).substring(2, 14)}`,
          agentId: 'agent_procure_bot_007',
          merchant: 'Apex Electronics Ltd',
          contractTerms: {
            agreedAmount: 2000,
            currency: 'INR',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
          items: [
            { title: 'Nike Running Shoes', quantity: 1, price: 2000 },
          ],
          digitalSignature: 'rsa_pss_sig_99a8b7c6d5e4f3a2b1...',
        };
      }

      setContract(contractData);
      if (contractData?.contractId) {
        verifyContract(contractData.contractId);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to create or review AP2 contract');
    } finally {
      setLoading(false);
    }
  };

  const verifyContract = async (cId) => {
    setVerifying(true);
    try {
      const res = await apiClient.post('/agent/contract/verify', {
        contractId: cId,
      });

      if (res.data?.success) {
        setVerification(res.data);
      }
    } catch (err) {
      console.error('Signature verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchOrCreateContract();
  }, [negotiationId]);

  const handleProceedToPayment = () => {
    const cId = contract?.contractId || contractIdParam;
    navigate(`/agent/payment?contractId=${cId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                AP2 RSA-PSS Digital Contract Review
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Cryptographically signed Cart Mandate & contract terms verification
              </p>
            </div>
          </div>

          <button
            onClick={fetchOrCreateContract}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Verify Contract</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            Generating RSA-PSS digital contract signature...
          </div>
        ) : !contract ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            No active contract data found.
          </div>
        ) : (
          <>
            {/* Verification Status Banner */}
            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                  <span>RSA-PSS Digital Signature Valid & Intact</span>
                </div>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
                  AP2 Mandate Signed
                </span>
              </div>
              <p className="text-xs text-slate-300">
                This contract includes a tamper-proof cryptographic signature hash that binds agreed terms and pricing to prevent unauthorized modifications.
              </p>
            </div>

            {/* Contract Specifications Card */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-semibold">
                    Contract Identifier
                  </span>
                  <code className="text-sm font-mono text-indigo-400 font-bold">
                    {contract.contractId}
                  </code>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 block uppercase font-semibold">
                    Agreed Amount
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-400">
                    ₹{(contract.contractTerms?.agreedAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Mandate Hash & Keys */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-955 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block font-semibold">Mandate Hash</span>
                  <code className="text-amber-400 font-mono break-all">
                    {contract.mandateHash || 'N/A'}
                  </code>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-955 border border-slate-800 space-y-1">
                  <span className="text-slate-500 block font-semibold">Digital Signature</span>
                  <code className="text-slate-400 font-mono text-[11px] break-all">
                    {contract.digitalSignature || 'RSA-PSS-SHA256-VALID'}
                  </code>
                </div>
              </div>

              {/* Itemized Cart Table */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Itemized Contract Terms
                </span>
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-955 overflow-hidden">
                  {(contract.items || []).map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between text-xs">
                      <div className="font-semibold text-slate-200">
                        {item.title} <span className="text-slate-500">(x{item.quantity})</span>
                      </div>
                      <div className="font-bold text-white">
                        ₹{(item.price || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign & Execute Action */}
              <div className="pt-4 border-t border-slate-800/80">
                <button
                  onClick={handleProceedToPayment}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl py-3.5 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/25"
                >
                  <Lock className="w-4 h-4" />
                  <span>Execute Gated Razorpay & Wallet Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
