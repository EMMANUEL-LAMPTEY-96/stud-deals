import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stud-deals — Exclusive Student Discounts',
  description: 'Verified student discounts at local businesses near your campus.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
