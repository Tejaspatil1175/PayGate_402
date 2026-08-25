import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { ShieldCheck, Store, Bot, Settings, Activity } from 'lucide-react';

function PlaceholderPage({ title, module, description }) {
  return (
    <div className="card" style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <ShieldCheck size={28} color="#3b82f6" />
        <h2>{title}</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{description}</p>
      <div className="badge badge-success">Module: {module}</div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      {/* Top Navbar */}
      <header className="app-navbar">
        <div className="nav-brand">
          <ShieldCheck size={26} color="#2563eb" />
          <span>PayGate 402</span>
          <span className="brand-badge">AP2 / x402</span>
        </div>

        <nav className="nav-links">
          <NavLink to="/merchant/catalog" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Store size={18} /> Merchant Portal
          </NavLink>
          <NavLink to="/agent/intent" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Bot size={18} /> AI Agent Hub
          </NavLink>
          <NavLink to="/admin/overview" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Activity size={18} /> Admin Monitor
          </NavLink>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="app-container">
        <Routes>
          <Route path="/" element={<Navigate to="/merchant/catalog" replace />} />

          {/* Merchant Routes */}
          <Route path="/merchant/register" element={<PlaceholderPage title="Merchant Registration" module="Auth (1.1)" description="Email/Password Merchant Registration" />} />
          <Route path="/merchant/catalog" element={<PlaceholderPage title="Product Catalog Management" module="Catalog (1.2)" description="Add products and bulk upload CSV catalogs" />} />
          <Route path="/merchant/policy" element={<PlaceholderPage title="Policy Builder" module="Policy (1.4)" description="Configure spending caps and approval thresholds" />} />
          <Route path="/merchant/orders" element={<PlaceholderPage title="Live Orders Feed" module="Orders (1.6)" description="Real-time order monitoring and manual approvals" />} />
          <Route path="/merchant/copilot" element={<PlaceholderPage title="Merchant AI Co-Pilot" module="CoPilot (1.5)" description="AI pricing recommendations and margin insights" />} />

          {/* Agent Routes */}
          <Route path="/agent/intent" element={<PlaceholderPage title="Agent Purchasing Intent" module="Intent (2.1)" description="Submit intent with budget caps and nonces" />} />
          <Route path="/agent/matches" element={<PlaceholderPage title="Catalog Match Results" module="Matches (2.2)" description="View semantic catalog search scores" />} />
          <Route path="/agent/negotiation" element={<PlaceholderPage title="Dynamic Price Negotiation" module="Negotiation (2.3)" description="Automated agent-merchant counter-offers" />} />
          <Route path="/agent/contract" element={<PlaceholderPage title="AP2 Contract Review" module="Contract (2.4)" description="RSA-PSS digital contract verification" />} />
          <Route path="/agent/payment" element={<PlaceholderPage title="Gated Razorpay Payment" module="Payment (2.6)" description="Pass 6-layer security gate & create Razorpay order" />} />
          <Route path="/agent/status" element={<PlaceholderPage title="Order Status Tracking" module="Fulfillment (2.7)" description="Track post-payment fulfillment & delivery" />} />

          {/* Admin Routes */}
          <Route path="/admin/overview" element={<PlaceholderPage title="Platform Overview" module="Admin (6.1)" description="High-level revenue and transaction stats" />} />
          <Route path="/admin/monitoring" element={<PlaceholderPage title="Transaction Feed" module="Admin (6.2)" description="Live audit log stream and risk score alerts" />} />
          <Route path="/admin/merchant-health" element={<PlaceholderPage title="Merchant Health Scoring" module="Admin (6.3)" description="Risk scores and chargeback metrics" />} />
          <Route path="/admin/system-health" element={<PlaceholderPage title="System Health" module="Admin (6.4)" description="API uptime, Mongo status, and gateway telemetry" />} />
          <Route path="/admin/config" element={<PlaceholderPage title="Platform Configuration" module="Admin (6.5)" description="Feature flags and maintenance controls" />} />

          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/merchant/catalog" replace />} />
        </Routes>
      </main>
    </div>
  );
}
