// =============================================================================
// lib/currency.ts — Currency formatting utilities for Hungary launch
//
// Primary currency: Hungarian Forint (HUF / Ft)
// Secondary display: Euro (EUR) — approximate live conversion
//
// Usage:
//   fmtHUF(5000)          → "5 000 Ft"
//   fmtHUF(5000, true)    → "5 000 Ft"  (short form, same)
//   fmtEUR(5000)          → "≈ €14"
//   hufToEur(5000)        → 13.7  (raw float)
// =============================================================================

/** Approximate HUF → EUR rate. Update periodically. */
export const HUF_PER_EUR = 365;

/** Format a HUF amount with Hungarian number formatting (space as thousands sep). */
export function fmtHUF(amount: number, compact = false): string {
  if (compact && amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} M Ft`;
  }
  if (compact && amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)} e Ft`;
  }
  // Hungarian style: "5 000 Ft" (non-breaking space as thousands separator)
  return (
    new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      maximumFractionDigits: 0,
    })
      .format(amount)
      // Intl outputs "5 000 HUF" — normalise to "5 000 Ft"
      .replace(/\s*HUF\s*/g, ' Ft')
      .trim()
  );
}

/** Convert HUF to EUR (raw float). */
export function hufToEur(huf: number): number {
  return huf / HUF_PER_EUR;
}

/** Format a HUF amount as an approximate EUR equivalent. */
export function fmtEUR(huf: number): string {
  const eur = hufToEur(huf);
  return `≈ €${eur < 1 ? eur.toFixed(2) : eur < 10 ? eur.toFixed(1) : Math.round(eur)}`;
}

/** Format a number with hu-HU locale date. */
export function fmtDate(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('hu-HU', opts ?? {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** Format a datetime with hu-HU locale. */
export function fmtDateTime(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('hu-HU', opts ?? {
    dateStyle: 'medium', timeStyle: 'short',
  });
}
