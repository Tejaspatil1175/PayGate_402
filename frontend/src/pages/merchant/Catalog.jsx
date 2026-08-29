import React, { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  UploadCloud,
  Edit,
  Trash2,
  Tag,
  Check,
  Sparkles,
  Package,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function MerchantCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Form states for single product
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [price, setPrice] = useState('2000');
  const [stock, setStock] = useState('50');
  const [tags, setTags] = useState('running, shoes, footwear');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Bulk upload state
  const [csvFile, setCsvFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const res = await apiClient.get('/catalog', {
        params: { merchantId, merchant: merchantId },
        headers: merchantId ? { 'x-merchant-id': merchantId } : {},
      });

      if (res.data?.success) {
        setProducts(res.data.products || []);
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to load product catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage('');
    setError('');

    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const formData = new FormData();
      if (merchantId) formData.append('merchantId', merchantId);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('price', Number(price));
      formData.append('stock', Number(stock));

      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      tagList.forEach((tag) => formData.append('tags', tag));

      if (imageFile) {
        formData.append('images', imageFile);
      }

      const res = await apiClient.post('/catalog', formData);

      if (res.data?.success) {
        setMessage(`Product "${title}" created and image uploaded successfully!`);
        setShowAddModal(false);
        setTitle('');
        setDescription('');
        setImageFile(null);
        setImagePreview(null);
        fetchCatalog();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.error || err.message || 'Failed to add product');
    } finally {
      setFormLoading(false);
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;

    setBulkLoading(true);
    setMessage('');
    setError('');

    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const formData = new FormData();
      formData.append('file', csvFile);
      if (merchantId) formData.append('merchantId', merchantId);

      const res = await apiClient.post('/catalog/bulk-upload', formData);

      if (res.data?.success) {
        setMessage(`Bulk catalog uploaded! Processed ${res.data.count || 0} products.`);
        setShowBulkModal(false);
        setCsvFile(null);
        fetchCatalog();
      }
    } catch (err) {
      setError(err.error || err.message || 'Bulk upload failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteProduct = async (id, titleStr) => {
    if (!window.confirm(`Are you sure you want to delete "${titleStr}"?`)) return;

    try {
      const res = await apiClient.delete(`/catalog/${id}`);
      if (res.data?.success) {
        setMessage(`Deleted product "${titleStr}".`);
        fetchCatalog();
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to delete product');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Merchant Catalog Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage inventory, single product CRUD, and bulk CSV uploads
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-indigo-500" />
            <span>Bulk CSV / Excel Import</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Product</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add New Product to Catalog</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4 text-sm font-medium">
              <div>
                <label className="block text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Wireless Noise Cancelling Headphones"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="High fidelity audio with active noise cancellation..."
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Fashion">Fashion</option>
                    <option value="Home">Home</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1">Stock Count</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Product Image</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-sm text-slate-600 outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer transition"
                  />
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="audio, wireless, bluetooth"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2 text-slate-900 outline-none transition"
                />
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
                  {formLoading ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Bulk Import Catalog (CSV or Excel)</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkUpload} className="space-y-4 text-sm font-medium">
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-8 text-center space-y-3 cursor-pointer bg-slate-50 transition">
                <UploadCloud className="w-10 h-10 text-indigo-500 mx-auto" />
                <div className="text-slate-700 font-semibold">
                  {csvFile ? csvFile.name : 'Select CSV or Excel (.xlsx, .xls) file'}
                </div>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  required
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full text-slate-500 text-xs cursor-pointer mt-2"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkLoading || !csvFile}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {bulkLoading ? 'Importing Products...' : 'Start Bulk Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Inventory Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Package className="w-5 h-5 text-indigo-500" />
          <span>Catalog Inventory ({products.length})</span>
        </div>

        <button
          onClick={fetchCatalog}
          disabled={loading}
          className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition px-3 py-1.5 rounded-lg hover:bg-indigo-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm font-medium">
          Loading inventory products...
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-sm font-medium bg-white shadow-sm">
          No products found in catalog. Add single products or upload a CSV file above.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <div
              key={p._id}
              className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-4 shadow-2xs transition-colors flex flex-col justify-between group relative h-full [content-visibility:auto] [contain-intrinsic-size:320px] transform-gpu"
            >
              <div className="space-y-3">
                {/* Product Image Banner */}
                <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
                  <img
                    src={
                      p.images && p.images.length > 0 && p.images[0]
                        ? p.images[0]
                        : '/image.png'
                    }
                    alt={p.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/image.png';
                    }}
                    className="w-full h-full object-cover"
                  />
                  {/* Category Badge overlay (solid bg, no blur thrashing) */}
                  <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                    <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-indigo-700 font-bold text-[10px] shadow-2xs">
                      {p.category || 'General'}
                    </span>
                  </div>
                  {/* Delete Overlay */}
                  <div className="absolute top-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProduct(p._id, p.title);
                      }}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition shadow-2xs"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="min-h-[52px]">
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {p.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="pt-3 border-t border-slate-100 mt-3 flex items-baseline justify-between">
                <span className="text-base font-black text-slate-900">
                  ₹{(p.price || 0).toLocaleString('en-IN')}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${(p.stock || 0) > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                >
                  {(p.stock || 0) > 0 ? `In Stock (${p.stock})` : 'Out of Stock'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
