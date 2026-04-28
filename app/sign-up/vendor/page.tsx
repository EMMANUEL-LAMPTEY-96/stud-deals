'use client';

// =============================================================================
// app/sign-up/vendor/page.tsx — Business Registration
// Split layout: left = value props, right = form.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Store, Mail, Lock, User, Building2, Tag,
  AlertCircle, Loader2, ArrowLeft, Eye, EyeOff,
  BarChart2, Users, Zap, CheckCircle, ArrowRight,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'food_drink',       label: '🍕 Food & Drink' },
  { value: 'coffee',           label: '☕ Coffee & Cafés' },
  { value: 'fashion',          label: '👗 Fashion & Clothing' },
  { value: 'tech',             label: '💻 Tech & Electronics' },
  { value: 'health_beauty',    label: '💆 Health & Beauty' },
  { value: 'fitness',          label: '🏋️ Fitness & Sports' },
  { value: 'entertainment',    label: '🎬 Entertainment' },
  { value: 'books_stationery', label: '📚 Books & Stationery' },
  { value: 'travel',           label: '✈️ Travel' },
  { value: 'grocery',          label: '🛒 Grocery & Convenience' },
  { value: 'other',            label: '🏷️ Other' },
];

const VALUE_PROPS = [
  { icon: Users,    title: '47,000 verified students',  desc: 'A ready-made audience in your neighbourhood' },
  { icon: Zap,      title: 'Live in under 5 minutes',   desc: 'Create your first offer and go live immediately' },
  { icon: BarChart2,title: 'Real-time analytics',       desc: 'Track views, redemptions & revenue impact' },
  { icon: CheckCircle, title: 'Free to list',           desc: 'No setup fees. Pay nothing until you grow.' },
];

export default function VendorSignUpPage() {
  const router = useRouter();
  const [fullName, setFullName]               = useState('');
  const [businessName, setBusinessName]       = useState('');
  const [businessCategory, setBusinessCategory] = useState('food_drink');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  const pwStrength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0;
  const pwColors   = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-green-500'];
  const pwLabels   = ['', 'Weak', 'Fair', 'Strong'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, role: 'vendor', business_name: businessName, business_category: businessCategory },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (err) { setError(err.message); setLoading(false); return; }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />

        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 relative z-10">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Stud<span className="text-blue-200">Deals</span> <span className="text-xs font-normal text-blue-200">for Business</span></span>
        </Link>

        {/* Hero text */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 text-xs text-white font-medium mb-4">
            <Zap className="w-3 h-3" /> Free to join — no setup fees
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-3">
            Reach students on<br />
            <span className="text-blue-200">their doorstep</span>
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed mb-8">
            List your business on StudDeals and tap into 47,000+ verified local students looking for exactly what you offer.
          </p>

          {/* Value props */}
          <div className="space-y-3">
            {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{title}</p>
                  <p className="text-blue-200 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badge */}
        <div className="relative z-10 bg-white/10 border border-white/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            {[...Array(5)].map((_, i) => <span key={i} className="text-amber-400 text-sm">★</span>)}
          </div>
          <p className="text-white text-sm">&ldquo;StudDeals brought us 80+ new student customers in our first month.&rdquo;</p>
          <p className="text-blue-200 text-xs mt-1">— Marco&apos;s Pizza, Bristol</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-white overflow-y-auto">

        <div className="w-full max-w-[420px] mb-6 flex items-center justify-between">
          <Link href="/sign-up" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-900 font-bold text-base">Stud<span className="text-blue-600">Deals</span></span>
          </Link>
        </div>

        <div className="w-full max-w-[420px]">
          <h1 className="text-2xl font-black text-gray-900 mb-1">Create business account</h1>
          <p className="text-gray-500 text-sm mb-6">Start reaching verified students today</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Your name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required autoComplete="name" placeholder="Your full name"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
            </div>

            {/* Business name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business name</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} required placeholder="e.g. The Coffee House"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business category</label>
              <div className="relative">
                <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
                <select value={businessCategory} onChange={e => setBusinessCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <ArrowRight className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
              </div>
            </div>

            {/* Business email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="hello@yourbusiness.com"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Min. 8 characters"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < pwStrength ? pwColors[pwStrength] : 'bg-gray-200'}`} />
                  ))}
                  <span className={`text-xs ml-1 font-medium ${pwStrength===3?'text-green-600':pwStrength===2?'text-amber-600':'text-red-500'}`}>{pwLabels[pwStrength]}</span>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm shadow-blue-200 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : 'Create business account →'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              By signing up you agree to our{' '}
              <Link href="/terms" className="text-blue-600 hover:underline">Terms</Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
