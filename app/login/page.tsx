'use client';

// =============================================================================
// app/login/page.tsx — Role-aware Sign In
// The first thing visitors see when logging in.
// A prominent Student / Business toggle switches the entire look:
//   - Student  → purple theme, student-facing copy, /dashboard redirect
//   - Vendor   → green theme,  business-facing copy, /vendor redirect
// Students are barred from /vendor/* by middleware regardless.
// =============================================================================

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  GraduationCap, Store, Mail, Lock, Loader2, AlertCircle,
  Eye, EyeOff, ArrowRight, CheckCircle, BarChart3, Tag,
  QrCode, Shield, TrendingUp, Users, Star, Zap,
} from 'lucide-react';

// ── Panel copy per role ────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  student: {
    bg:            'from-[#0f0b2e] via-[#1a1250] to-[#0f0b2e]',
    orb1:          'bg-purple-600/20',
    orb2:          'bg-blue-600/15',
    accent:        'from-purple-400 to-blue-400',
    logo:          'from-purple-500 to-purple-700',
    inputFocus:    'focus:border-purple-500 focus:ring-purple-100',
    btn:           'bg-purple-600 hover:bg-purple-700 shadow-purple-200',
    tabActive:     'bg-purple-600 text-white shadow-sm',
    tabInactive:   'text-gray-500 hover:text-gray-700',
    signupHref:    '/sign-up/student',
    signupLabel:   'Create student account',
    signupIcon:    <GraduationCap className="w-4 h-4" />,
    headline:      'Your campus, your discounts.',
    subline:       'Sign in to discover hundreds of verified student deals — show your QR code at the till and save instantly.',
    panelFooter:   'Free forever for students · No credit card required',
    destination:   '/dashboard',
    stats: [
      { val: '47,000+', label: 'Students saving' },
      { val: '2,400+',  label: 'Live deals' },
      { val: '£340',    label: 'Avg. yearly saving' },
    ],
    perks: [
      { icon: <Tag size={16} />,    text: 'Exclusive student-only pricing' },
      { icon: <QrCode size={16} />, text: 'One-tap QR redemption at the till' },
      { icon: <Shield size={16} />, text: 'Verified & private — data never sold' },
      { icon: <Zap size={16} />,    text: 'Instant access on sign-up' },
    ],
    testimonial: {
      quote: "Saved £200 in my first semester alone. Absolute game changer.",
      name: "Priya S.", role: "University of Manchester",
    },
  },
  vendor: {
    bg:            'from-[#0a1f0f] via-[#0d2e14] to-[#0a1f0f]',
    orb1:          'bg-green-600/20',
    orb2:          'bg-emerald-600/15',
    accent:        'from-green-400 to-emerald-300',
    logo:          'from-green-500 to-emerald-600',
    inputFocus:    'focus:border-green-500 focus:ring-green-100',
    btn:           'bg-green-600 hover:bg-green-700 shadow-green-200',
    tabActive:     'bg-green-600 text-white shadow-sm',
    tabInactive:   'text-gray-500 hover:text-gray-700',
    signupHref:    '/sign-up/vendor',
    signupLabel:   'List my business',
    signupIcon:    <Store className="w-4 h-4" />,
    headline:      'Reach your campus. Measure your ROI.',
    subline:       'Sign in to manage your offers, track redemptions and see exactly how many students you\'re bringing through the door.',
    panelFooter:   'Free to list · No upfront cost · Pay only when it grows',
    destination:   '/vendor',
    stats: [
      { val: '+34%',   label: 'Avg. footfall increase' },
      { val: '380+',   label: 'Partner businesses' },
      { val: '1,247',  label: 'Avg. monthly redemptions' },
    ],
    perks: [
      { icon: <BarChart3 size={16} />, text: 'Live redemption & revenue analytics' },
      { icon: <Users size={16} />,     text: 'Reach thousands of verified students' },
      { icon: <Tag size={16} />,       text: 'Loyalty programs & punch cards' },
      { icon: <TrendingUp size={16} />,text: 'Track ROI down to the last redemption' },
    ],
    testimonial: {
      quote: "We saw a 40% increase in student footfall in the first month. The analytics are brilliant.",
      name: "Marco R.", role: "Pizza Palace, London",
    },
  },
} as const;

