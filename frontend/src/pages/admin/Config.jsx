import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ShieldCheck,
  Save,
  RefreshCw,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function AdminConfig() {
  const [config, setConfig] = useState({
    defaultSpendCap: 5000,
    defaultDailyCap: 25000,
    enforcePolicyPreCheck: true,
    fraudBlockThreshold: 0.75,
    manualApprovalThreshold: 10000,
    securityMode: 'STRICT',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/admin/config');
      if (res.data?.success && res.data.config) {
        setConfig(res.data.config);
      }
    } catch (err) {
      // Keep defaults if backend config endpoint returns default object
      console.log('Using default system config');
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
      const res = await apiClient.put('/admin/config', config);
      if (res.data?.success) {
        setMessage('Platform configuration updated and broadcasted to 5-Gate Security Mesh!');
      } else {
        setMessage('Platform configuration saved successfully!');
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update platform configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig({
      defaultSpendCap: 5000,
      defaultDailyCap: 25000,
      enforcePolicyPreCheck: true,
      fraudBlockThreshold: 0.75,
      manualApprovalThreshold: 10000,
      securityMode: 'STRICT',
    });
    setMessage('Reset system policy options to default values.');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-600/10 border border-purple-500/30 text-purple-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Platform Configuration & Mesh Parameters
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Configure global security caps, fraud thresholds, and policy pre-check enforcement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
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
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Form Controls */}
        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Global Security & Spending Caps</span>
              </div>
              <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full font-bold">
                Mode: {config.securityMode}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1.5">
                  Default Per-Transaction Spend Cap (₹)
                </label>
                <input
                  type="number"
                  required
                  min="100"
                  value={config.defaultSpendCap}
                  onChange={(e) => setConfig({ ...config, defaultSpendCap: Number(e.target.value) })}
                  className="w-full bg-slate-955 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Applies to unconfigured buyer accounts for autonomous agent spends.
                </span>
              </div>

              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1.5">
                  Global Daily Velocity Spend Cap (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={config.defaultDailyCap}
                  onChange={(e) => setConfig({ ...config, defaultDailyCap: Number(e.target.value) })}
                  className="w-full bg-slate-955 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Cumulative 24-hour limit across all active agents per user.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2">
              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1.5">
                  Fraud Risk Block Threshold (0.0 to 1.0)
                </label>
                <input
                  type="number"
                  step="0.05"
                  required
                  min="0.1"
                  max="1.0"
                  value={config.fraudBlockThreshold}
                  onChange={(e) => setConfig({ ...config, fraudBlockThreshold: Number(e.target.value) })}
                  className="w-full bg-slate-955 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Gate C blocks transactions exceeding this calculated risk score.
                </span>
              </div>

              <div>
                <label className="block text-slate-400 uppercase font-semibold mb-1.5">
                  Manual Approval Threshold (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  value={config.manualApprovalThreshold}
                  onChange={(e) => setConfig({ ...config, manualApprovalThreshold: Number(e.target.value) })}
                  className="w-full bg-slate-955 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Orders above this value trigger REQUIRE_MANUAL_APPROVAL gate status.
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="font-semibold text-white text-xs block">
                  Enforce Real-Time Policy Pre-Check (Gate B2)
                </span>
                <span className="text-[11px] text-slate-400">
                  Evaluates merchant PolicyRule documents prior to fraud scoring
                </span>
              </div>

              <input
                type="checkbox"
                checked={config.enforcePolicyPreCheck}
                onChange={(e) => setConfig({ ...config, enforcePolicyPreCheck: e.target.checked })}
                className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl py-3.5 flex items-center justify-center gap-2 transition shadow-lg shadow-purple-600/25 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving System Config...' : 'Save Platform Config Parameters'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
