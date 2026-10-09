// =============================================================================
// lib/analytics/consent.ts — read the cookie-banner choice (GDPR)
//
// The banner (components/shared/CookieConsent.tsx) stores its choice in
// localStorage and fires CONSENT_EVENT on window whenever it is saved, so
// analytics can start the moment the user accepts — without a reload.
// =============================================================================

export const CONSENT_KEY = 'studeals_consent_v2';
export const LEGACY_CONSENT_KEY = 'studeals_cookie_consent';
export const CONSENT_EVENT = 'studeals:consent-changed';

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

/** True only if the user has opted in to analytics in the cookie banner. */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as Partial<ConsentState>).analytics === true;
  } catch {
    return false;
  }
}
