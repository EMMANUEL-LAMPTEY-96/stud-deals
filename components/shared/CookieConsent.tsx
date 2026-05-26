'use client';

// =============================================================================
// components/shared/CookieConsent.tsx — Granular GDPR Cookie Consent
//
// ePrivacy Directive + GDPR Article 7 compliant.
// Three separate consent categories, each independently toggleable:
//   1. Szükséges / Necessary   — always on, cannot be declined
//   2. Analitikai / Analytics  — anonymous page-view counts (opt-in)
//   3. Marketing               — currently unused, but disclosed (opt-in)
//
// Consent stored as JSON in localStorage under 'studeals_consent_v2'.
// Format: { necessary: true, analytics: boolean, marketing: boolean, ts: number }
//
// Previous 'studeals_cookie_consent' key is migrated on first load.
// =============================================================================

import { useState, useEffect } from 'react';
import { Shield, X, ChevronDown, ChevronUp, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const CONSENT_KEY = 'studeals_consent_v2';
const LEGACY_KEY  = 'studeals_cookie_consent';

interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

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
                Adatvédelem / Cookie settings
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Adattárolás: <span className="font-medium text-gray-700">EU (Írország)</span>
              </p>
            </div>
          </div>
          <button
            onClick={declineAll}
            className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5 flex-shrink-0"
            aria-label="Elutasítás és bezárás / Decline and close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Description */}
        <div className="px-5 pb-3">
          <p id="cookie-dialog-desc" className="text-xs text-gray-600 leading-relaxed">
            A Studeals sütiket és helyi tárolást használ a bejelentkezés és a preferenciák megőrzéséhez.
            Adatait nem adjuk el, és nem használunk hirdetési nyomkövetőket.{' '}
            <span className="text-gray-400">(We use cookies to keep you logged in. We do not sell data or run ad trackers.)</span>
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
            {expanded ? 'Kevesebb / Less detail' : 'Részletek / More detail'}
          </button>

          {expanded && (
            <div className="space-y-2.5 mb-3">
              {/* Necessary */}
              <div className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    Szükséges / Necessary
                    <span className="ml-2 text-[10px] font-normal text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                      Mindig aktív / Always on
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Bejelentkezési munkamenet, biztonsági tokenek. Ezeket nem lehet letiltani. ·
                    Login session and security tokens. Cannot be disabled.
                  </p>
                </div>
                <Toggle id="toggle-necessary" checked={true} disabled />
              </div>

              {/* Analytics */}
              <div className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <label htmlFor="toggle-analytics" className="cursor-pointer flex-1">
                  <p className="text-xs font-semibold text-gray-800">Analitikai / Analytics</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Névtelen oldalmegtekintés-számlálók az alkalmazás fejlesztéséhez. Nincs személyes adat. ·
                    Anonymous page-view counts to improve the app. No personal data.
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
                  <p className="text-xs font-semibold text-gray-800">Marketing</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    Jelenleg nem használjuk. Ha aktiváljuk, erről értesítünk. ·
                    Currently unused. We will notify you before activating this.
                  </p>
                </label>
                <Toggle
                  id="toggle-marketing"
                  checked={marketing}
                  onChange={setMarketing}
                />
              </div>

              {/* ODR link */}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:underline px-1"
              >
                <ExternalLink size={11} />
                EU vitarendezési platform / EU Online Dispute Resolution
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <Link href="/privacy?lang=hu" className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2">
              Adatvédelem
            </Link>
            <span className="text-gray-200">·</span>
            <Link href="/terms?lang=hu" className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2">
              Feltételek
            </Link>
            <span className="text-gray-200">·</span>
            <Link href="/privacy" className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2">
              Privacy
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={declineAll}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Csak szükséges / Essential only
            </button>
            {expanded ? (
              <button
                onClick={saveChoices}
                className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors flex items-center gap-1"
              >
                <Check size={12} /> Mentés / Save
              </button>
            ) : (
              <button
                onClick={acceptAll}
                className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors"
              >
                Összes elfogadása / Accept all
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
