'use client';

// =============================================================================
// components/shared/CookieConsent.tsx — Granular GDPR Cookie Consent
//
// ePrivacy Directive + GDPR Article 7 compliant.
// Three separate consent categories, each independently toggleable:
//   1. Szükséges / Necessary   — always on, cannot be declined
//   2. Analitikai / Analytics  — PostHog product analytics, pseudonymous (opt-in)
//   3. Marketing               — currently unused, but disclosed (opt-in)
//
// Consent stored as JSON in localStorage under 'studeals_consent_v2'.
// Format: { necessary: true, analytics: boolean, marketing: boolean, ts: number }
//
// Previous 'studeals_cookie_consent' key is migrated on first load.
//
// Saving fires CONSENT_EVENT on window; components/shared/AnalyticsProvider.tsx
// listens for it and starts PostHog only when analytics is accepted.
//
// Copy follows the current UI language (messages/*.json → "cookies"):
// English by default, Hungarian when the language switcher is set to HU.
// =============================================================================

import { useState, useEffect } from 'react';
import { Shield, X, ChevronDown, ChevronUp, Check } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  CONSENT_EVENT, CONSENT_KEY, LEGACY_CONSENT_KEY as LEGACY_KEY, type ConsentState,
} from '@/lib/analytics/consent';

function loadConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) return JSON.parse(raw) as ConsentState;

    // Migrate legacy key
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'accepted') {
      return { necessary: true, analytics: true, marketing: false, ts: Date.now() };
    }
    if (legacy === 'declined') {
      return { necessary: true, analytics: false, marketing: false, ts: Date.now() };
    }
  } catch { /* ignore parse errors */ }
  return null;
}

function saveConsent(state: Omit<ConsentState, 'ts'>) {
  const full: ConsentState = { ...state, ts: Date.now() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(full));
  // Remove legacy key
  localStorage.removeItem(LEGACY_KEY);
  window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: full }));
}

// Toggle switch
function Toggle({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-brand-600' : 'bg-gray-200'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function CookieConsent() {
  const { t, locale } = useI18n();
  const legalSuffix = locale === 'hu' ? '?lang=hu' : '';
  const [visible, setVisible]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = loadConsent();
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  function acceptAll() {
    saveConsent({ necessary: true, analytics: true, marketing: false });
    setVisible(false);
  }

  function saveChoices() {
    saveConsent({ necessary: true, analytics, marketing });
    setVisible(false);
  }

  function declineAll() {
    saveConsent({ necessary: true, analytics: false, marketing: false });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-dialog-title"
      aria-describedby="cookie-dialog-desc"
      className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-5 pointer-events-none"
    >
      <div className="max-w-xl mx-auto pointer-events-auto bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-gray-900/15 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield size={15} className="text-brand-600" />
            </div>
            <div>
              <h2 id="cookie-dialog-title" className="text-sm font-bold text-gray-900">
                {t('cookies.title')}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('cookies.storage')} <span className="font-medium text-gray-700">{t('cookies.storageRegion')}</span>
              </p>
            </div>
          </div>
          <button
            onClick={declineAll}
            className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 flex-shrink-0"
            aria-label={t('cookies.decline')}
          >
            <X size={17} />
          </button>
        </div>

        {/* Description */}
        <div className="px-5 pb-3">
          <p id="cookie-dialog-desc" className="text-xs text-gray-600 leading-relaxed">
            {t('cookies.desc')}
          </p>
        </div>

        {/* Expandable categories */}
        <div className="px-5 pb-2">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 mb-2"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? t('cookies.less') : t('cookies.more')}
          </button>

          {expanded && (
            <div className="space-y-2.5 mb-3">
              {/* Necessary */}
              <div className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    {t('cookies.necessary')}
                    <span className="ml-2 text-[10px] font-normal text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                      {t('cookies.alwaysOn')}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    {t('cookies.necessaryDesc')}
                  </p>
                </div>
                <Toggle id="toggle-necessary" checked={true} disabled />
              </div>

              {/* Analytics */}
              <div className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <label htmlFor="toggle-analytics" className="cursor-pointer flex-1">
                  <p className="text-xs font-semibold text-gray-800">{t('cookies.analytics')}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    {t('cookies.analyticsDesc')}
                  </p>
                </label>
                <Toggle
                  id="toggle-analytics"
                  checked={analytics}
                  onChange={setAnalytics}
                />
              </div>

              {/* Marketing */}
              <div className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <label htmlFor="toggle-marketing" className="cursor-pointer flex-1">
                  <p className="text-xs font-semibold text-gray-800">{t('cookies.marketing')}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    {t('cookies.marketingDesc')}
                  </p>
                </label>
                <Toggle
                  id="toggle-marketing"
                  checked={marketing}
                  onChange={setMarketing}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <Link href={`/privacy${legalSuffix}`} className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2">
              {t('cookies.privacy')}
            </Link>
            <span className="text-gray-200">·</span>
            <Link href={`/terms${legalSuffix}`} className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2">
              {t('cookies.terms')}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={declineAll}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              {t('cookies.essentialOnly')}
            </button>
            {expanded ? (
              <button
                onClick={saveChoices}
                className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors flex items-center gap-1"
              >
                <Check size={12} /> {t('cookies.save')}
              </button>
            ) : (
              <button
                onClick={acceptAll}
                className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
              >
                {t('cookies.acceptAll')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
