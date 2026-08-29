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
  ChevronDown,
  ChevronUp,
  Package,
  ShieldCheck,
  ShieldAlert,
  Info,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function MerchantOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

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

  const toggleExpand = (id) => {
    setExpandedOrderId((prev) => (prev === id ? null : id));
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const fulfilledCount = orders.filter((o) => o.status === 'fulfilled').length;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Merchant Live Orders Feed
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Real-time feed of AP2 settled orders, gate decisions, digital receipts, and fulfillment actions
            </p>
          </div>
        </div>

        <button
          onClick={fetchMerchantOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : 'text-slate-400'}`} />
          <span>Refresh Feed</span>
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

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
            Total Revenue
          </div>
          <div className="text-3xl font-black text-emerald-600">
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs font-medium text-slate-400">From AP2 Wallet Settled Orders</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
            Total Received Orders
          </div>
          <div className="text-3xl font-black text-slate-800">{orders.length}</div>
          <div className="text-xs font-medium text-slate-400">Paid & Processing</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition space-y-2">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">
            Fulfilled Orders
          </div>
          <div className="text-3xl font-black text-indigo-600">{fulfilledCount}</div>
          <div className="text-xs font-medium text-slate-400">Dispatched with Tracking</div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Package className="w-5 h-5 text-indigo-500" />
            <span>Live Order Stream ({orders.length})</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm font-medium">
            Fetching merchant orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-sm font-medium bg-slate-50">
            No orders received yet. Automated orders will stream in as AI agents settle purchases.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-xs font-bold bg-slate-50/50">
                  <th className="py-4 px-4 rounded-tl-xl">Order ID</th>
                  <th className="py-4 px-4">Customer / Agent</th>
                  <th className="py-4 px-4">Gate Decision</th>
                  <th className="py-4 px-4">Mandate Hash</th>
                  <th className="py-4 px-4">Amount</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4 text-right rounded-tr-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => {
                  const isFulfilled = ord.status === 'fulfilled';
                  const isExpanded = expandedOrderId === ord._id;
                  const gatePassed = ord.gateDecision ? ord.gateDecision.passed !== false : true;
                  const gateReason = ord.gateDecision?.reason || 'AP2 Policy checks verified and passed.';

                  return (
                    <React.Fragment key={ord._id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-indigo-600 text-xs">
                          <button
                            onClick={() => toggleExpand(ord._id)}
                            className="flex items-center gap-1 hover:underline text-left"
                            title="Click to view gate decision details"
                          >
                            <span>{ord.orderId}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-700">
                          {ord.customer?.name || ord.customer?.email || ord.agentId || 'AI Buyer Agent'}
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => toggleExpand(ord._id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition ${
                              gatePassed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Click to inspect gate decision trail"
                          >
                            {gatePassed ? (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>{gatePassed ? 'Approved' : 'Challenged'}</span>
                          </button>
                        </td>
                        <td className="py-4 px-4 font-mono text-amber-600 text-xs font-semibold">
                          <span className="bg-amber-50/70 border border-amber-100 px-2 py-0.5 rounded">
                            {ord.mandateHash ? `${ord.mandateHash.substring(0, 12)}...` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-black text-slate-900">
                          ₹{(ord.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-md font-bold uppercase text-[10px] border ${
                              isFulfilled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {!isFulfilled ? (
                            <button
                              onClick={() => handleFulfillOrder(ord._id || ord.orderId)}
                              disabled={fulfillmentLoading}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
                            >
                              Fulfill Order
                            </button>
                          ) : (
                            <span className="text-slate-500 font-bold text-xs flex items-center justify-end gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span>Fulfilled</span>
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Gate Decision & Detail Row */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/40 border-b border-indigo-100">
                          <td colSpan={7} className="p-4 px-6 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                  <span>AP2 Protocol Gate Decision Audit Trail</span>
                                </div>
                                <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-indigo-100/80 font-mono leading-relaxed">
                                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold mb-1">
                                    Diagnostic Reason Log:
                                  </span>
                                  {gateReason}
                                </p>
                              </div>

                              <div className="text-right text-[11px] text-slate-500 space-y-1 shrink-0">
                                {ord.gateDecision?.evaluatedAt && (
                                  <div>
                                    <span className="font-semibold text-slate-700">Evaluated: </span>
                                    {new Date(ord.gateDecision.evaluatedAt).toLocaleString('en-IN')}
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold text-slate-700">Payment ID: </span>
                                  <span className="font-mono text-slate-600">{ord.razorpayPaymentId || ord.razorpayOrderId || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
