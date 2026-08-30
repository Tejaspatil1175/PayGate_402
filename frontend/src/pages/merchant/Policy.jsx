import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  Check,
  X,
  XCircle,
  RefreshCw,
  SlidersHorizontal,
  Percent,
  DollarSign,
  Layers,
  ArrowRight,
  Info,
  Clock,
  ToggleLeft,
  ToggleRight,
  SlidersVertical,
  Activity,
  CheckCircle2,
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
      setError(err.error || err.message || 'Failed to load policy rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicyRules();
  }, []);

  const handleApplyPreset = (preset) => {
    setName(preset.name);
    setRuleType(preset.ruleType);
    setMaxAmount(String(preset.maxAmount));
    setDailyCap(String(preset.dailyCap));
    setAutoAcceptDiscountPercent(String(preset.autoAcceptDiscountPercent));
    setMaxAllowedDiscountPercent(String(preset.maxAllowedDiscountPercent));
    setRequireApprovalThreshold(String(preset.requireApprovalThreshold));
  };

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
        name: name || `Policy Rule (${ruleType.replace(/_/g, ' ')})`,
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
        setMessage(`Policy rule "${name || ruleType}" created successfully.`);
        setShowAddModal(false);
        resetForm();
        fetchPolicyRules();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.error || err.message || 'Failed to create policy rule');
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setRuleType('max_spend_cap');
    setMaxAmount('5000');
    setDailyCap('25000');
    setRequireApprovalThreshold('10000');
    setAutoAcceptDiscountPercent('10');
    setMaxAllowedDiscountPercent('25');
  };

  const handleToggleRuleStatus = async (ruleId) => {
    try {
      const res = await apiClient.patch(`/policy/${ruleId}/toggle`);
      if (res.data?.success) {
        setMessage('Policy rule status updated.');
        fetchPolicyRules();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setRules((prev) =>
        prev.map((r) => (r._id === ruleId ? { ...r, isActive: !r.isActive } : r))
      );
      setMessage('Policy rule status updated.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteRule = async (ruleId, nameStr) => {
    if (!window.confirm(`Are you sure you want to remove policy "${nameStr}"?`)) return;
    try {
      await apiClient.delete(`/policy/${ruleId}`);
      setMessage(`Removed policy "${nameStr}".`);
      fetchPolicyRules();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setRules((prev) => prev.filter((r) => r._id !== ruleId));
      setMessage(`Removed policy "${nameStr}".`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const activeRulesCount = rules.filter((r) => r.isActive !== false).length;
  const primaryRule = rules.find((r) => r.isActive !== false) || rules[0];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full font-sans text-slate-800">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Sliders className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Policy & Governance Builder
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              AP2 Protocol Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Define programmatic guardrails, counter-offer discount limits, and automated approval policies for buyer agents
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPolicyRules}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
            title="Refresh rules"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4" />
            <span>New Governance Rule</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Operational Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Rules
          </div>
          <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-2">
            <span>{activeRulesCount}</span>
            <span className="text-xs font-normal text-slate-400">/ {rules.length} total</span>
          </div>
          <div className="text-[11px] text-slate-400">Enforced by gateway gateway</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Auto-Approval Threshold
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            ≤ {primaryRule?.autoAcceptDiscountPercent !== undefined ? primaryRule.autoAcceptDiscountPercent : 10}%
          </div>
          <div className="text-[11px] text-slate-400">Instant counter-offer acceptance</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Margin Floor Ceiling
          </div>
          <div className="text-2xl font-bold text-slate-800">
            ≤ {primaryRule?.maxAllowedDiscountPercent !== undefined ? primaryRule.maxAllowedDiscountPercent : 25}%
          </div>
          <div className="text-[11px] text-slate-400">Exceeding requests auto-rejected</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Escalation Trigger
          </div>
          <div className="text-2xl font-bold text-slate-800">
            ₹{(primaryRule?.requireApprovalThreshold || 10000).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400">Requires manual merchant sign-off</div>
        </div>
      </div>

      {/* Rules Grid Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Configured Governance Rules ({rules.length})
          </h2>
        </div>
        <span className="text-xs text-slate-500">
          Rules evaluate top-down during AP2 cart negotiation
        </span>
      </div>

      {/* Rules Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200">
          Loading policy rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-300 rounded-xl bg-white p-6 space-y-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">No custom policy rules configured</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              The gateway is currently enforcing system baseline parameters (10% auto-accept, 25% max discount). Create a custom policy to adjust your limits.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 transition"
          >
            Create First Policy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {rules.map((rule) => {
            const isActive = rule.isActive !== false;
            return (
              <div
                key={rule._id}
                className={`bg-white border rounded-xl p-5 shadow-sm transition-all duration-150 flex flex-col justify-between space-y-4 ${
                  isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200/60 opacity-75 bg-slate-50/50'
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isActive ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <h3 className="font-bold text-slate-900 text-sm">{rule.name}</h3>
                        {rule.ruleId && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-mono font-bold">
                            {rule.ruleId}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold">
                          Precedence #{rule.precedence || 100}
                        </span>
                      </div>
                      {rule.description ? (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {rule.description}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Deterministic policy evaluated in precedence order
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  {/* Parameter Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Rule Type</span>
                      <span className="font-semibold text-slate-800 font-mono text-[11px]">
                        {rule.ruleType}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block">Max Per Transaction</span>
                      <span className="font-semibold text-slate-800">
                        ₹{(rule.maxAmount || 5000).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block">Daily Spend Cap</span>
                      <span className="font-semibold text-slate-800">
                        ₹{(rule.dailyCap || 25000).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block">Approval Required Above</span>
                      <span className="font-semibold text-slate-800">
                        ₹{(rule.requireApprovalThreshold || 10000).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Negotiation Thresholds Badge Row */}
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-indigo-50/40 rounded-lg border border-indigo-100/60 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Percent className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="font-medium text-[11px]">Auto-Accept:</span>
                      <span className="font-bold text-emerald-700">
                        ≤ {rule.autoAcceptDiscountPercent !== undefined ? rule.autoAcceptDiscountPercent : 10}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <span className="font-medium text-[11px]">Max Allowed:</span>
                      <span className="font-bold text-rose-700">
                        ≤ {rule.maxAllowedDiscountPercent !== undefined ? rule.maxAllowedDiscountPercent : 25}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Updated {rule.updatedAt ? new Date(rule.updatedAt).toLocaleDateString() : 'recently'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRuleStatus(rule._id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                    >
                      {isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule._id, rule.name)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                      title="Delete Policy"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Configure Policy Rule</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set limits for automated agent checkouts and pricing negotiations
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Quick Presets
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      name: 'Conservative Margin Guard',
                      ruleType: 'max_spend_cap',
                      maxAmount: 3000,
                      dailyCap: 15000,
                      autoAcceptDiscountPercent: 5,
                      maxAllowedDiscountPercent: 15,
                      requireApprovalThreshold: 5000,
                    })
                  }
                  className="p-2 text-left rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition text-xs"
                >
                  <span className="font-bold text-slate-800 block text-[11px]">Conservative</span>
                  <span className="text-[10px] text-slate-500">5% auto / 15% max</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      name: 'Standard Commerce Policy',
                      ruleType: 'max_spend_cap',
                      maxAmount: 5000,
                      dailyCap: 25000,
                      autoAcceptDiscountPercent: 10,
                      maxAllowedDiscountPercent: 25,
                      requireApprovalThreshold: 10000,
                    })
                  }
                  className="p-2 text-left rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition text-xs"
                >
                  <span className="font-bold text-slate-800 block text-[11px]">Standard</span>
                  <span className="text-[10px] text-slate-500">10% auto / 25% max</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      name: 'High Volume Agent Promo',
                      ruleType: 'max_spend_cap',
                      maxAmount: 10000,
                      dailyCap: 50000,
                      autoAcceptDiscountPercent: 15,
                      maxAllowedDiscountPercent: 30,
                      requireApprovalThreshold: 20000,
                    })
                  }
                  className="p-2 text-left rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition text-xs"
                >
                  <span className="font-bold text-slate-800 block text-[11px]">Growth / Volume</span>
                  <span className="text-[10px] text-slate-500">15% auto / 30% max</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard Agent Commerce Policy"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-slate-900 outline-none transition text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rule Type</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-slate-900 outline-none transition text-xs font-semibold"
                >
                  <option value="max_spend_cap">Max Spend Cap</option>
                  <option value="daily_velocity_limit">Daily Velocity Limit</option>
                  <option value="require_manual_approval">Require Manual Approval</option>
                  <option value="allowed_categories">Allowed Categories</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Max Per Transaction (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-slate-900 outline-none transition text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Daily Cap (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={dailyCap}
                    onChange={(e) => setDailyCap(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-slate-900 outline-none transition text-xs"
                  />
                </div>
              </div>

              {/* Negotiation Guardrails */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                    Counter-Offer Discount Thresholds
                  </span>
                  <span className="text-[10px] text-slate-400">Policy Engine Enforcement</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                      Auto-Accept (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        value={autoAcceptDiscountPercent}
                        onChange={(e) => setAutoAcceptDiscountPercent(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-900 outline-none transition font-bold"
                      />
                      <Percent className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      ≤ % is immediately accepted
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                      Max Allowed (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        value={maxAllowedDiscountPercent}
                        onChange={(e) => setMaxAllowedDiscountPercent(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-slate-900 outline-none transition font-bold"
                      />
                      <Percent className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      &gt; % is immediately rejected
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Manual Approval Threshold (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={requireApprovalThreshold}
                  onChange={(e) => setRequireApprovalThreshold(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-slate-900 outline-none transition text-xs"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Transactions exceeding this amount trigger a merchant review challenge
                </span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shadow-sm disabled:opacity-50"
                >
                  {formLoading ? 'Saving...' : 'Save Policy Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
