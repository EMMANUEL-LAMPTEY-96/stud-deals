import type { Metadata, Viewport } from 'next'
import './globals.css'
import CookieConsent from '@/components/shared/CookieConsent'
import LegalFooter from '@/components/shared/LegalFooter'
import ServiceWorkerRegistrar from '@/components/shared/ServiceWorkerRegistrar'

export const metadata: Metadata = {
  title: 'Studeals — Exkluzív diákkedvezmények | Student Discounts',
  description: 'Ellenőrzött diákkedvezmények a kampuszod közelében lévő üzletekben. Verified student discounts at local businesses near your campus.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Studeals',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    title: 'Studeals — Exkluzív diákkedvezmények',
    description: 'Ellenőrzött diákkedvezmények a kampuszod közelében lévő üzletekben.',
    type: 'website',
    locale: 'hu_HU',
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang="hu" — required by WCAG 3.1.1 and correct for Hungarian-first service
    <html lang="hu">
      <head>
        {/* PWA — iOS specific */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Studeals" />
        {/* PWA — Android / Chrome */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {/* Skip navigation — WCAG 2.4.1 bypass blocks */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-brand-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl focus:font-bold focus:text-sm focus:shadow-lg"
        >
          Ugrás a főtartalomhoz / Skip to main content
        </a>

        <div id="main-content">
          {children}
        </div>

        <LegalFooter />
        <CookieConsent />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
