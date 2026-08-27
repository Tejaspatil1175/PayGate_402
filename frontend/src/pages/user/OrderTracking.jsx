import React, { useState, useEffect } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Receipt,
  ChevronRight,
  Store,
  Calendar,
  Sparkles,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function OrderTracking() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.get('/user-orders', { params: { userId } });
      if (res.data?.success) {
        const orderList = res.data.orders || [];
        setOrders(orderList);
        if (orderList.length > 0) {
          fetchOrderDetails(orderList[0]._id || orderList[0].orderId);
        }
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load user orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    setDetailsLoading(true);
    setSelectedOrder(orderId);
    try {
      const res = await apiClient.get(`/user-orders/${orderId}`);
      if (res.data?.success) {
        setOrderDetails(res.data);
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                My Orders & Live Tracking
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </h1>
              <p className="text-sm text-slate-500">
                Track AP2 settlement orders and live delivery fulfillment status
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-600 font-semibold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs self-start md:self-auto">
            {orders.length} Total Orders
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            Loading order history...
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-sm bg-white">
            No orders found in your purchase history.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders List Column */}
            <div className="space-y-3 lg:col-span-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Order History
              </h2>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {orders.map((ord) => {
                  const isSelected = selectedOrder === ord._id || selectedOrder === ord.orderId;
                  const isFulfilled = ord.status === 'fulfilled' || ord.status === 'DELIVERED';

                  return (
                    <div
                      key={ord._id}
                      onClick={() => fetchOrderDetails(ord._id || ord.orderId)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-indigo-700 font-bold">
                          {ord.orderId || ord._id?.slice(-8)}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            isFulfilled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 flex items-center gap-1 font-medium">
                          <Store className="w-3 h-3 text-slate-400" />
                          {ord.merchant?.businessName || 'Merchant'}
                        </span>
                        <span className="font-black text-slate-900 text-sm">
                          ₹{(ord.amount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(ord.createdAt).toLocaleDateString('en-IN')}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Order Details & Live Timeline Column */}
            <div className="lg:col-span-2 space-y-6">
              {detailsLoading ? (
                <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm shadow-xs">
                  Fetching tracking details...
                </div>
              ) : !orderDetails ? (
                <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-slate-500 text-sm shadow-xs">
                  Select an order from the left to view live tracking details.
                </div>
              ) : (
                <>
                  {/* Order Overview Header Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                      <div>
                        <div className="text-xs font-semibold text-slate-400">AP2 Mandate Hash</div>
                        <code className="text-xs text-indigo-700 font-mono font-bold">
                          {orderDetails.order?.mandateHash || orderDetails.fulfillment?.mandateHash || '0xAB...CDF'}
                        </code>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-400">Order Amount</div>
                        <div className="text-2xl font-black text-slate-900">
                          ₹{(orderDetails.order?.amount || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase text-slate-400">
                        Purchased Items
                      </div>
                      <div className="divide-y divide-slate-100">
                        {(orderDetails.order?.items || []).map((item, idx) => (
                          <div key={idx} className="py-2 flex items-center justify-between text-xs">
                            <span className="text-slate-800 font-bold">{item.title} (x{item.quantity})</span>
                            <span className="text-slate-900 font-bold">₹{(item.price || 0).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Delivery Timeline Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      <span>Live Delivery Status Timeline</span>
                    </div>

                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {(orderDetails.timeline || []).map((step, idx) => (
                        <div key={idx} className="relative flex items-start gap-4">
                          <div
                            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                              step.completed
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {step.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
                          </div>

                          <div className="flex-1">
                            <div className={`text-sm font-bold ${step.completed ? 'text-slate-900' : 'text-slate-400'}`}>
                              {step.step}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {step.completed
                                ? step.timestamp
                                  ? new Date(step.timestamp).toLocaleString('en-IN')
                                  : 'Completed'
                                : 'Pending'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Digital Receipt Info */}
                  {orderDetails.fulfillment && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Receipt className="w-4 h-4 text-indigo-600" />
                        <span>AP2 Digital Receipt & Tracking Metadata</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs text-slate-700 font-medium">
                        <div><span className="text-slate-400">Carrier:</span> Express Courier</div>
                        <div><span className="text-slate-400">Status:</span> {orderDetails.fulfillment.status}</div>
                        <div><span className="text-slate-400">Razorpay Payment ID:</span> <code className="text-indigo-700 font-mono font-bold">{orderDetails.order?.razorpayPaymentId || 'wallet_settled'}</code></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
