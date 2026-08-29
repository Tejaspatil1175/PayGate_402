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
  Percent,
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
  const [autoAcceptDiscountPercent, setAutoAcceptDiscountPercent] = useState('10');
  const [maxAllowedDiscountPercent, setMaxAllowedDiscountPercent] = useState('25');
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

      // Fetch from dedicated policy CRUD route with fallback to well-known
      try {
        const res = await apiClient.get('/policy', {
          params: { merchantId },
        });
        if (res.data?.rules) {
          setRules(res.data.rules);
          return;
        }
      } catch (e) {
        // Fallback
      }

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

      const rulePayload = {
        merchantId,
        name: name || `Policy Rule (${ruleType})`,
        description,
        ruleType,
        maxAmount: Number(maxAmount),
        dailyCap: Number(dailyCap),
        requireApprovalThreshold: Number(requireApprovalThreshold),
        autoAcceptDiscountPercent: Number(autoAcceptDiscountPercent) || 10,
        maxAllowedDiscountPercent: Number(maxAllowedDiscountPercent) || 25,
        isActive: true,
      };

      const res = await apiClient.post('/policy', rulePayload);

      if (res.data?.success || res.data?.rule) {
        setMessage(`Policy rule "${name || ruleType}" created successfully!`);
        setShowAddModal(false);
        setName('');
        setDescription('');
        setAutoAcceptDiscountPercent('10');
        setMaxAllowedDiscountPercent('25');
        fetchPolicyRules();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.error || err.message || 'Failed to create policy rule');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleRuleStatus = async (ruleId) => {
    try {
      const res = await apiClient.patch(`/policy/${ruleId}/toggle`);
      if (res.data?.success) {
        setMessage('Updated policy rule status.');
        fetchPolicyRules();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      // Fallback local toggle if offline
      setRules((prev) =>
        prev.map((r) => (r._id === ruleId ? { ...r, isActive: !r.isActive } : r))
      );
      setMessage('Updated policy rule status.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteRule = async (ruleId, nameStr) => {
    if (!window.confirm(`Are you sure you want to delete "${nameStr}"?`)) return;
    try {
      await apiClient.delete(`/policy/${ruleId}`);
      setMessage(`Deleted policy rule "${nameStr}".`);
      fetchPolicyRules();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setRules((prev) => prev.filter((r) => r._id !== ruleId));
      setMessage(`Deleted policy rule "${nameStr}".`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Merchant Policy Rule Builder
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure auto-negotiation discount caps, transaction velocity limits, and approval thresholds
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Rule</span>
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Create Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Create Policy Rule</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-sm font-medium">
              <div>
                <label className="block text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard Agent Commerce Policy"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Rule Type</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                >
                  <option value="max_spend_cap">Max Spend Cap</option>
                  <option value="daily_velocity_limit">Daily Velocity Limit</option>
                  <option value="require_manual_approval">Require Manual Approval</option>
                  <option value="allowed_categories">Allowed Categories</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1">Max Transaction (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Daily Cap (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={dailyCap}
                    onChange={(e) => setDailyCap(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                  />
                </div>
              </div>

              {/* Dynamic Negotiation Threshold Inputs */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-3">
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-indigo-600" />
                  <span>AI Negotiation Thresholds</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                      Auto-Accept (%)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={autoAcceptDiscountPercent}
                      onChange={(e) => setAutoAcceptDiscountPercent(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-900 outline-none transition text-xs font-bold"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">≤ % is auto-approved</span>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                      Max Allowed (%)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={maxAllowedDiscountPercent}
                      onChange={(e) => setMaxAllowedDiscountPercent(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-900 outline-none transition text-xs font-bold"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">&gt; % is auto-rejected</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Manual Approval Threshold (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={requireApprovalThreshold}
                  onChange={(e) => setRequireApprovalThreshold(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Save Policy Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Policy Rules Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <ShieldCheck className="w-5 h-5 text-indigo-500" />
          <span>Active Policy Rules ({rules.length})</span>
        </div>

        <button
          onClick={fetchPolicyRules}
          disabled={loading}
          className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition px-3 py-1.5 rounded-lg hover:bg-indigo-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Rules Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm font-medium">
          Loading policy rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-sm font-medium bg-white shadow-sm">
          No custom policy rules configured. Default system guardrails active (10% auto-accept, 25% auto-reject).
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rules.map((rule) => {
            const isActive = rule.isActive !== false;
            return (
              <div
                key={rule._id}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 relative"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-base">{rule.name}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="text-sm text-slate-500 space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="font-medium text-slate-400">Type:</span> 
                      <code className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{rule.ruleType}</code>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="font-medium text-slate-400">Max Transaction:</span> 
                      <span className="font-bold text-slate-700">₹{rule.maxAmount || 5000}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="font-medium text-slate-400">Daily Cap:</span> 
                      <span className="font-bold text-slate-700">₹{rule.dailyCap || 25000}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="font-medium text-slate-400">Auto-Accept Discount:</span> 
                      <span className="font-bold text-emerald-600">≤ {rule.autoAcceptDiscountPercent !== undefined ? rule.autoAcceptDiscountPercent : 10}%</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="font-medium text-slate-400">Max Allowed Discount:</span> 
                      <span className="font-bold text-rose-600">≤ {rule.maxAllowedDiscountPercent !== undefined ? rule.maxAllowedDiscountPercent : 25}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-400">Approval Threshold:</span> 
                      <span className="font-bold text-slate-700">₹{rule.requireApprovalThreshold || 10000}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleRuleStatus(rule._id)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    {isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule._id, rule.name)}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-4 h-4" />
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
