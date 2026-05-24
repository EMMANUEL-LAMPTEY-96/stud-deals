// =============================================================================
// app/page.tsx — Root redirect
// The login/signup page IS the entry point for StudDeals.
// Visiting studeals.vercel.app goes straight to /login.
// Logged-in users hitting /login are redirected to their role dashboard
// by middleware (see middleware.ts → AUTH_ROUTES).
// =============================================================================

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/login');
}
