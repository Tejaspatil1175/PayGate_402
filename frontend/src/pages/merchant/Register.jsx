import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, Mail, Lock, Phone, Building, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import apiClient from '../../api/client';

export default function MerchantRegister() {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [businessCategory, setBusinessCategory] = useState('Electronics');
  const [panNumber, setPanNumber] = useState('');
  const [gstin, setGstin] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('businessName', businessName);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('phone', phone);
      formData.append('businessCategory', businessCategory);
      formData.append('panNumber', panNumber);
      formData.append('gstin', gstin);

      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const response = await apiClient.post('/merchant/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data?.success) {
        const { token, merchant } = response.data;
        if (token) localStorage.setItem('paygate_token', token);
        if (merchant) localStorage.setItem('paygate_merchant', JSON.stringify(merchant));
        localStorage.setItem('paygate_role', 'merchant');

        navigate('/merchant/catalog');
      }
    } catch (err) {
      setError(err.error || err.message || 'Merchant registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#1A1612] flex items-center justify-center p-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white border border-[#E7E2D6] rounded-2xl p-8 shadow-xl shadow-slate-200/60 z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 mb-3 shadow-sm">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#120F0B]">
            Merchant Onboarding
          </h1>
          <p className="text-sm text-[#57534E] mt-1">
            Register your store on PayGate 402 for AP2 AI agentic settlement
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
                Business Name
              </label>
              <div className="relative">
                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Apex Electronics Ltd"
                  className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-2.5 pl-10 text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
                Business Category
              </label>
              <select
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-2.5 text-sm text-[#120F0B] outline-none transition shadow-sm"
              >
                <option value="Electronics">Electronics</option>
                <option value="Footwear">Footwear</option>
                <option value="Fashion">Fashion</option>
                <option value="Home">Home & Kitchen</option>
                <option value="General">General Retail</option>
              </select>
            </div>
          </div>

          {/* Store Logo Upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
              Store Logo / Brand Image (Optional)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-[#57534E] outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer shadow-sm"
              />
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Store Logo Preview"
                  className="w-10 h-10 object-cover rounded-xl border border-indigo-200 shadow-sm flex-shrink-0"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
                Merchant Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@store.com"
                  className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-2.5 pl-10 text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-2.5 pl-10 text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-2.5 pl-10 text-sm text-[#120F0B] placeholder-[#A8A29E] outline-none transition shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
                PAN Number
              </label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  required
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-2.5 pl-10 text-sm text-[#120F0B] uppercase placeholder-[#A8A29E] outline-none transition shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">
                GSTIN
              </label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]" />
                <input
                  type="text"
                  required
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="27ABCDE1234F1Z5"
                  className="w-full bg-white border border-[#E7E2D6] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-4 py-2.5 pl-10 text-sm text-[#120F0B] uppercase placeholder-[#A8A29E] outline-none transition shadow-sm"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <span>Registering Merchant...</span>
            ) : (
              <>
                <span>Register Store & Open Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-[#57534E]">
          Already registered as a merchant?{' '}
          <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold transition">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
