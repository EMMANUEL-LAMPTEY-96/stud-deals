'use client';

// =============================================================================
// components/shared/Navbar.tsx
// Adaptive navbar that renders differently for:
//   - Unauthenticated visitors (marketing nav)
//   - Verified students (student nav with notifications bell)
//   - Vendors (vendor nav with business name)
//   - Admins (admin nav)
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile, StudentProfile } from '@/lib/types/database.types';

// Lucide icons (tree-shakeable)
import {
  GraduationCap,
  Store,
  Bell,
  Menu,
  X,
  LogOut,
  User,
  LayoutDashboard,
  Tag,
  ChevronDown,
  Sparkles,
  Zap,
  Calendar,
  UserCheck,
  Printer,
  LayoutTemplate,
  Star,
  HelpCircle,
  QrCode,
} from 'lucide-react';

interface NavUser {
  profile: Profile;
  studentProfile?: Pick<StudentProfile, 'verification_status'> | null;
  businessName?: string | null;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [user, setUser] = useState<NavUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Determine which "zone" we're in for styling ──────────────────────────
  const isVendorZone = pathname?.startsWith('/vendor');
  const primaryColor = isVendorZone ? 'vendor' : 'brand';

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!profile) { setLoading(false); return; }

      let studentProfile = null;
      let businessName = null;

      if (profile.role === 'student') {
        const { data } = await supabase
          .from('student_profiles')
          .select('verification_status')
          .eq('user_id', authUser.id)
          .single();
        studentProfile = data;
      }

      if (profile.role === 'vendor') {
        const { data } = await supabase
          .from('vendor_profiles')
          .select('business_name')
          .eq('user_id', authUser.id)
          .single();
        businessName = data?.business_name ?? null;
      }

      setUser({ profile, studentProfile, businessName });

      // Fetch unread notification count
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
        .eq('is_read', false);
      setUnreadCount(count ?? 0);

      setLoading(false);
    };

    fetchUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const displayName = user?.profile.display_name
    ?? (user?.profile.first_name
        ? `${user.profile.first_name} ${user.profile.last_name?.[0] ?? ''}.`.trim()
        : 'Account');

  // ── GUEST NAVBAR (unauthenticated) ───────────────────────────────────────
  if (!loading && !user) {
    return (
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm group-hover:shadow-glow transition-shadow">
                <GraduationCap className="w-4.5 h-4.5 text-white" size={18} />
              </div>
              <span className="font-bold text-gray-900 text-lg">
                Stud<span className="text-brand-600">Deals</span>
              </span>
            </Link>

            {/* Desktop guest nav */}
            <div className="hidden md:flex items-center gap-6">
              <Link href="/#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
                How it works
              </Link>
              <Link href="/for-vendors" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
                For businesses
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="btn-secondary text-sm px-4 py-2">
                Log in
              </Link>
              <Link href="/register/student" className="btn-primary text-sm px-4 py-2">
                <Sparkles size={14} />
                Get student deals
              </Link>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 animate-fade-in">
            <Link href="/#how-it-works" className="block py-2 text-gray-700 font-medium" onClick={() => setMobileOpen(false)}>How it works</Link>
            <Link href="/for-vendors" className="block py-2 text-gray-700 font-medium" onClick={() => setMobileOpen(false)}>For businesses</Link>
            <hr className="border-gray-100" />
            <Link href="/login" className="block w-full btn-secondary text-center" onClick={() => setMobileOpen(false)}>Log in</Link>
            <Link href="/register/student" className="block w-full btn-primary text-center" onClick={() => setMobileOpen(false)}>Get student deals</Link>
          </div>
        )}
      </nav>
    );
  }

  // ── AUTHENTICATED NAVBAR ─────────────────────────────────────────────────
  const role = user?.profile.role;

  const studentLinks = [
    { href: '/dashboard', label: 'Discover', icon: <Sparkles size={15} /> },
    { href: '/my-vouchers', label: 'My Vouchers', icon: <Tag size={15} /> },
    { href: '/saved', label: 'Saved', icon: <LayoutDashboard size={15} /> },
  ];

  const vendorLinks = [
    { href: '/vendor/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
    { href: '/vendor/offers', label: 'My Offers', icon: <Tag size={15} /> },
    { href: '/vendor/redeem', label: 'Scan Code', icon: <Store size={15} /> },
  ];

  const navLinks = role === 'vendor' ? vendorLinks : studentLinks;
  const accentClass = role === 'vendor' ? 'text-vendor-600' : 'text-brand-600';
  const logoGradient = role === 'vendor'
    ? 'from-vendor-500 to-vendor-700'
    : 'from-brand-500 to-brand-700';

  return (
    <nav className={`sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 ${loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={role === 'vendor' ? '/vendor/dashboard' : '/dashboard'} className="flex items-center gap-2.5 group flex-shrink-0">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${logoGradient} flex items-center justify-center shadow-sm`}>
              {role === 'vendor'
                ? <Store className="text-white" size={17} />
                : <GraduationCap className="text-white" size={17} />
              }
            </div>
            <span className="font-bold text-gray-900 text-base hidden sm:block">
              Stud<span className={accentClass}>Deals</span>
              {role === 'vendor' && <span className="ml-1.5 text-xs font-medium bg-vendor-100 text-vendor-700 px-1.5 py-0.5 rounded-md">Biz</span>}
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? role === 'vendor'
                        ? 'bg-vendor-50 text-vendor-700'
                        : 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side: notifications + profile */}
          <div className="flex items-center gap-2">
            {/* Notifications bell */}
            <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white animate-pulse-soft" />
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${logoGradient} flex items-center justify-center text-white text-xs font-bold`}>
                  {(user?.profile.first_name?.[0] ?? user?.profile.display_name?.[0] ?? 'U').toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-800 hidden sm:block max-w-[120px] truncate">
                  {role === 'vendor' ? user?.businessName ?? displayName : displayName}
                </span>
                <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
              </button>

              {/* Dropdown */}
              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 py-1.5 z-50 animate-fade-in"
                  style={{ width: role === 'vendor' ? '232px' : '208px' }}>

                  {/* Identity header */}
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-xs text-gray-400">Signed in as</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.profile.first_name} {user?.profile.last_name}
                    </p>
                    {role === 'student' && user?.studentProfile && (
                      <span className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-block ${
                        user.studentProfile.verification_status === 'verified'
                          ? 'status-verified'
                          : 'status-pending'
                      }`}>
                        {user.studentProfile.verification_status === 'verified' ? '✓ Verified student' : '⏳ Pending verification'}
                      </span>
                    )}
                  </div>

                  {/* ── Vendor-only tool sections ── */}
                  {role === 'vendor' && (
                    <>
                      <div className="px-3 pt-2.5 pb-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">Manage</p>
                        <Link href="/vendor/boost" onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <Zap size={12} className="text-amber-700" />
                          </div>
                          Boost &amp; flash deals
                        </Link>
                        <Link href="/vendor/calendar" onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Calendar size={12} className="text-blue-700" />
                          </div>
                          Campaign calendar
                        </Link>
                        <Link href="/vendor/staff" onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <div className="w-6 h-6 rounded-md bg-pink-100 flex items-center justify-center flex-shrink-0">
                            <UserCheck size={12} className="text-pink-700" />
                          </div>
                          Staff PINs
                        </Link>
                        <Link href="/vendor/reviews" onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center flex-shrink-0">
                            <Star size={12} className="text-green-700" />
                          </div>
                          Student reviews
                        </Link>
                      </div>

                      <div className="border-t border-gray-100 mx-2 my-1" />

                      <div className="px-3 pb-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">Quick tools</p>
                        <Link href="/vendor/print-qr" onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Printer size={12} className="text-emerald-700" />
                          </div>
                          Print QR poster
                        </Link>
                        <Link href="/vendor/offers/templates" onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <LayoutTemplate size={12} className="text-violet-700" />
                          </div>
                          Offer templates
                        </Link>
                        <Link href="/vendor/scan" onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <div className="w-6 h-6 rounded-md bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <QrCode size={12} className="text-teal-700" />
                          </div>
                          <span className="flex-1">Counter mode</span>
                          <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full leading-tight">Staff</span>
                        </Link>
                      </div>

                      <div className="border-t border-gray-100 mx-2 my-1" />
                    </>
                  )}

                  {/* Profile settings */}
                  <Link
                    href={role === 'vendor' ? '/vendor/profile' : '/profile'}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <User size={15} className="text-gray-400" />
                    Profile settings
                  </Link>

                  {/* Sign out */}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav links */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-1 animate-fade-in">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
                pathname === link.href
                  ? role === 'vendor' ? 'bg-vendor-50 text-vendor-700' : 'bg-brand-50 text-brand-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
