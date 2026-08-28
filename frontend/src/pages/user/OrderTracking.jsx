import React, { useState, useEffect } from 'react';
import {
  Package, Truck, CheckCircle2, Clock, Receipt, ChevronRight, Store, Calendar, Sparkles, MapPin, Box
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
    <div className="relative min-h-[calc(100vh-4rem)] p-6 md:p-10 space-y-8 max-w-7xl mx-auto w-full font-sans overflow-hidden">
      {/* Header */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-900/10">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              Order Tracking
              <Sparkles className="w-6 h-6 text-slate-400" />
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Live AP2 settlement and delivery fulfillment tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold bg-white/60 backdrop-blur-xl border border-white/50 px-4 py-2 rounded-2xl shadow-sm text-slate-700 self-start md:self-auto">
          <Box className="w-4 h-4 text-indigo-600" />
          <span>{orders.length} Total Orders</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-sm font-semibold backdrop-blur-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4 relative z-10">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-slate-500 font-medium">Syncing orders securely...</div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-32 bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl text-slate-500 text-sm shadow-xl shadow-slate-200/50 relative z-10">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="font-bold text-lg text-slate-700">No orders found</p>
          <p>Your purchase history is currently empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          
          {/* Orders List Sidebar (Glassmorphism) */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 pl-2">
              Purchase History
            </h2>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 no-scrollbar pb-10">
              {orders.map((ord) => {
                const isSelected = selectedOrder === ord._id || selectedOrder === ord.orderId;
                const isFulfilled = ord.status === 'fulfilled' || ord.status === 'DELIVERED';

                return (
                  <div
                    key={ord._id}
                    onClick={() => fetchOrderDetails(ord._id || ord.orderId)}
                    className={`group relative p-5 rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden border ${
                      isSelected
                        ? 'bg-slate-900 shadow-2xl shadow-slate-900/20 scale-[1.02] -translate-y-1 border-slate-900'
                        : 'bg-white border-slate-200 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1'
                    }`}
                  >
                    {/* Active State Glow */}
                    {isSelected && (
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
                    )}

                    <div className="relative flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`font-mono text-xs font-black tracking-tight ${isSelected ? 'text-slate-100' : 'text-slate-600'}`}>
                          #{ord.orderId || ord._id?.slice(-8)}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm ${
                            isSelected
                              ? 'bg-white/10 text-white border border-white/20'
                              : isFulfilled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1.5 font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                          <Store className={`w-4 h-4 shrink-0 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`} />
                          <span className="truncate max-w-[120px]">{ord.merchant?.businessName || 'Merchant'}</span>
                        </span>
                        <span className={`font-black text-lg ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          ₹{(ord.amount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className={`text-[11px] flex items-center justify-between pt-3 border-t font-medium ${isSelected ? 'border-white/10 text-slate-300' : 'border-slate-100 text-slate-400'}`}>
                        <span className="flex items-center gap-1.5">
                          <Calendar className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`} />
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-white translate-x-1' : 'text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1'}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Order Details (Glassmorphism & Rich Layout) */}
          <div className="lg:col-span-8 space-y-6">
            {detailsLoading ? (
              <div className="flex flex-col items-center justify-center py-32 bg-white border border-slate-200 rounded-3xl shadow-sm">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4"></div>
                <div className="text-slate-500 font-bold">Decrypting order metadata...</div>
              </div>
            ) : !orderDetails ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-16 opacity-5">
                   <Package className="w-48 h-48" />
                </div>
                <Package className="w-12 h-12 text-slate-300 mb-4 relative z-10" />
                <div className="text-slate-800 text-lg font-black relative z-10">Select an order</div>
                <div className="text-slate-500 text-sm font-medium mt-1 max-w-sm text-center relative z-10">
                   Click on any order from your purchase history to view its live tracking, delivery timeline, and verified AP2 metadata.
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Order Overview High-End Card */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Receipt className="w-32 h-32" />
                  </div>
                  
                  <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-6 mb-6">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                        <CheckCircle2 className="w-4 h-4" /> Validated Contract
                      </div>
                      <div className="text-[11px] font-semibold text-slate-400 mb-1">AP2 Mandate Hash</div>
                      <code className="text-sm text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg font-mono font-bold border border-slate-200 inline-block">
                        {orderDetails.order?.mandateHash || orderDetails.fulfillment?.mandateHash || '0xAB...CDF'}
                      </code>
                    </div>
                    <div className="md:text-right">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Settled Amount</div>
                      <div className="text-4xl font-black text-slate-900">
                        ₹{(orderDetails.order?.amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="relative space-y-4">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Purchased Items
                    </div>
                    <div className="space-y-3">
                      {(orderDetails.order?.items || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all duration-300">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                            <div>
                              <span className="block text-slate-800 font-bold text-sm">{item.title}</span>
                              <span className="text-xs font-medium text-slate-500">Qty: {item.quantity}</span>
                            </div>
                          </div>
                          <span className="text-slate-900 font-black text-lg shrink-0">₹{(item.price || 0).toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Delivery Timeline / Tracking */}
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                        <Truck className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">Live Delivery Tracking</h3>
                    </div>
                    <div className="px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" /> Destination Verified
                    </div>
                  </div>

                  <div className="relative pl-8 space-y-8 before:absolute before:left-[1.375rem] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {(orderDetails.timeline || []).map((step, idx) => {
                       const isLastCompleted = step.completed && (idx === orderDetails.timeline.length - 1 || !orderDetails.timeline[idx+1]?.completed);
                       return (
                        <div key={idx} className="relative flex items-start gap-6 group">
                          {/* Timeline Dot */}
                          <div
                            className={`absolute -left-[2.1rem] top-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs border-[3px] border-white transition-colors duration-300 z-10 ${
                              step.completed
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            {isLastCompleted && (
                               <span className="absolute w-full h-full rounded-full border-2 border-emerald-500 animate-ping opacity-50"></span>
                            )}
                            {step.completed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-3.5 h-3.5" />}
                          </div>

                          {/* Content */}
                          <div className={`flex-1 p-4 rounded-2xl border transition-all duration-300 ${step.completed ? 'bg-white border-slate-100 shadow-sm group-hover:shadow-md' : 'bg-transparent border-transparent opacity-60'}`}>
                            <div className={`text-sm font-black ${step.completed ? 'text-slate-900' : 'text-slate-400'}`}>
                              {step.step}
                            </div>
                            <div className="text-xs font-medium mt-1 text-slate-500">
                              {step.completed
                                ? step.timestamp
                                  ? new Date(step.timestamp).toLocaleString('en-IN', { weekday: 'long', hour: 'numeric', minute: 'numeric' })
                                  : 'Completed'
                                : 'Pending'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tracking Metadata */}
                {orderDetails.fulfillment && (
                  <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden border border-slate-800">
                    <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="flex-1 space-y-4 w-full">
                        <div className="flex items-center gap-3 text-slate-300 mb-6">
                          <Receipt className="w-5 h-5" />
                          <span className="text-xs font-black uppercase tracking-widest">Metadata Hash Record</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Carrier Info</div>
                            <div className="text-sm font-bold">Express Courier</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Status Protocol</div>
                            <div className="text-sm font-bold text-emerald-400">{orderDetails.fulfillment.status}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Settlement Ledger ID</div>
                            <code className="text-xs font-mono font-bold bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 inline-block text-slate-300">
                              {orderDetails.order?.razorpayPaymentId || 'ap2_wallet_settlement'}
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
