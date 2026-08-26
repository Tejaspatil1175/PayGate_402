import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowRight, Lock } from 'lucide-react';

/**
 * ProtectedRoute Guard
 * Verifies JWT token existence in localStorage and checks role permissions.
 * Redirects unauthenticated requests directly to /login.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem('paygate_token');
  const role = localStorage.getItem('paygate_role');

  // 1. If not authenticated with JWT token, redirect to /login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. If role is specified and does not match, block access with Access Denied screen
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-rose-500/40 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied (403)</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your authenticated role is <strong className="text-indigo-400 uppercase font-mono">{role || 'unassigned'}</strong>. You do not have permission to access this route.
          </p>
          <div className="pt-2">
            <a
              href={role === 'merchant' ? '/merchant/catalog' : role === 'admin' ? '/admin/overview' : '/discovery'}
              className="inline-flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl py-3 transition shadow-lg shadow-indigo-600/25"
            >
              <span>Return to Authorized Portal</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
