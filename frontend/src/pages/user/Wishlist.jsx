import React, { useState, useEffect } from 'react';
import {
  Heart,
  Trash2,
  Zap,
  TrendingDown,
  Store,
  Sparkles,
  Check,
  Tag,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function Wishlist() {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [priceDrops, setPriceDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');

  const fetchWishlistData = async () => {
    setLoading(true);
    setError('');
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const [wishRes, dropRes] = await Promise.all([
        apiClient.get('/wishlist', { params: { userId } }),
        apiClient.get('/wishlist/price-drops', { params: { userId } }),
      ]);

      if (wishRes.data?.success) {
        setWishlistItems(wishRes.data.wishlist || []);
      }
      if (dropRes.data?.success) {
        setPriceDrops(dropRes.data.priceDropAlerts || []);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load wishlist items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlistData();
  }, []);

  const handleRemove = async (productId, productTitle) => {
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.delete(`/wishlist/remove/${productId}`, {
        data: { userId },
      });

      if (res.data?.success) {
        setWishlistItems((prev) => prev.filter((item) => item.product?._id !== productId));
        setActionMessage(`Removed "${productTitle || 'Item'}" from wishlist.`);
        setTimeout(() => setActionMessage(''), 3000);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to remove item');
    }
  };

  const handleBuyNow = async (product) => {
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      setActionMessage(`Initiating AI agent purchase for "${product.title}"...`);

      const res = await apiClient.post('/discovery/initiate-match', {
        query: product.title,
        category: product.category,
        maxPrice: product.price,
        userId,
      });

      if (res.data?.success) {
        setActionMessage(`Purchased via AI Agent! Agreed Price: ₹${res.data.finalPrice}. Contract: ${res.data.contract?.contractId}`);
      }
    } catch (err) {
      setError(err.error || err.message || 'Agent purchase failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-600/10 border border-rose-500/30 text-rose-400">
              <Heart className="w-6 h-6 fill-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                My Saved Wishlist
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Bookmarked merchant products with automated price-drop alerts
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl self-start md:self-auto">
            {wishlistItems.length} Saved Items ({priceDrops.length} Price Drops)
          </span>
        </div>

        {/* Notifications */}
        {actionMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionMessage}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Active Price Drop Alerts Banner */}
        {priceDrops.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <TrendingDown className="w-4 h-4" />
              <span>Active Price Drop Alerts ({priceDrops.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {priceDrops.map((drop, idx) => (
                <div key={idx} className="bg-slate-950/80 p-3 rounded-xl border border-amber-500/20 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 block">{drop.product?.title}</span>
                    <span className="text-slate-500">
                      Target: ₹{drop.targetPrice} | Current: ₹{drop.currentPrice}
                    </span>
                  </div>
                  <span className="text-emerald-400 font-bold text-xs bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                    Save ₹{drop.priceDropAmount}!
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wishlist Items Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            Loading your wishlist items...
          </div>
        ) : wishlistItems.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            Your wishlist is empty. Save products from the catalog to track price drops!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {wishlistItems.map((item) => {
              const product = item.product || {};
              const isPriceDropped = item.isPriceDrop;

              return (
                <div
                  key={item._id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-rose-500/40 rounded-2xl p-4 shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Product Image Banner */}
                    <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-950/60 border border-slate-800/80 group/img">
                      <img
                        src={
                          product.images && product.images.length > 0 && product.images[0]
                            ? product.images[0]
                            : '/image.png'
                        }
                        alt={product.title || 'Product'}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/image.png';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-slate-300 font-semibold text-[10px] shadow-md">
                          {product.category || 'General'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Store className="w-3 h-3 text-rose-400" />
                        {product.merchant?.businessName || 'Merchant'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-slate-100 text-sm line-clamp-1">
                      {product.title || 'Saved Product'}
                    </h3>

                    {isPriceDropped && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>Price Dropped by ₹{item.priceDropAmount}!</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Target Price</span>
                        <span className="font-semibold text-slate-300">₹{item.targetPrice}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[11px]">Catalog Price</span>
                        <span className="text-lg font-bold text-white">₹{product.price || item.targetPrice}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemove(product._id, product.title)}
                        className="p-2.5 rounded-xl bg-slate-955 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition"
                        title="Remove from Wishlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleBuyNow(product)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl py-2.5 flex items-center justify-center gap-1.5 transition shadow-md shadow-indigo-600/20"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Buy via AI Agent</span>
                      </button>
                    </div>
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
