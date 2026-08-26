import React, { useState, useEffect } from 'react';
import {
  Bot,
  CheckCircle2,
  Power,
  ShieldCheck,
  Cpu,
  Zap,
  Sparkles,
  Layers,
  Search,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function AgentMarketplace() {
  const [catalog, setCatalog] = useState([]);
  const [activeAgents, setActiveAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const [catRes, actRes] = await Promise.all([
        apiClient.get('/agent-marketplace/catalog'),
        apiClient.get('/agent-marketplace/active', { params: { userId } }),
      ]);

      if (catRes.data?.success) {
        setCatalog(catRes.data.catalog || []);
      }
      if (actRes.data?.success) {
        setActiveAgents(actRes.data.activeAgents || []);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load agent marketplace data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getActiveStateForAgent = (agentSlug) => {
    return activeAgents.find((a) => a.agentSlug === agentSlug || a.agentType?.agentSlug === agentSlug);
  };

  const handleActivate = async (agentSlug, title) => {
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.post('/agent-marketplace/activate', {
        userId,
        agentSlug,
      });

      if (res.data?.success) {
        setActionMessage(`Activated agent "${title || agentSlug}"!`);
        fetchData();
        setTimeout(() => setActionMessage(''), 3000);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to activate agent');
    }
  };

  const handleToggleStatus = async (userAgentId, currentStatus, title) => {
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const newStatus = currentStatus === 'active' ? 'paused' : 'active';

      const res = await apiClient.put('/agent-marketplace/toggle', {
        userId,
        userAgentId,
        status: newStatus,
      });

      if (res.data?.success) {
        setActionMessage(`Updated "${title || 'Agent'}" status to '${newStatus}'.`);
        fetchData();
        setTimeout(() => setActionMessage(''), 3000);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update agent status');
    }
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
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                AP2 Agent Marketplace
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Activate specialized autonomous agents sharing your single wallet ledger
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl self-start md:self-auto">
            {activeAgents.length} Active Agent(s) Installed
          </span>
        </div>

        {/* Notifications */}
        {actionMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionMessage}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Shared Wallet Guardrail Banner */}
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-300">
          <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          <span>
            <strong>Shared Wallet Protection:</strong> All active agents on your account operate over your single AP2 wallet using atomic debits, ensuring concurrent agent spends never exceed your per-transaction or daily caps.
          </span>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            Loading available agent catalog...
          </div>
        ) : catalog.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            No marketplace agents available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {catalog.map((item) => {
              const activeRecord = getActiveStateForAgent(item.agentSlug);
              const isInstalled = Boolean(activeRecord);
              const isActive = activeRecord?.status === 'active';

              return (
                <div
                  key={item._id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
                        {item.category || 'General'}
                      </span>

                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : isInstalled
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isActive ? 'Active' : isInstalled ? 'Paused' : 'Not Installed'}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-400" />
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Default Capabilities */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Capabilities
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(item.defaultCapabilities || []).map((cap, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-lg bg-slate-955 border border-slate-800 text-[11px] text-slate-300"
                          >
                            ✓ {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-slate-800/80">
                    {!isInstalled ? (
                      <button
                        onClick={() => handleActivate(item.agentSlug, item.title)}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 transition shadow-md shadow-indigo-600/20"
                      >
                        <Zap className="w-4 h-4" />
                        <span>Activate Agent for Account</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(activeRecord._id, activeRecord.status, item.title)}
                        className={`w-full text-xs font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 transition border ${
                          isActive
                            ? 'bg-slate-955 border-slate-800 text-amber-400 hover:bg-amber-500/10'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                        <span>{isActive ? 'Pause Agent' : 'Resume Agent'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
