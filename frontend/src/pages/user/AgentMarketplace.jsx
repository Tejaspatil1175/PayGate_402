import React, { useState, useEffect } from 'react';
import {
  Bot,
  CheckCircle2,
  Power,
  ShieldCheck,
  Cpu,
  Zap,
  Sparkles,
  Search,
  Sliders,
  Clock,
  TrendingDown,
  Compass,
  Lock,
  Wallet,
  Play,
  Pause,
  X,
  AlertCircle,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function AgentMarketplace() {
  const [catalog, setCatalog] = useState([]);
  const [activeAgents, setActiveAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-dismiss notification toasts
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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
    return activeAgents.find(
      (a) => a.agentSlug === agentSlug || a.agentType?.agentSlug === agentSlug
    );
  };

  const handleActivate = async (agentSlug, title) => {
    setActionLoading(agentSlug);
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
        await fetchData();
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to activate agent');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (userAgentId, currentStatus, title, agentSlug) => {
    setActionLoading(agentSlug || userAgentId);
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
        setActionMessage(
          newStatus === 'active'
            ? `Resumed agent "${title || 'Agent'}"!`
            : `Paused agent "${title || 'Agent'}"`
        );
        await fetchData();
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to update agent status');
    } finally {
      setActionLoading(null);
    }
  };

  // Helper for agent metadata visuals
  const getAgentVisuals = (slug, category) => {
    switch (slug) {
      case 'smart-negotiator':
        return {
          icon: <TrendingDown className="w-5 h-5" />,
          accentBg: 'bg-purple-50 text-purple-600 border-purple-200',
          badgeBg: 'bg-purple-100/70 text-purple-800 border-purple-200',
          gradient: 'from-purple-500/10 to-indigo-500/5',
          protocol: 'AP2-NEGOTIATION-V1',
        };
      case 'deal-scout':
        return {
          icon: <Compass className="w-5 h-5" />,
          accentBg: 'bg-sky-50 text-sky-600 border-sky-200',
          badgeBg: 'bg-sky-100/70 text-sky-800 border-sky-200',
          gradient: 'from-sky-500/10 to-blue-500/5',
          protocol: 'AP2-DISCOVERY-V1',
        };
      case 'budget-guard':
        return {
          icon: <ShieldCheck className="w-5 h-5" />,
          accentBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
          badgeBg: 'bg-emerald-100/70 text-emerald-800 border-emerald-200',
          gradient: 'from-emerald-500/10 to-teal-500/5',
          protocol: 'AP2-GUARDRAIL-V1',
        };
      case 'scheduled-buyer':
        return {
          icon: <Clock className="w-5 h-5" />,
          accentBg: 'bg-amber-50 text-amber-600 border-amber-200',
          badgeBg: 'bg-amber-100/70 text-amber-800 border-amber-200',
          gradient: 'from-amber-500/10 to-orange-500/5',
          protocol: 'AP2-SCHEDULER-V1',
        };
      default:
        return {
          icon: <Cpu className="w-5 h-5" />,
          accentBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
          badgeBg: 'bg-indigo-100/70 text-indigo-800 border-indigo-200',
          gradient: 'from-indigo-500/10 to-purple-500/5',
          protocol: 'AP2-CORE-V1',
        };
    }
  };

  const activeCount = activeAgents.filter((a) => a.status === 'active').length;
  const pausedCount = activeAgents.filter((a) => a.status === 'paused').length;

  const filteredCatalog = catalog.filter((item) => {
    if (selectedCategory !== 'all' && item.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      return title.includes(q) || desc.includes(q) || cat.includes(q);
    }
    return true;
  });

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full">
      <div className="space-y-4 sm:space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
              <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  AP2 Agent Marketplace
                </h1>
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  AP2 Mesh Ecosystem
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deploy and manage specialized autonomous sub-agents sharing your single non-custodial wallet ledger.
              </p>
            </div>
          </div>

          {/* Quick Telemetry Pills */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs text-xs font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeCount} Active</span>
              {pausedCount > 0 && <span className="text-slate-400">({pausedCount} Paused)</span>}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-indigo-600" />
              <span>Unified Vault</span>
            </div>
          </div>
        </div>

        {/* Shared Wallet Guardrail Banner */}
        <div className="bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Shared Wallet Atomic Isolation</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                All active agents execute over your single AP2 vault using atomic ledger debits. Spending is strictly constrained by your Per-Transaction and Daily Guardrails.
              </p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold text-indigo-700 bg-white border border-indigo-200/80 px-3 py-1.5 rounded-xl shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Cryptographic Nonce Protected</span>
          </div>
        </div>

        {/* Category Filters & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
            {[
              { id: 'all', label: 'All Agents' },
              { id: 'negotiation', label: 'Negotiation' },
              { id: 'discovery', label: 'Discovery' },
              { id: 'security', label: 'Security' },
              { id: 'automation', label: 'Automation' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                  selectedCategory === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search agent capabilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none transition"
            />
          </div>
        </div>

        {/* Agent Catalog Cards Grid */}
        {loading ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm">
            <Cpu className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
            <span>Loading agent catalog from AP2 mesh...</span>
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm space-y-2">
            <Bot className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No agents match your filter.</p>
            <p className="text-xs text-slate-400">Try selecting "All Agents" or clearing your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCatalog.map((item) => {
              const activeRecord = getActiveStateForAgent(item.agentSlug);
              const isInstalled = Boolean(activeRecord);
              const isActive = activeRecord?.status === 'active';
              const isActionRunning = actionLoading === item.agentSlug || actionLoading === activeRecord?._id;
              const visual = getAgentVisuals(item.agentSlug, item.category);

              return (
                <div
                  key={item._id}
                  className={`bg-white border rounded-2xl p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-5 relative overflow-hidden group ${
                    isActive ? 'border-emerald-200/90' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Subtle Background Accent Gradient */}
                  <div
                    className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${visual.gradient} rounded-full blur-3xl pointer-events-none`}
                  />

                  <div className="space-y-4 relative z-10">
                    {/* Top Tag & Status Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${visual.badgeBg}`}
                      >
                        {item.category || 'General'}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                          {visual.protocol}
                        </span>

                        <span
                          className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isInstalled
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {isInstalled && !isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                          {!isInstalled && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                          <span>{isActive ? 'Active' : isInstalled ? 'Paused' : 'Not Installed'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Agent Title & Icon Header */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-2xs shrink-0 ${visual.accentBg}`}
                      >
                        {visual.icon}
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Default Capabilities Badges */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Autonomous Capabilities
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(item.defaultCapabilities || []).map((cap, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/90 text-[11px] text-slate-700 font-semibold flex items-center gap-1 shadow-2xs"
                          >
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{cap}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-slate-100 relative z-10">
                    {!isInstalled ? (
                      <button
                        type="button"
                        disabled={isActionRunning}
                        onClick={() => handleActivate(item.agentSlug, item.title)}
                        className="w-full bg-[#0c2340] hover:bg-[#071d37] active:scale-98 text-white text-xs font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Zap className="w-4 h-4 text-[#3395FF] fill-[#3395FF]" />
                        <span>{isActionRunning ? 'Activating Agent...' : 'Activate Agent for Account'}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isActionRunning}
                          onClick={() =>
                            handleToggleStatus(
                              activeRecord._id,
                              activeRecord.status,
                              item.title,
                              item.agentSlug
                            )
                          }
                          className={`flex-1 text-xs font-bold rounded-xl py-2.5 flex items-center justify-center gap-2 transition border cursor-pointer active:scale-98 ${
                            isActive
                              ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                              : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xs'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <Pause className="w-3.5 h-3.5 text-amber-600" />
                              <span>{isActionRunning ? 'Updating...' : 'Pause Agent'}</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-white fill-white" />
                              <span>{isActionRunning ? 'Updating...' : 'Resume Agent'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Pop-up Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 md:px-0">
        {error && (
          <div className="pointer-events-auto bg-slate-900 text-white border border-rose-500/50 p-4 rounded-2xl shadow-2xl flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 pr-1">
              <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Error Notification</h4>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionMessage && (
          <div className="pointer-events-auto bg-slate-900 text-white border border-emerald-500/50 p-4 rounded-2xl shadow-2xl flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 pr-1">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Marketplace Action</h4>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">{actionMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage('')}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
