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
        params: { merchantId },
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

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setMessage('');
    setError('');

    try {
      const storedMerchant = localStorage.getItem('paygate_merchant');
      const merchant = storedMerchant ? JSON.parse(storedMerchant) : null;
      const merchantId = merchant?._id || merchant?.id;

      const res = await apiClient.post('/catalog', {
        merchantId,
        title,
        description,
        category,
        price: Number(price),
        stock: Number(stock),
        tags: tags.split(',').map((t) => t.trim()),
      });

      if (res.data?.success) {
        setMessage(`Product "${title}" added to catalog successfully!`);
        setShowAddModal(false);
        setTitle('');
        setDescription('');
        fetchCatalog();
      }
    } catch (err) {
      setError(err.error || err.message || 'Failed to add product');
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

      const res = await apiClient.post('/catalog/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Merchant Catalog Management
                <Sparkles className="w-5 h-5 text-amber-400" />
              </h1>
              <p className="text-sm text-slate-400">
                Manage inventory, single product CRUD, and bulk CSV uploads for AP2 discovery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              <span>Bulk CSV Upload</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Single Product</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Add Product Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base">Add New Product to Catalog</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Wireless Noise Cancelling Headphones"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="High fidelity audio with active noise cancellation..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                    >
                      <option value="Electronics">Electronics</option>
                      <option value="Footwear">Footwear</option>
                      <option value="Fashion">Fashion</option>
                      <option value="Home">Home</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Stock Count</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="audio, wireless, bluetooth"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
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
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base">Bulk Upload Catalog CSV</h3>
                <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBulkUpload} className="space-y-4 text-xs">
                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center space-y-2 cursor-pointer bg-slate-955">
                  <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto" />
                  <div className="text-slate-300 font-medium">
                    {csvFile ? csvFile.name : 'Select CSV catalog file'}
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    required
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    className="w-full text-slate-400 text-xs cursor-pointer"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bulkLoading || !csvFile}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {bulkLoading ? 'Uploading CSV...' : 'Start Bulk Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Product Inventory Table */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>Catalog Inventory ({products.length})</span>
            </div>

            <button
              onClick={fetchCatalog}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              Loading inventory products...
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl text-slate-500 text-sm">
              No products found in catalog. Add single products or upload a CSV file above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 px-3">Product Title</th>
                    <th className="pb-3 px-3">Category</th>
                    <th className="pb-3 px-3">Price</th>
                    <th className="pb-3 px-3">Stock</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-950/40 transition">
                      <td className="py-3 px-3 font-semibold text-slate-200">{p.title}</td>
                      <td className="py-3 px-3 text-slate-400">{p.category || 'General'}</td>
                      <td className="py-3 px-3 font-bold text-white">₹{(p.price || 0).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-slate-300">{p.stock || 0}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                            (p.stock || 0) > 0
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {(p.stock || 0) > 0 ? 'Available' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => handleDeleteProduct(p._id, p.title)}
                          className="p-1.5 rounded-lg bg-slate-955 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition"
                          title="Delete Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
