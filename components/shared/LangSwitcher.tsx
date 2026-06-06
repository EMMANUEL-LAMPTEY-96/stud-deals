'use client';

// =============================================================================
// components/shared/LangSwitcher.tsx
//
// Compact EN / HU toggle. Persists choice in the "studeals_locale" cookie.
// Appears in the Navbar (desktop + mobile).
// =============================================================================

import { useI18n, type Locale } from '@/lib/i18n';

const FLAG: Record<Locale, string> = { en: '🇬🇧', hu: '🇭🇺' };
const LABEL: Record<Locale, string> = { en: 'EN', hu: 'HU' };
const OTHER: Record<Locale, Locale> = { en: 'hu', hu: 'en' };

interface Props {
  /** 'pill' = rounded button (desktop), 'text' = flat text link (mobile menu) */
  variant?: 'pill' | 'text';
}

export default function LangSwitcher({ variant = 'pill' }: Props) {
  const { locale, setLocale } = useI18n();
  const next = OTHER[locale];

  const handleToggle = () => setLocale(next);

  if (variant === 'text') {
    return (
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors py-2"
        aria-label={`Switch to ${next === 'en' ? 'English' : 'Hungarian'}`}
      >
        <span>{FLAG[next]}</span>
        <span>{next === 'en' ? 'English' : 'Magyar'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors select-none"
      aria-label={`Switch to ${next === 'en' ? 'English' : 'Hungarian'}`}
      title={next === 'en' ? 'Switch to English' : 'Váltás magyarra'}
    >
      <span className="text-sm leading-none">{FLAG[locale]}</span>
      <span>{LABEL[locale]}</span>
    </button>
  );
}
