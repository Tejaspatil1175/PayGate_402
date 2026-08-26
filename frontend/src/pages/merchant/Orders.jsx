import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  Truck,
  Receipt,
  RefreshCw,
  Sparkles,
  Clock,
  DollarSign,
  User,
  ChevronRight,
  Package,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function MerchantOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [fulfillmentCarrier, setFulfillmentCarrier] = useState('Express Courier');
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchMerchantOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const res = await apiClient.get('/merchant/orders', {
        params: { merchantId },
      });

      if (res.data?.success) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load merchant orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantOrders();
  }, []);

  const handleFulfillOrder = async (orderId) => {
    setFulfillmentLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await apiClient.post('/agent/fulfillment/process', {
        orderId,
        carrier: fulfillmentCarrier,
        estimatedDeliveryDays: 2,
      });

      if (res.data?.digitalReceipt) {
        setMessage(`Order ${orderId} marked as fulfilled! Tracking #: ${res.data.digitalReceipt.fulfillment?.trackingNumber}`);
        setSelectedOrder(null);
        fetchMerchantOrders();
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to fulfill order');
    } finally {
      setFulfillmentLoading(false);
    }
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const fulfilledCount = orders.filter((o) => o.status === 'fulfilled').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Merchant Live Orders Feed
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Real-time feed of AP2 settled orders, digital receipts, and fulfillment actions
              </p>
            </div>
          </div>

          <button
            onClick={fetchMerchantOrders}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Feed</span>
          </button>
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

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Total Revenue
            </div>
            <div className="text-2xl font-extrabold text-emerald-400">
              ₹{totalRevenue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400">From AP2 Wallet Settled Orders</div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Total Received Orders
            </div>
            <div className="text-2xl font-extrabold text-white">{orders.length}</div>
            <div className="text-[11px] text-slate-400">Paid & Processing</div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Fulfilled Orders
            </div>
            <div className="text-2xl font-extrabold text-indigo-400">{fulfilledCount}</div>
            <div className="text-[11px] text-slate-400">Dispatched with Tracking</div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>Live Order Stream ({orders.length})</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              Fetching merchant orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
              No orders received yet. Automated orders will stream in as AI agents settle purchases.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 px-3">Order ID</th>
                    <th className="pb-3 px-3">Customer / Agent</th>
                    <th className="pb-3 px-3">Mandate Hash</th>
                    <th className="pb-3 px-3">Amount</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Fulfillment Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.map((ord) => {
                    const isFulfilled = ord.status === 'fulfilled';
                    return (
                      <tr key={ord._id} className="hover:bg-slate-955 transition">
                        <td className="py-3 px-3 font-mono font-semibold text-indigo-400">
                          {ord.orderId}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {ord.customer?.name || ord.customer?.email || ord.agentId || 'AI Buyer Agent'}
                        </td>
                        <td className="py-3 px-3 font-mono text-amber-400 text-[11px]">
                          {ord.mandateHash ? `${ord.mandateHash.substring(0, 14)}...` : 'N/A'}
                        </td>
                        <td className="py-3 px-3 font-bold text-white">
                          ₹{(ord.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                              isFulfilled
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!isFulfilled ? (
                            <button
                              onClick={() => handleFulfillOrder(ord._id || ord.orderId)}
                              disabled={fulfillmentLoading}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                            >
                              Fulfill Order
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[11px] flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Fulfilled</span>
                            </span>
                          )}
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
