import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  Plus,
  Trash2,
  Check,
  Sparkles,
  AlertTriangle,
  XCircle,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function MerchantPolicy() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for policy rule
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleType, setRuleType] = useState('max_spend_cap');
  const [maxAmount, setMaxAmount] = useState('5000');
  const [dailyCap, setDailyCap] = useState('25000');
  const [requireApprovalThreshold, setRequireApprovalThreshold] = useState('10000');
  const [formLoading, setFormLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchPolicyRules = async () => {
    setLoading(true);
    setError('');
    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      // Fetch policy manifest or rules
      const res = await apiClient.get('/.well-known/agent-policy.json', {
        params: { merchantId },
      });

      if (res.data) {
        setRules(res.data.merchantRules || res.data.rules || []);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load merchant policy rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicyRules();
  }, []);

  const handleCreateRule = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage('');
    setError('');

    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const newRule = {
        _id: Date.now().toString(),
        merchant: merchantId,
        name: name || `Policy Rule (${ruleType})`,
        description,
        ruleType,
        maxAmount: Number(maxAmount),
        dailyCap: Number(dailyCap),
        requireApprovalThreshold: Number(requireApprovalThreshold),
        isActive: true,
      };

      setRules((prev) => [...prev, newRule]);
      setMessage(`Policy rule "${newRule.name}" saved successfully!`);
      setShowAddModal(false);
      setName('');
      setDescription('');
    } catch (err) {
      setError(err.error || err.message || 'Failed to create policy rule');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleRuleStatus = (ruleId) => {
    setRules((prev) =>
      prev.map((r) => (r._id === ruleId ? { ...r, isActive: !r.isActive } : r))
    );
    setMessage('Updated policy rule status.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeleteRule = (ruleId, nameStr) => {
    setRules((prev) => prev.filter((r) => r._id !== ruleId));
    setMessage(`Deleted policy rule "${nameStr}".`);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Merchant Policy Rule Builder
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Configure auto-negotiation caps, spend limits, and manual approval thresholds
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Rule</span>
          </button>
        </div>

        {/* Notifications */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Create Rule Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base">Create Policy Rule</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Rule Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Max Spend Cap ₹5000"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Rule Type</label>
                  <select
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="max_spend_cap">Max Spend Cap</option>
                    <option value="daily_velocity_limit">Daily Velocity Limit</option>
                    <option value="require_manual_approval">Require Manual Approval</option>
                    <option value="allowed_categories">Allowed Categories</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Max Transaction (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Daily Cap (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={dailyCap}
                      onChange={(e) => setDailyCap(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Manual Approval Threshold (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={requireApprovalThreshold}
                    onChange={(e) => setRequireApprovalThreshold(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-955 border border-slate-800 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {formLoading ? 'Saving...' : 'Save Policy Rule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Active Policy Rules Grid */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Active Policy Rules ({rules.length})</span>
            </div>

            <button
              onClick={fetchPolicyRules}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              Loading policy rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
              No custom policy rules configured. Default system guardrails active (10% auto-accept, 25% auto-reject).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => {
                const isActive = rule.isActive !== false;
                return (
                  <div
                    key={rule._id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/40 transition flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{rule.name}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 space-y-1">
                        <div><span className="text-slate-500">Type:</span> <code className="text-amber-400">{rule.ruleType}</code></div>
                        <div><span className="text-slate-500">Max Transaction:</span> ₹{rule.maxAmount || 5000}</div>
                        <div><span className="text-slate-500">Daily Cap:</span> ₹{rule.dailyCap || 25000}</div>
                        <div><span className="text-slate-500">Approval Threshold:</span> ₹{rule.requireApprovalThreshold || 10000}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => handleToggleRuleStatus(rule._id)}
                        className="text-xs px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
                      >
                        {isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule._id, rule.name)}
                        className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
