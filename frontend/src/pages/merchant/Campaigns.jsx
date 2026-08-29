import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Percent,
  Calendar,
  Layers,
  Tag,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShoppingBag,
  Clock,
  ArrowRight,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function MerchantCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountPercent, setDiscountPercent] = useState('20');
  const [minQuantity, setMinQuantity] = useState('3');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formLoading, setFormLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchCampaigns = async () => {
    setLoading(true);
    setError('');
    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const res = await apiClient.get('/campaigns', {
        params: { merchantId },
      });

      if (res.data?.success) {
        setCampaigns(res.data.campaigns || []);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load merchant campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage('');
    setError('');

    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const payload = {
        merchantId,
        name,
        description,
        discountPercent: Number(discountPercent),
        minQuantity: Number(minQuantity) || 1,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(),
        isActive: true,
      };

      const res = await apiClient.post('/campaigns', payload);

      if (res.data?.success || res.data?.campaign) {
        setMessage(`Campaign "${name}" created successfully! AI agents will receive ${discountPercent}% off on ≥${minQuantity} units.`);
        setShowAddModal(false);
        setName('');
        setDescription('');
        setDiscountPercent('20');
        setMinQuantity('3');
        fetchCampaigns();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.error || err.message || 'Failed to create campaign');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (campaignId) => {
    try {
      const res = await apiClient.patch(`/campaigns/${campaignId}/toggle`);
      if (res.data?.success) {
        setMessage('Campaign status updated.');
        fetchCampaigns();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setCampaigns((prev) =>
        prev.map((c) => (c._id === campaignId ? { ...c, isActive: !c.isActive } : c))
      );
      setMessage('Campaign status updated.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDelete = async (campaignId, nameStr) => {
    if (!window.confirm(`Are you sure you want to delete campaign "${nameStr}"?`)) return;
    try {
      await apiClient.delete(`/campaigns/${campaignId}`);
      setMessage(`Deleted campaign "${nameStr}".`);
      fetchCampaigns();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setCampaigns((prev) => prev.filter((c) => c._id !== campaignId));
      setMessage(`Deleted campaign "${nameStr}".`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const activeCount = campaigns.filter((c) => c.isActive !== false).length;
  const maxDiscount = campaigns.length > 0 ? Math.max(...campaigns.map((c) => c.discountPercent || 0)) : 0;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Megaphone className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Campaign Orchestrator
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure targeted promotional discounts and volume incentives for autonomous AI buyer agents
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Campaign</span>
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
            Total Campaigns
          </div>
          <div className="text-3xl font-black text-slate-800">{campaigns.length}</div>
          <div className="text-xs font-medium text-slate-400">Promotions Configured</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
            Active Agent Promos
          </div>
          <div className="text-3xl font-black text-emerald-600">{activeCount}</div>
          <div className="text-xs font-medium text-slate-400">Live in Negotiation Engine</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
            Max Promo Discount
          </div>
          <div className="text-3xl font-black text-indigo-600">{maxDiscount}% OFF</div>
          <div className="text-xs font-medium text-slate-400">For Bulk Order Inquiries</div>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-indigo-600" />
                <span>Launch New Campaign</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4 text-sm font-medium">
              <div>
                <label className="block text-slate-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. AI Agent Bulk Volume Incentive"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Auto-approve 20% discount when an autonomous agent negotiates for 3 or more units."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1">Discount (% Off)</label>
                  <div className="relative">
                    <Percent className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Min Units Required</label>
                  <div className="relative">
                    <ShoppingBag className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      required
                      min="1"
                      value={minQuantity}
                      onChange={(e) => setMinQuantity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition text-xs font-semibold"
                  />
                </div>
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
                  {formLoading ? 'Launching...' : 'Launch Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaigns Stream Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Tag className="w-5 h-5 text-indigo-500" />
          <span>Configured Campaigns ({campaigns.length})</span>
        </div>

        <button
          onClick={fetchCampaigns}
          disabled={loading}
          className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition px-3 py-1.5 rounded-lg hover:bg-indigo-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm font-medium">
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-sm font-medium bg-white shadow-sm space-y-3">
          <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
          <p>No active campaigns launched yet.</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Create a campaign to automatically grant extra discounts to AI agents ordering in higher quantities.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const isActive = camp.isActive !== false;
            const startStr = camp.startDate ? new Date(camp.startDate).toLocaleDateString('en-IN') : 'Immediate';
            const endStr = camp.endDate ? new Date(camp.endDate).toLocaleDateString('en-IN') : 'Ongoing';

            return (
              <div
                key={camp._id}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 relative group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      {isActive ? 'Live & Active' : 'Disabled'}
                    </span>
                    <span className="text-xl font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-0.5 rounded-xl">
                      {camp.discountPercent}% OFF
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition">
                      {camp.name}
                    </h3>
                    {camp.description && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {camp.description}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Quantity Trigger:</span>
                      <span className="font-bold text-slate-800">≥ {camp.minQuantity || 1} units</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Active Window:</span>
                      <span className="font-semibold text-slate-700">{startStr} → {endStr}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleStatus(camp._id)}
                    className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    {isActive ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(camp._id, camp.name)}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                    title="Delete Campaign"
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
