'use client';

// =============================================================================
// lib/i18n/index.tsx — Lightweight i18n for Studeals
//
// English-first with Hungarian translation support.
// Locale is stored in the "studeals_locale" cookie and read on every page load.
// Usage:
//   const { t, locale, setLocale } = useI18n();
//   t('nav.signIn')  → "Sign in" | "Bejelentkezés"
//   t('common.save') → "Save"    | "Mentés"
// =============================================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

import enMessages from '@/messages/en.json';
import huMessages from '@/messages/hu.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Locale = 'en' | 'hu';

type Messages = typeof enMessages;
type NestedKey<T, P extends string = ''> = {
  [K in keyof T]: T[K] extends Record<string, string>
    ? `${P}${P extends '' ? '' : '.'}${string & K}.${string & keyof T[K]}`
    : never;
}[keyof T];

export type MessageKey = NestedKey<Messages>;

const ALL_MESSAGES: Record<Locale, Record<string, Record<string, string>>> = {
  en: enMessages as Record<string, Record<string, string>>,
  hu: huMessages as Record<string, Record<string, string>>,
};

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'studeals_locale';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  const val = match?.[1];
  return val === 'hu' ? 'hu' : 'en';
}

function writeLocaleCookie(locale: Locale) {
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a dot-separated key like "nav.signIn" */
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

// ---------------------------------------------------------------------------
// Provider — add to app/layout.tsx
// ---------------------------------------------------------------------------

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Hydrate from cookie after mount (avoids SSR mismatch)
  useEffect(() => {
    setLocaleState(readLocaleCookie());
  }, []);

  // Also update <html lang="..."> attribute dynamically
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    writeLocaleCookie(l);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const [namespace, ...rest] = key.split('.');
      const msgKey = rest.join('.');
      const ns = ALL_MESSAGES[locale]?.[namespace];
      if (ns && msgKey in ns) return ns[msgKey];
      // Fallback to English
      const nsEn = ALL_MESSAGES['en']?.[namespace];
      if (nsEn && msgKey in nsEn) return nsEn[msgKey];
      return fallback ?? key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useI18n() {
  return useContext(I18nContext);
}

/** Convenience hook — returns just the t() function */
export function useT() {
  return useContext(I18nContext).t;
}
