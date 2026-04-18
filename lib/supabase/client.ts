// =============================================================================
// lib/supabase/client.ts
// Browser-side Supabase client — used in Client Components ('use client')
// Uses createBrowserClient from @supabase/ssr for proper cookie handling.
// =============================================================================

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database.types';

/**
 * Creates a typed Supabase client for use in browser/client components.
 * Reads credentials from public env vars (safe to expose to the browser).
 *
 * Usage in Client Components:
 *   const supabase = createClient();
 *   const { data } = await supabase.from('offers').select('*');
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
