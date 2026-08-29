import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Shield,
  Activity,
  Users,
  Store,
  Bot,
  DollarSign,
  Lock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Layers,
  FileCheck,
  TrendingUp,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function AdminOverview() {
  const [overview, setOverview] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOverviewData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/admin/overview');
      if (res.data?.platformOverview) {
        setOverview(res.data.platformOverview);
        setRecentActivity(res.data.recentActivity || []);
      }
    } catch (err) {
      console.warn('Admin overview fetch fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const totalGMV = overview?.totalGMV || 0;
  const merchants = overview?.merchants || { total: 0, verified: 0, active: 0 };
  const agents = overview?.agents || { totalActiveAgents: 0 };
  const orders = overview?.orders || { total: 0, paid: 0, payoutHolds: 0, averageOrderValue: 0 };
  const contracts = overview?.contracts || { total: 0, signed: 0, executed: 0 };
  const security = overview?.security || { totalAuditEvents: 0, blockedEvents: 0 };

  const blockedPercent = security.totalAuditEvents > 0
    ? Math.round((security.blockedEvents / security.totalAuditEvents) * 100)
    : 0;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full font-sans text-slate-800">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Platform Control Mesh & Macro Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              AP2/x402 Master Gateway
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global settlement volume, merchant governance, AI agent population telemetry, and security gate monitoring
          </p>
        </div>

        <button
          onClick={fetchOverviewData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
          <span>Refresh Platform Metrics</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Security Status Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900">
              Gateway Security Integrity: Active & Enforcing
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5">
              RSA-PSS mandate signature verification, 24-hr velocity guardrails, and Razorpay test-mode rails operating normally
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-600 shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Events</span>
            <span className="font-bold text-slate-900">{security.totalAuditEvents}</span>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Policy Blocks</span>
            <span className="font-bold text-rose-600">{security.blockedEvents}</span>
          </div>
        </div>
      </div>

      {/* 4 Core Macro Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Total Platform GMV
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            ₹{totalGMV.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400">
            Across {orders.paid} paid transactions (AOV: ₹{orders.averageOrderValue || 0})
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Merchants Enrolled
            </span>
            <Store className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-2">
            <span>{merchants.total}</span>
            <span className="text-xs font-normal text-slate-400">({merchants.verified} verified)</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {merchants.active} actively accepting agent commerce
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Active Buyer Bots
            </span>
            <Bot className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {agents.totalActiveAgents}
          </div>
          <div className="text-[11px] text-slate-400">
            Registered autonomous shopping agents
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Mandate Contracts
            </span>
            <FileCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-2">
            <span>{contracts.total}</span>
            <span className="text-xs font-normal text-slate-400">({contracts.executed} executed)</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {contracts.signed} signed AP2 cart mandates
          </div>
        </div>
      </div>

      {/* Grid of Platform Breakdown & Security Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settlement Breakdown Summary */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Order Settlement Breakdown</h3>
            <span className="text-xs text-slate-500">{orders.total} Total Orders</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-600 font-medium">Successfully Paid & Settled</span>
              <span className="font-bold text-emerald-600">{orders.statusBreakdown?.paid || 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-600 font-medium">Fulfilled & Dispatched</span>
              <span className="font-bold text-slate-800">{orders.statusBreakdown?.fulfilled || 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-600 font-medium">In Process / Draft</span>
              <span className="font-bold text-slate-800">{orders.statusBreakdown?.created || 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-600 font-medium">Security Payout Holds</span>
              <span className="font-bold text-amber-600">{orders.payoutHolds || 0}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-600 font-medium">Cancelled / Failed</span>
              <span className="font-bold text-rose-600">{orders.statusBreakdown?.failed || 0}</span>
            </div>
          </div>
        </div>

        {/* Live Recent Audit Activity Stream */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Security & Gate Activity Log</h3>
            </div>
            <span className="text-xs text-slate-500">Last 10 Events</span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs bg-slate-50">
              No recent audit logs recorded. Transaction events will appear here in real-time.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold bg-slate-50/60">
                    <th className="py-2.5 px-3 rounded-tl-lg">Decision</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Agent / Entity</th>
                    <th className="py-2.5 px-3">Diagnostic Reason</th>
                    <th className="py-2.5 px-3 text-right rounded-tr-lg">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentActivity.map((log) => {
                    const isBlock = log.decision === 'BLOCK' || log.decision === 'PAYOUT_HOLD';
                    const isApproval = log.decision === 'REQUIRE_APPROVAL';
                    return (
                      <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isBlock
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : isApproval
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {log.decision || 'ALLOW'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 font-mono text-[11px]">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {log.agentId ? `${log.agentId.substring(0, 14)}...` : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                          {log.reason || 'Security validation passed'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
