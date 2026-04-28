'use client';

// =============================================================================
// app/login/page.tsx — Sign In
// Clean split-panel layout. Left: brand + social proof. Right: form.
// Handles role-aware redirect after login.
// =============================================================================

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  GraduationCap, Mail, Lock, Loader2, AlertCircle,
  Eye, EyeOff, CheckCircle, ArrowRight,
} from 'lucide-react';

const SOCIAL_PROOF = [
  { stat: '47,000+', label: 'Students saving' },
  { stat: '380+',    label: 'Partner businesses' },
  { stat: '£340',    label: 'Avg. yearly saving' },
];

const TESTIMONIALS = [
  { quote: 'Saved £200 in my first semester alone. Absolute game changer.', name: 'Priya S.', uni: 'University of Manchester' },
  { quote: 'The QR code system is genius — no printing, no cards needed.', name: 'James O.', uni: 'King\'s College London' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '';

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [testimonialIdx]          = useState(() => Math.floor(Math.random() * 2));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      const msg = signInError.message.includes('Invalid login credentials')
        ? 'Incorrect email or password.'
        : signInError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const role = profile?.role ?? 'student';
    const dest = redirectTo || (role === 'vendor' ? '/vendor' : '/dashboard');
    router.push(dest);
    router.refresh();
  }

  const t = TESTIMONIALS[testimonialIdx];

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — brand + social proof (hidden on mobile) ─────────── */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-[#0f0b2e] via-[#1a1250] to-[#0f0b2e] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-[-80px] right-[-80px] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-60px] left-[-60px] w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 relative z-10">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl">Stud<span className="text-purple-400">Deals</span></span>
        </Link>

        {/* Main copy */}
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Exclusive deals for<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
              verified students
            </span>
          </h2>
          <p className="text-purple-200 text-lg mb-10 leading-relaxed">
            Sign in and discover hundreds of local discounts — just show your QR code at the till.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            {SOCIAL_PROOF.map(s => (
              <div key={s.stat} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-white">{s.stat}</div>
                <div className="text-purple-300 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-white/90 text-sm leading-relaxed mb-3">&ldquo;{t.quote}&rdquo;</p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {t.name[0]}
              </div>
              <div>
                <p className="text-white text-xs font-semibold">{t.name}</p>
                <p className="text-purple-400 text-xs">{t.uni}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-purple-500 text-xs relative z-10">
          Free forever for students · No credit card required
        </p>
      </div>

      {/* ── RIGHT PANEL — form ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">

        {/* Mobile logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-8 lg:hidden">
          <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="text-gray-900 font-bold text-lg">Stud<span className="text-purple-600">Deals</span></span>
        </Link>

        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-black text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 mb-8">Sign in to your account to continue</p>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@university.ac.uk"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">Password</label>
                <Link href="/forgot-password" className="text-xs text-purple-600 hover:text-purple-700 font-medium">
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
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm shadow-purple-200"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">New to StudDeals?</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Sign-up options */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/sign-up/student"
              className="flex items-center justify-center gap-2 border border-gray-200 hover:border-purple-300 hover:bg-purple-50 rounded-xl py-2.5 px-3 text-sm font-medium text-gray-700 transition-all"
            >
              <GraduationCap className="w-4 h-4 text-purple-600" />
              Student
            </Link>
            <Link
              href="/sign-up/vendor"
              className="flex items-center justify-center gap-2 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl py-2.5 px-3 text-sm font-medium text-gray-700 transition-all"
            >
              <CheckCircle className="w-4 h-4 text-blue-600" />
              Business
            </Link>
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            By signing in you agree to our{' '}
            <Link href="/terms" className="text-purple-600 hover:underline">Terms</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>.
          </p>
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
