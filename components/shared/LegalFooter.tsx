'use client';

// =============================================================================
// components/shared/LegalFooter.tsx
//
// Site footer for public-facing pages. Contains:
//   - Brand + platform / legal / support links
//   - Portfolio-project notice (StudDeals is not a registered company and
//     processes no real payments, so no company register details or EU ODR
//     link apply)
//   - Copyright + data-storage note
// =============================================================================

import Link from 'next/link';
import { Info } from 'lucide-react';

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
            <p className="font-black text-gray-900 text-base tracking-tight">StudDeals</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
              Verified student discounts at local businesses near your campus.
              Hungary&apos;s student discount marketplace.
            </p>
          </div>

          {/* Navigation links — student pages aren't prefetched: for a logged-out
              visitor middleware answers with a redirect to /login, and the
              client router would cache it. */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div>
              <p className="font-semibold text-gray-700 mb-1.5">Platform</p>
              <div className="flex flex-col gap-1">
                <Link href="/dashboard" prefetch={false} className="text-gray-500 hover:text-gray-800 transition-colors">Browse deals</Link>
                <Link href="/explore" prefetch={false} className="text-gray-500 hover:text-gray-800 transition-colors">Explore</Link>
                <Link href="/loyalty" prefetch={false} className="text-gray-500 hover:text-gray-800 transition-colors">Loyalty cards</Link>
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

        {/* Project notice — this is a portfolio project, not a registered business */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 text-xs text-gray-500 leading-relaxed">
          <div className="flex items-start gap-2">
            <Info size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <p>
              StudDeals is a portfolio project by Emmanuel Lamptey — not a registered company.
              No real payments are processed.
            </p>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-5 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">
            © {year} StudDeals · Emmanuel Lamptey
          </p>
          <p className="text-[11px] text-gray-400">
            Adattárolás: Supabase EU (Írország) · GDPR 2016/679 · ePrivacy irányelv
          </p>
        </div>

      </div>
    </footer>
  );
}
