import type { Metadata } from 'next'
import './globals.css'
import CookieConsent from '@/components/shared/CookieConsent'

export const metadata: Metadata = {
  title: 'Unideals — Exclusive Student Discounts',
  description: 'Verified student discounts at local businesses near your campus.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
