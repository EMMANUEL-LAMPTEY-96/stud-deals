'use client';

// =============================================================================
// components/shared/CookieConsent.tsx — GDPR Cookie Consent Banner
//
// Shown once on first visit. Stores preference in localStorage under
// 'unideals_cookie_consent'. Options: 'accepted' | 'declined'.
//
// Legal basis: GDPR Article 7 (consent) + ePrivacy Directive.
// Data storage location: EU (Ireland, eu-west-1) — disclosed in banner.
// =============================================================================

import { useState, useEffect } from 'react';
import { Shield, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const CONSENT_KEY = 'unideals_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Only show if no prior decision stored
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      // Small delay so it doesn't flash during hydration
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none"
    >
      <div className="max-w-2xl mx-auto pointer-events-auto bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-gray-900/15 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield size={16} className="text-brand-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">We respect your privacy</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Your data is stored securely in the <span className="font-medium text-gray-700">EU (Ireland)</span>
              </p>
            </div>
          </div>
          <button
            onClick={decline}
            className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 flex-shrink-0"
            aria-label="Decline and close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-2">
          <p className="text-sm text-gray-600 leading-relaxed">
            Unideals uses essential cookies to keep you logged in and remember your preferences.
            We do <span className="font-medium text-gray-900">not</span> sell your data or run
            advertising trackers.{' '}
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-0.5 font-medium"
            >
              {expanded ? 'Less detail' : 'More detail'}
              <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          </p>

          {expanded && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-gray-600">
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="font-semibold text-gray-800 mb-1">✅ Essential cookies</p>
                <p>Login session, security tokens, language preference. Cannot be declined.</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="font-semibold text-gray-800 mb-1">📊 Analytics (optional)</p>
                <p>Anonymous page-view counts to help us improve the app. No personal data.</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="font-semibold text-gray-800 mb-1">🏛️ Data location</p>
                <p>All data stored on Supabase servers in <strong>Ireland (EU)</strong> under GDPR.</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="font-semibold text-gray-800 mb-1">🗑️ Your rights</p>
                <p>Access, delete, or export your data anytime from Account Settings.</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <Link
            href="/privacy"
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Privacy policy
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={decline}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Decline optional
            </button>
            <button
              onClick={accept}
              className="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
