import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Heart,
  Zap,
  Store,
  SlidersHorizontal,
  Tag,
  Check,
  Sparkles,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function ProductDiscovery() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [maxPrice, setMaxPrice] = useState('10000');
  const [sortOption, setSortOption] = useState('relevance');

  const [wishlistSaved, setWishlistSaved] = useState({});
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');

  const categories = ['All', 'Electronics', 'Footwear', 'Fashion', 'Home', 'General'];

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (maxPrice) params.maxPrice = maxPrice;

      const res = await apiClient.get('/discovery/search', { params });
      if (res.data?.success) {
        let items = res.data.products || [];

        // Apply local sorting if needed
        if (sortOption === 'price-low') {
          items.sort((a, b) => a.price - b.price);
        } else if (sortOption === 'price-high') {
          items.sort((a, b) => b.price - a.price);
        }

        setProducts(items);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to fetch catalog products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, sortOption]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleAddToWishlist = async (product) => {
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      const res = await apiClient.post('/wishlist/add', {
        userId,
        productId: product._id,
        targetPrice: product.price,
      });

      if (res.data?.success) {
        setWishlistSaved((prev) => ({ ...prev, [product._id]: true }));
        setActionMessage(`Added "${product.title}" to your wishlist!`);
        setTimeout(() => setActionMessage(''), 3000);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to add to wishlist');
    }
  };

  const handleInitiateAgentPurchase = async (product) => {
    try {
      const storedUser = localStorage.getItem('paygate_user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user?._id || user?.id;

      setActionMessage(`Initiating AI agent negotiation for "${product.title}"...`);

      const res = await apiClient.post('/discovery/initiate-match', {
        query: product.title,
        category: product.category,
        maxPrice: product.price,
        userId,
      });

      if (res.data?.success) {
        setActionMessage(`Negotiated & Matched! Agreed Price: ₹${res.data.finalPrice}. Contract ${res.data.contract?.contractId} created.`);
      }
    } catch (err) {
      setError(err.error || err.message || 'Agent purchase negotiation failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Internal Product Catalog Discovery
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-400">
              Browse onboarded merchant products with text-score search & attribute-drop fallback
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products (e.g. 'running shoes')..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 pl-10 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition"
            >
              Search
            </button>
          </form>
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

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Price & Sort Filters */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Max Price:</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                onBlur={fetchProducts}
                className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Sort:</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs outline-none"
              >
                <option value="relevance">Relevance</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            Searching merchant catalog...
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            No products found matching your search filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const isSaved = wishlistSaved[product._id];
              return (
                <div
                  key={product._id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Category Badge & Merchant */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 font-medium">
                        {product.category || 'General'}
                      </span>
                      <span className="text-slate-500 flex items-center gap-1">
                        <Store className="w-3 h-3" />
                        {product.merchant?.businessName || 'Merchant'}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <h3 className="font-semibold text-slate-100 text-sm group-hover:text-indigo-300 transition">
                      {product.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {product.description || 'No product description available.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                    {/* Price & Stock */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-white">
                          ₹{(product.price || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          (product.stock || 0) > 0
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {(product.stock || 0) > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddToWishlist(product)}
                        className={`p-2.5 rounded-xl border transition ${
                          isSaved
                            ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                            : 'bg-slate-955 border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30'
                        }`}
                        title="Add to Wishlist"
                      >
                        <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-400' : ''}`} />
                      </button>

                      <button
                        onClick={() => handleInitiateAgentPurchase(product)}
                        disabled={(product.stock || 0) <= 0}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl py-2.5 flex items-center justify-center gap-1.5 transition shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
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
