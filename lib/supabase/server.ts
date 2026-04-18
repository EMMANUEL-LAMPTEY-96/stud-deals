// =============================================================================
// lib/supabase/server.ts
// Server-side Supabase client — used in Server Components, API Routes, Edge Functions.
// Uses createServerClient from @supabase/ssr which reads cookies from the request.
// This is what enforces RLS policies with the actual logged-in user's JWT.
// =============================================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/types/database.types';

/**
 * Creates a typed Supabase client for Server Components and Route Handlers.
 * Automatically reads the user's session from HTTP cookies.
 * All queries run with the authenticated user's JWT — RLS policies are enforced.
 *
 * Usage in Server Components:
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 * Usage in Route Handlers (app/api/...):
 *   const supabase = await createClient();
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component which is read-only.
            // This is fine — the middleware will handle session refresh.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase admin client using the service role key.
 * ONLY use this in secure server-side contexts (Edge Functions, admin API routes).
 * NEVER expose the service role key to the browser.
 * This client BYPASSES RLS — use with extreme care.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,    // Never NEXT_PUBLIC_ prefix this
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