type LoginRole = 'student' | 'vendor';

// ── Form ───────────────────────────────────────────────────────────────────────
function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get('redirect') ?? '';
  const roleParam    = (searchParams.get('role') as LoginRole) ?? 'student';

  const [role, setRole]         = useState<LoginRole>(roleParam === 'vendor' ? 'vendor' : 'student');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const cfg = ROLE_CONFIG[role];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(
        signInError.message.includes('Invalid login credentials')
          ? 'Incorrect email or password. Please try again.'
          : signInError.message,
      );
      setLoading(false);
      return;
    }

    // Verify the user is signing in as the right role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const actualRole = profile?.role ?? (data.user.user_metadata?.role as string) ?? 'student';

    if (role === 'vendor' && actualRole !== 'vendor') {
      await supabase.auth.signOut();
      setError("This account is a student account. Use the Student login tab, or sign up as a business.");
      setLoading(false);
      return;
    }

    if (role === 'student' && actualRole === 'vendor') {
      await supabase.auth.signOut();
      setError("This is a business account. Please switch to the Business tab to sign in.");
      setLoading(false);
      return;
    }

    const dest = redirectTo || cfg.destination;
    router.push(dest);
    router.refresh();
  }

  function switchRole(next: LoginRole) {
    setRole(next);
    setError('');
    setEmail('');
    setPassword('');
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ────────────────────────────────────────────────────── */}
      <div className={`hidden lg:flex lg:w-[52%] bg-gradient-to-br ${cfg.bg} flex-col justify-between p-12 relative overflow-hidden transition-all duration-500`}>
        <div className={`absolute top-[-80px] right-[-80px] w-[400px] h-[400px] ${cfg.orb1} rounded-full blur-3xl pointer-events-none transition-all duration-500`} />
        <div className={`absolute bottom-[-60px] left-[-60px] w-[300px] h-[300px] ${cfg.orb2} rounded-full blur-3xl pointer-events-none transition-all duration-500`} />

        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 relative z-10">
          <div className={`w-10 h-10 bg-gradient-to-br ${cfg.logo} rounded-xl flex items-center justify-center shadow-lg transition-all duration-300`}>
            {role === 'vendor'
              ? <Store className="w-5 h-5 text-white" />
              : <GraduationCap className="w-5 h-5 text-white" />
            }
          </div>
          <span className="text-white font-bold text-xl">
            Stud<span className={`text-transparent bg-clip-text bg-gradient-to-r ${cfg.accent}`}>Deals</span>
            {role === 'vendor' && <span className="ml-2 text-xs font-semibold bg-white/10 px-2 py-0.5 rounded-md">Business</span>}
          </span>
        </Link>

        {/* Main copy */}
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            <span className={`text-transparent bg-clip-text bg-gradient-to-r ${cfg.accent}`}>
              {role === 'student' ? 'Exclusive deals for' : 'Grow your business'}
            </span>
            <br />
            {role === 'student' ? 'verified students' : 'with student traffic'}
          </h2>
          <p className="text-white/70 text-base mb-10 leading-relaxed max-w-sm">
            {cfg.subline}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-10">
            {cfg.stats.map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-center">
                <div className="text-xl font-black text-white">{s.val}</div>
                <div className="text-white/50 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Perks list */}
          <div className="space-y-2.5 mb-10">
            {cfg.perks.map(p => (
              <div key={p.text} className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-white/80 flex-shrink-0">
                  {p.icon}
                </div>
                <span className="text-white/75 text-sm">{p.text}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex gap-0.5 mb-2">
              {[1,2,3,4,5].map(i => <Star key={i} size={12} className="fill-amber-400 text-amber-400" />)}
            </div>
            <p className="text-white/80 text-sm leading-relaxed mb-3">&ldquo;{cfg.testimonial.quote}&rdquo;</p>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${cfg.logo} flex items-center justify-center text-white text-xs font-bold`}>
                {cfg.testimonial.name[0]}
              </div>
              <div>
                <p className="text-white text-xs font-semibold">{cfg.testimonial.name}</p>
                <p className="text-white/40 text-xs">{cfg.testimonial.role}</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-white/30 text-xs relative z-10">{cfg.panelFooter}</p>
      </div>

      {/* ── RIGHT PANEL — form ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">

        {/* Mobile logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-6 lg:hidden">
          <div className={`w-9 h-9 bg-gradient-to-br ${cfg.logo} rounded-xl flex items-center justify-center transition-all duration-300`}>
            {role === 'vendor' ? <Store className="w-5 h-5 text-white" /> : <GraduationCap className="w-5 h-5 text-white" />}
          </div>
          <span className="text-gray-900 font-bold text-lg">
            Stud<span className={`${role === 'vendor' ? 'text-green-600' : 'text-purple-600'}`}>Deals</span>
          </span>
        </Link>

        <div className="w-full max-w-[400px]">

          {/* ── ROLE SWITCHER ─────────────────────────────────────────── */}
          <div className="bg-gray-100 rounded-2xl p-1.5 flex gap-1 mb-8 shadow-inner">
            <button
              onClick={() => switchRole('student')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                role === 'student' ? ROLE_CONFIG.student.tabActive : ROLE_CONFIG.student.tabInactive
              }`}
            >
              <GraduationCap size={16} />
              Student
            </button>
            <button
              onClick={() => switchRole('vendor')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                role === 'vendor' ? ROLE_CONFIG.vendor.tabActive : ROLE_CONFIG.vendor.tabInactive
              }`}
            >
              <Store size={16} />
              Business
            </button>
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-1">
            {role === 'student' ? 'Welcome back' : 'Business sign in'}
          </h1>
          <p className="text-gray-500 text-sm mb-7">
            {role === 'student'
              ? 'Sign in to browse and claim your student deals.'
              : 'Manage your offers, loyalty programmes and analytics.'}
          </p>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {role === 'student' ? 'Email address' : 'Business email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={role === 'student' ? 'you@university.ac.uk' : 'hello@yourbusiness.co.uk'}
                  className={`w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none ${cfg.inputFocus} focus:ring-2 transition-all text-sm`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">Password</label>
                <Link href="/forgot-password" className={`text-xs font-medium ${role === 'vendor' ? 'text-green-600 hover:text-green-700' : 'text-purple-600 hover:text-purple-700'}`}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`w-full border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-gray-900 placeholder-gray-400 focus:outline-none ${cfg.inputFocus} focus:ring-2 transition-all text-sm`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full ${cfg.btn} disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm`}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <>
                  {role === 'vendor' ? 'Access Business Dashboard' : 'Sign in to StudDeals'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">New to StudDeals?</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Sign-up CTA */}
          <Link
            href={cfg.signupHref}
            className={`w-full flex items-center justify-center gap-2 border-2 ${
              role === 'vendor' ? 'border-green-200 hover:bg-green-50 hover:border-green-400 text-green-700' : 'border-purple-200 hover:bg-purple-50 hover:border-purple-400 text-purple-700'
            } rounded-xl py-2.5 text-sm font-semibold transition-all`}
          >
            {cfg.signupIcon}
            {cfg.signupLabel}
          </Link>

          {/* Trust note */}
          <div className="flex items-center justify-center gap-1.5 mt-5 text-xs text-gray-400">
            <CheckCircle size={12} className="text-green-500" />
            {role === 'student'
              ? 'Verified · Free forever · No credit card'
              : 'Free to list · Cancel anytime · GDPR compliant'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
