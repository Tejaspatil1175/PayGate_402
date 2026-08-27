import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Heart,
  Zap,
  Store,
  Check,
  Sparkles,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function ProductDiscovery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchQuery = searchParams.get('search') || searchParams.get('q') || '';
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [maxPrice, setMaxPrice] = useState('10000');
  const [sortOption, setSortOption] = useState('relevance');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

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
  }, [searchQuery, selectedCategory, sortOption]);

  const handleClearSearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    nextParams.delete('q');
    setSearchParams(nextParams);
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
        setActionMessage(
          `Agent matched! Initiating autonomous purchase protocol for "${product.title}".`
        );
        setTimeout(() => setActionMessage(''), 4000);
      }
    } catch (err) {
      setError(err.error || err.message || 'Agent purchase failed');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="space-y-5">
        {/* Active Search Query Pill (if searched from top header) */}
        {searchQuery && (
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-xl text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Search results for:</span>
              <span className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-100 shadow-2xs">
                "{searchQuery}"
              </span>
            </div>
            <button
              onClick={handleClearSearch}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filter</span>
            </button>
          </div>
        )}

        {/* Notifications */}
        {actionMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{actionMessage}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {/* Filter Bar */}
        <div className="relative flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Filter Popover Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setShowFiltersModal((prev) => !prev)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                showFiltersModal || maxPrice !== '10000' || sortOption !== 'relevance'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {(maxPrice !== '10000' || sortOption !== 'relevance') && (
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              )}
            </button>

            {/* Filter Card Popup */}
            {showFiltersModal && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl z-40 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Filter & Sort</span>
                  </div>
                  <button
                    onClick={() => setShowFiltersModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Max Price Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Max Budget</span>
                    <span className="font-bold text-indigo-600">₹{Number(maxPrice || 0).toLocaleString('en-IN')}</span>
                  </div>

                  <input
                    type="number"
                    min="100"
                    max="100000"
                    step="500"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white"
                  />

                  {/* Quick Price Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['1000', '2500', '5000', '10000', '20000'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMaxPrice(p)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition ${
                          maxPrice === p
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        ₹{Number(p).toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort Order Section */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-700 text-xs block">Sort By</span>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="relevance">Most Relevant</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMaxPrice('10000');
                      setSortOption('relevance');
                    }}
                    className="flex-1 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold rounded-lg transition"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFiltersModal(false);
                      fetchProducts();
                    }}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">
            Searching merchant catalog...
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-sm bg-white">
            No products found matching your search filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const isSaved = wishlistSaved[product._id];
              return (
                <div
                  key={product._id}
                  className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Product Image Banner */}
                    <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 group/img">
                      <img
                        src={
                          product.images && product.images.length > 0 && product.images[0]
                            ? product.images[0]
                            : '/image.png'
                        }
                        alt={product.title}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/image.png';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Category Badge overlay */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/90 backdrop-blur-md border border-slate-200 text-indigo-700 font-bold text-[10px] shadow-xs">
                          {product.category || 'General'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                        <Store className="w-3 h-3" />
                        <span>Merchant</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-indigo-600 transition">
                        {product.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {product.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Actions */}
                  <div className="pt-4 border-t border-slate-100 mt-4 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black text-slate-900">
                        ₹{product.price?.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        In Stock ({product.stock ?? 50})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddToWishlist(product)}
                        title={isSaved ? 'Saved to Wishlist' : 'Add to Wishlist'}
                        className={`p-2.5 rounded-xl border transition ${
                          isSaved
                            ? 'bg-rose-50 border-rose-200 text-rose-600'
                            : 'bg-slate-50 hover:bg-rose-50 border-slate-200 text-slate-500 hover:text-rose-600'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500' : ''}`} />
                      </button>

                      <button
                        onClick={() => handleInitiateAgentPurchase(product)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        <Zap className="w-3.5 h-3.5 fill-white" />
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
