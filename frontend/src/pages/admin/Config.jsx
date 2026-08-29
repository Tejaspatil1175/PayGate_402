import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  Save,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  Power,
  Shield,
  Zap,
  Trash2,
  AlertOctagon,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function AdminConfig() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    'System is currently undergoing scheduled maintenance. Please retry shortly.'
  );
  const [featureFlags, setFeatureFlags] = useState({
    enableFraudScoring: true,
    enableUpsellEngine: true,
    enableDiscountOptimizer: true,
    enableGatedActions: true,
    enableTransactionGuardrails: true,
    enableAbandonedCartRecovery: true,
  });
  const [globalLimits, setGlobalLimits] = useState({
    maxSingleTransactionAmount: 100000,
    defaultManualApprovalThreshold: 25000,
    firstTimeBuyerSpendLimit: 10000,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOptions, setResetOptions] = useState({
    purgeMerchants: true,
    purgeProducts: true,
    purgeUsers: true,
    purgeWallets: true,
    purgeOrders: true,
    purgeContracts: true,
    purgeIntents: true,
    purgeAuditLogs: true,
    purgeNegotiations: true,
    purgeCampaigns: true,
    purgePolicyRules: true,
    purgeScheduledTasks: true,
    purgeWishlists: true,
    purgeUserAgents: true,
    purgeUserPersonas: true,
    purgeRegistries: true,
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/admin/config');
      if (res.data?.config) {
        const c = res.data.config;
        if (typeof c.maintenanceMode === 'boolean') setMaintenanceMode(c.maintenanceMode);
        if (c.maintenanceMessage) setMaintenanceMessage(c.maintenanceMessage);
        if (c.featureFlags) setFeatureFlags((prev) => ({ ...prev, ...c.featureFlags }));
        if (c.globalLimits) setGlobalLimits((prev) => ({ ...prev, ...c.globalLimits }));
      }
    } catch (err) {
      console.warn('Admin config fetch fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        maintenanceMode,
        maintenanceMessage,
        featureFlags,
        globalLimits,
      };
      const res = await apiClient.put('/admin/config', payload);
      setMessage(res.data?.message || 'Platform configuration saved and active across gateway!');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.error || err.message || 'Failed to update platform configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteReset = async () => {
    setResetting(true);
    setMessage('');
    setError('');
    try {
      const res = await apiClient.post('/admin/system/reset', resetOptions);
      setShowResetModal(false);
      const counts = res.data?.deletedCounts || {};
      setMessage(
        `Database purged successfully! (Orders: ${counts.orders || 0}, Mandates: ${
          counts.contracts || 0
        }, Audit Logs: ${counts.auditLogs || 0}, Wallets Reset: ${counts.walletsReset || 0})`
      );
      setTimeout(() => setMessage(''), 6000);
    } catch (err) {
      setError(err.error || err.message || 'Failed to reset database');
    } finally {
      setResetting(false);
    }
  };

  const toggleFlag = (key) => {
    setFeatureFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full font-sans text-slate-800">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Sliders className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Platform Configuration & Feature Flags
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Live Governance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic runtime switches, global spending limits, and emergency maintenance controls
          </p>
        </div>

        <button
          onClick={fetchConfig}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
          <span>Reload Config</span>
        </button>
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

      <form onSubmit={handleSaveConfig} className="space-y-6">
        {/* Section 1: Maintenance Mode Killswitch */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Power className={`w-4 h-4 ${maintenanceMode ? 'text-rose-600' : 'text-slate-400'}`} />
              <h3 className="text-sm font-bold text-slate-900">Platform Maintenance Mode</h3>
            </div>
            <button
              type="button"
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                maintenanceMode
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {maintenanceMode ? 'MAINTENANCE ACTIVE (BLOCKING)' : 'NORMAL OPERATION'}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Maintenance Message (Emitted in HTTP 503 responses)
            </label>
            <input
              type="text"
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-indigo-500 outline-none transition"
              disabled={!maintenanceMode}
            />
          </div>
        </div>

        {/* Section 2: Runtime Feature Flags */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Runtime Engine Feature Flags</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Instantly toggle autonomous commerce sub-engines across all incoming agent requests
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              { key: 'enableFraudScoring', label: 'AI Fraud Risk & Anomaly Scoring', desc: 'Real-time 0-100 risk scoring on all checkouts' },
              { key: 'enableGatedActions', label: 'Manual Approval & Policy Thresholds', desc: 'Require human sign-off for high-value orders' },
              { key: 'enableTransactionGuardrails', label: 'Velocity Limits & Spend Caps', desc: 'Enforce 24-hr cumulative limits and single-tx caps' },
              { key: 'enableDiscountOptimizer', label: 'Dynamic Price & Margin Optimization', desc: 'Automatic counter-offer bounds evaluation' },
              { key: 'enableUpsellEngine', label: 'Upsell & Cross-Sell Telemetry', desc: 'Intelligent add-on recommendations for buyer agents' },
              { key: 'enableAbandonedCartRecovery', label: 'Agent Mandate Expiration Guard', desc: 'Auto-recover expired carts before settlement' },
            ].map((f) => {
              const enabled = Boolean(featureFlags[f.key]);
              return (
                <div
                  key={f.key}
                  onClick={() => toggleFlag(f.key)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex items-start justify-between gap-3 ${
                    enabled
                      ? 'bg-indigo-50/40 border-indigo-200/80 hover:bg-indigo-50/70'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <span className="font-bold text-slate-900 block">{f.label}</span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">{f.desc}</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
                      enabled
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {enabled && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Global Limits */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Global Financial & Spend Limits (₹)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Maximum safety bounds applied across all merchants and agent purchases
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Max Single Transaction (₹)</label>
              <input
                type="number"
                value={globalLimits.maxSingleTransactionAmount}
                onChange={(e) =>
                  setGlobalLimits({ ...globalLimits, maxSingleTransactionAmount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition"
              />
              <span className="text-[11px] text-slate-400">Hard ceiling per order</span>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Manual Approval Trigger (₹)</label>
              <input
                type="number"
                value={globalLimits.defaultManualApprovalThreshold}
                onChange={(e) =>
                  setGlobalLimits({ ...globalLimits, defaultManualApprovalThreshold: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition"
              />
              <span className="text-[11px] text-slate-400">Orders above require admin review</span>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">First-Time Buyer Limit (₹)</label>
              <input
                type="number"
                value={globalLimits.firstTimeBuyerSpendLimit}
                onChange={(e) =>
                  setGlobalLimits({ ...globalLimits, firstTimeBuyerSpendLimit: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition"
              />
              <span className="text-[11px] text-slate-400">Restricted for new agent identities</span>
            </div>
          </div>
        </div>

        {/* Section 4: Database Clean Slate Purge & Reset */}
        <div className="bg-rose-50/40 border border-rose-200/80 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-rose-200/60 pb-3">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-rose-900">Database Clean Slate Purge & Reset</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 uppercase">
              Danger Zone
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Instantly wipe out all transactional records (Orders, AP2 Cart Mandates, Audit Logs, Negotiations, and Campaigns) and restore the test buyer wallet balance back to ₹50,000 without altering any database schemas or collections.
          </p>

          <div>
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition shadow-sm flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge & Reset Operational Data</span>
            </button>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal for Database Reset */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertOctagon className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-sm">Confirm Database Clean Slate Purge</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This action will permanently delete all records across ALL collections (Merchants, Products, Users, Wallets, Orders, AP2 Mandates, and Audit Logs) from MongoDB while preserving database schemas.
            </p>

            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
              <span className="font-bold text-slate-800 text-[11px] block mb-1">Collections to be Purged:</span>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-rose-600" />
                  <span>Merchants & Catalogs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-rose-600" />
                  <span>Users & Buyer Wallets</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-rose-600" />
                  <span>Orders & Payments</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-rose-600" />
                  <span>AP2 Cart Mandates & Intents</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-rose-600" />
                  <span>Audit & Security Logs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-rose-600" />
                  <span>Campaigns & Governance Rules</span>
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={resetting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                {resetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{resetting ? 'Purging Database...' : 'Yes, Purge Operational Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
