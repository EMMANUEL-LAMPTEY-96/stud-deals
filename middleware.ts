// =============================================================================
// middleware.ts (root of project)
// Next.js middleware — runs on every request BEFORE the page renders.
// Responsibilities:
//   1. Refresh Supabase auth session (keep JWT fresh)
//   2. Enforce role-based access control for protected routes
//   3. Redirect unauthenticated users to login
//   4. Redirect wrong-role users (e.g., vendor accessing /student/dashboard)
// =============================================================================

import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database.types';
import type { Profile } from '@/lib/types/database.types';

// Route prefixes by required role
const STUDENT_ROUTES  = ['/dashboard', '/explore', '/offer', '/my-vouchers', '/saved', '/verification', '/reviews', '/loyalty', '/my-loyalty', '/notifications', '/my-savings', '/profile', '/referral', '/settings', '/leaderboard'];
const VENDOR_ROUTES   = ['/vendor'];
const ADMIN_ROUTES    = ['/admin'];
const AUTH_ROUTES     = ['/sign-in', '/sign-up', '/login', '/register'];    // Redirect away if already logged in

// Public routes inside /vendor/ that any authenticated user (including students) may access.
// /vendor/[slug] is a shareable public profile page — it must NOT be blocked for students.
const PUBLIC_VENDOR_ROUTES = /^\/vendor\/[a-z0-9][a-z0-9-]*[a-z0-9]?(\/.*)?$/;

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
        setAll(cookiesToSet: CookieOptionsWithName[]) {
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
    // /vendor/[slug] is a public page — allow unauthenticated visitors to view it
    if (PUBLIC_VENDOR_ROUTES.test(pathname)) {
      return supabaseResponse;
    }
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);   // Remember where they were going
    return NextResponse.redirect(redirectUrl);
  }

  // VULN-19 fix: fetch profile ONCE for all rule checks instead of making two
  // separate DB queries for the same user on every authenticated request.
  // We include both 'role' and 'is_active' in the single SELECT so rules 2 & 3
  // can share the same result without additional round-trips.
  let sharedProfile: { role?: string; is_active?: boolean } | null = null;
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();
    sharedProfile = p as typeof sharedProfile;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE 2: Authenticated user on auth pages → redirect to their dashboard
  // ──────────────────────────────────────────────────────────────────────────
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const role = sharedProfile?.role ?? 'student';
    const dashboardPath = role === 'vendor' ? '/vendor'
                        : role === 'admin'  ? '/admin'
                        : '/dashboard';

    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RULE 3: Role-based route protection + banned user check
  // Prevents a student from hitting /vendor/... and vice versa.
  // Banned users (is_active = false) are redirected to /sign-in.
  // ──────────────────────────────────────────────────────────────────────────
  if (user) {
    const profile = sharedProfile;

    // Blocked accounts — sign them out and redirect to login
    if (profile && (profile as { is_active?: boolean }).is_active === false) {
      await supabase.auth.signOut();
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('error', 'account_suspended');
      return NextResponse.redirect(redirectUrl);
    }

    const role = (profile as { role?: string } | null)?.role ?? 'student';

    // Vendor trying to access student routes
    if (role === 'vendor' && STUDENT_ROUTES.some((r) => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/vendor', request.url));
    }

    // Admin trying to access student routes → redirect to admin panel
    if (role === 'admin' && STUDENT_ROUTES.some((r) => pathname.startsWith(r))) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    // Student trying to access vendor routes — but allow public vendor profile pages
    if (role === 'student' && VENDOR_ROUTES.some((r) => pathname.startsWith(r))) {
      // /vendor/[slug] is a public profile — students can view it
      if (PUBLIC_VENDOR_ROUTES.test(pathname)) {
        return supabaseResponse;
      }
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
