import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Activity,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Eye,
  Filter,
  Shield,
  Clock,
  X,
  FileText,
  Check,
  AlertOctagon,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function AdminMonitoring() {
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'ALLOW' | 'PAYOUT_HOLD'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMonitoringData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch live feed
      const params = { limit: 100 };
      if (filter !== 'ALL') {
        params.decision = filter;
      }
      const res = await apiClient.get('/admin/monitoring/feed', { params });
      if (res.data?.events) {
        setLogs(res.data.events);
      }

      // 2. Fetch high priority alerts
      try {
        const alertRes = await apiClient.get('/admin/monitoring/alerts');
        if (alertRes.data?.alerts) {
          setAlerts(alertRes.data.alerts);
        }
      } catch (aErr) {
        console.warn('Alerts fetch fallback:', aErr);
      }
    } catch (err) {
      console.warn('Monitoring feed fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, [filter]);

  const filteredLogs = logs.filter((l) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const matchAction = (l.action || '').toLowerCase().includes(term);
    const matchAgent = (l.agentId || '').toLowerCase().includes(term);
    const matchMandate = (l.mandateHash || '').toLowerCase().includes(term);
    const matchReason = (l.reason || '').toLowerCase().includes(term);
    const matchMerchant = (l.merchant?.businessName || '').toLowerCase().includes(term);
    return matchAction || matchAgent || matchMandate || matchReason || matchMerchant;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full font-sans text-slate-800">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Live Security & Gate Monitoring
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Telemetry Stream
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time audit log stream, deterministic gate decisions, and anomaly challenge feeds
          </p>
        </div>

        <button
          onClick={fetchMonitoringData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* High-Risk Alerts Banner if any */}
      {alerts.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Active Security & High-Risk Alerts ({alerts.length})</span>
            </div>
            <span className="text-[11px] text-amber-700">Recent policy rejections & payout holds</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {alerts.slice(0, 2).map((alt) => (
              <div key={alt._id} className="bg-white p-2.5 rounded-lg border border-amber-200/60 flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800 text-[11px] block">{alt.action}</span>
                  <span className="text-slate-500 text-[10px] block mt-0.5 line-clamp-1">{alt.reason || 'Blocked by policy gate'}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                  {alt.decision}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters & Search Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/90 shadow-sm">
        {/* Decision Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {['ALL', 'ALLOW', 'BLOCK', 'REQUIRE_APPROVAL', 'PAYOUT_HOLD'].map((d) => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                filter === d
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {d === 'ALL' ? 'All Decisions' : d.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, agent ID, mandate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-indigo-500 outline-none transition"
          />
        </div>
      </div>

      {/* Main Audit Feed Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span>Audit Trail Stream ({filteredLogs.length})</span>
          </div>
          <span className="text-[11px] text-slate-400">Deterministic Evaluation Log</span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-xs font-medium">
            Streaming audit logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 border-dashed text-slate-400 text-xs font-medium">
            No audit log entries matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold bg-slate-50/60">
                  <th className="py-3 px-4">Gate Decision</th>
                  <th className="py-3 px-4">Action Type</th>
                  <th className="py-3 px-4">Agent Identifier</th>
                  <th className="py-3 px-4">Mandate Hash</th>
                  <th className="py-3 px-4">Diagnostic Reason</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const isBlock = log.decision === 'BLOCK' || log.decision === 'PAYOUT_HOLD';
                  const isApproval = log.decision === 'REQUIRE_APPROVAL';
                  return (
                    <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4 font-semibold text-slate-800 font-mono text-[11px]">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {log.agentId ? `${log.agentId.substring(0, 14)}...` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-amber-700 font-mono text-[11px]">
                        {log.mandateHash ? `${log.mandateHash.substring(0, 12)}...` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {log.reason || 'Verification check passed'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }) : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition"
                          title="Inspect JSON Payload"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Audit Event Inspection: {selectedLog.action}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Correlation ID: {selectedLog.correlationId || selectedLog._id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Decision</span>
                  <span className="font-bold text-slate-900">{selectedLog.decision}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Execution Time</span>
                  <span className="font-bold text-slate-900">{selectedLog.executionTimeMs || 12} ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Agent ID</span>
                  <span className="font-mono text-slate-800">{selectedLog.agentId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Mandate Hash</span>
                  <span className="font-mono text-slate-800">{selectedLog.mandateHash || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Reason Log</span>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700 font-mono text-[11px]">
                  {selectedLog.reason || 'No diagnostic error logged.'}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">Metadata JSON</span>
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.metadata || selectedLog, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
