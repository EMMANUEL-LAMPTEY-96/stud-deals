'use client';

// =============================================================================
// components/shared/LegalFooter.tsx
//
// Legal footer required by Hungarian Electronic Commerce Act
// (2001. évi CVIII. törvény, §4) and EU Consumer Rights Directive.
//
// Must appear on all public-facing pages. Contains:
//   - Company identity (name, cégszám, adószám, address)
//   - EU ODR platform link (required by EU Reg. 524/2013)
//   - NAIH supervisory authority reference
//   - Privacy policy + Terms links
//   - Copyright
//
// ⚠️  IMPORTANT: Replace the placeholder company details below with your
//     real registered Hungarian company information before going live.
// =============================================================================

import Link from 'next/link';
import { ExternalLink, Shield, Scale } from 'lucide-react';

export default function LegalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="w-full border-t border-gray-100 bg-gray-50 mt-16"
    >
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Top row — brand + tagline */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
          <div>
            <p className="font-black text-gray-900 text-base tracking-tight">Studeals</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
              Verified student discounts at local businesses near your campus.
              Hungary&apos;s student discount marketplace.
            </p>
          </div>

          {/* Navigation links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div>
              <p className="font-semibold text-gray-700 mb-1.5">Platform</p>
              <div className="flex flex-col gap-1">
                <Link href="/dashboard" className="text-gray-500 hover:text-gray-800 transition-colors">Browse deals</Link>
                <Link href="/explore" className="text-gray-500 hover:text-gray-800 transition-colors">Explore</Link>
                <Link href="/loyalty" className="text-gray-500 hover:text-gray-800 transition-colors">Loyalty cards</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1.5">Legal</p>
              <div className="flex flex-col gap-1">
                <Link href="/privacy" className="text-gray-500 hover:text-gray-800 transition-colors">Privacy policy</Link>
                <Link href="/privacy?lang=hu" className="text-gray-500 hover:text-gray-800 transition-colors">Adatvédelmi tájékoztató</Link>
                <Link href="/terms" className="text-gray-500 hover:text-gray-800 transition-colors">Terms of service</Link>
                <Link href="/terms?lang=hu" className="text-gray-500 hover:text-gray-800 transition-colors">Felhasználási feltételek</Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1.5">Support</p>
              <div className="flex flex-col gap-1">
                <a href="mailto:hello@studeals.app" className="text-gray-500 hover:text-gray-800 transition-colors">hello@studeals.app</a>
                <a href="mailto:privacy@studeals.app" className="text-gray-500 hover:text-gray-800 transition-colors">privacy@studeals.app</a>
              </div>
            </div>
          </div>
        </div>

        {/* Legal info block — required by 2001. évi CVIII. törvény §4 */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 text-xs text-gray-500 leading-relaxed space-y-1">
          <div className="flex items-start gap-2 flex-wrap">
            <Scale size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {/* ⚠️ Replace with your real registered company details */}
              <span><strong className="text-gray-700">Studeals Kft.</strong></span>
              <span>Cégszám: <strong className="text-gray-700">01-09-000000</strong></span>
              <span>Adószám: <strong className="text-gray-700">00000000-0-00</strong></span>
              <span>Székhely: <strong className="text-gray-700">1051 Budapest, Nádor utca 1.</strong></span>
            </div>
          </div>
          <p className="text-gray-400 pl-5 italic text-[11px]">
            ⚠ Replace the cégszám, adószám, and address above with your real registered company details before going live.
          </p>
        </div>

        {/* EU ODR + NAIH — required by EU Reg. 524/2013 */}
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors group"
          >
            <ExternalLink size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-800 group-hover:underline">
                EU Online Dispute Resolution
              </p>
              <p className="text-[11px] text-blue-600 mt-0.5">
                ec.europa.eu/consumers/odr — EU vitarendezési platform fogyasztói panaszokhoz
              </p>
            </div>
          </a>

          <a
            href="https://naih.hu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors group"
          >
            <Shield size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700 group-hover:underline">
                NAIH — Nemzeti Adatvédelmi Hatóság
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                naih.hu — adatvédelmi panasz benyújtásához forduljon a felügyeleti hatósághoz
              </p>
            </div>
          </a>
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-5 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">
            © {year} Studeals Kft. Minden jog fenntartva. All rights reserved.
          </p>
          <p className="text-[11px] text-gray-400">
            Adattárolás: Supabase EU (Írország) · GDPR 2016/679 · ePrivacy irányelv
          </p>
        </div>

      </div>
    </footer>
  );
}
