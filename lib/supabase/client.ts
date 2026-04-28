// =============================================================================
// lib/supabase/client.ts
// Browser-side Supabase client — used in Client Components ('use client')
// Uses createBrowserClient from @supabase/ssr for proper cookie handling.
// =============================================================================

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database.types';

/**
 * Creates a typed Supabase client for use in browser/client components.
 * Falls back to placeholder values during SSR/build time — actual network
 * calls only happen in the browser where real env vars are available.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL    ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  );
}
