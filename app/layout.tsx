import type { Metadata, Viewport } from 'next'
import './globals.css'
import CookieConsent from '@/components/shared/CookieConsent'

export const metadata: Metadata = {
  title: 'Studeals — Exclusive Student Discounts',
  description: 'Verified student discounts at local businesses near your campus.',
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
    title: 'Studeals — Exclusive Student Discounts',
    description: 'Verified student discounts at local businesses near your campus.',
    type: 'website',
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
    <html lang="en">
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
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
