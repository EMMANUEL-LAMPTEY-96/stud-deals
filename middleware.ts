// =============================================================================
// middleware.ts (root of project)
// Next.js middleware — runs on every request BEFORE the page renders.
// Responsibilities:
//   1. Refresh Supabase auth session (keep JWT fresh)
//   2. Enforce role-based access control for protected routes
//   3. Redirect unauthenticated users to login
//   4. Redirect wrong-role users (e.g., vendor accessing /student/dashboard)
// =============================================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database.types';

// Route prefixes by required role
const STUDENT_ROUTES  = ['/dashboard', '/offer', '/my-vouchers', '/saved', '/verification'];
const VENDOR_ROUTES   = ['/vendor'];
const ADMIN_ROUTES    = ['/admin'];
const AUTH_ROUTES     = ['/sign-in', '/sign-up', '/login', '/register'];    // Redirect away if already logged in

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // If Supabase env vars are not configured yet, skip auth middleware entirely
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey || supabaseKey.includes('placeholder')) {
    return supabaseResponse;
  }

  // Create Supabase client that can refresh the session cookie
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() must be called here to refresh the session.
  // Never use getSession() in middleware — it reads from cache, not the server.
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ──────────────────────────────────────────────────────────────────────────
  // RULE 1: Unauthenticated user trying to access protected routes → Login
  // ──────────────────────────────────────────────────────────────────────────
  const isProtectedRoute = [
    ...STUDENT_ROUTES,
    ...VENDOR_ROUTES,
    ...ADMIN_ROUTES,
  ].some((route) => pathname.startsWith(route));

  if (!user && isProtectedRoute) {
    const redirectUrl = new URL('/sign-in', request.url);
    redirectUrl.searchParams.set('redirect', pathname);   // Remember where they were going
    return NextResponse.redirect(redirectUrl);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE 2: Authenticated user on auth pages → redirect to their dashboard
  // ──────────────────────────────────────────────────────────────────────────
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    // Fetch role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role ?? 'student';
    const dashboardPath = role === 'vendor' ? '/vendor'
                        : role === 'admin'  ? '/admin'
                        : '/dashboard';

    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE 3: Role-based route protection
  // Prevents a student from hitting /vendor/... and vice versa
  // ──────────────────────────────────────────────────────────────────────────
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role ?? 'student';

    // Vendor trying to access student routes
    if (role === 'vendor' && STUDENT_ROUTES.some((r) => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/vendor', request.url));
    }

    // Student trying to access vendor routes
    if (role === 'student' && VENDOR_ROUTES.some((r) => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Non-admin trying to access admin routes
    if (role !== 'admin' && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run middleware on all routes EXCEPT static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
