'use client';

// =============================================================================
// app/sign-up/vendor/page.tsx — Business Registration
//
// Age gate: vendors must be 18+ (Hungarian civil law — 2013. évi V. törvény,
// Polgári Törvénykönyv § 12–23 — full legal capacity to enter contracts).
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n';
import {
  Building2, Mail, Lock, User, Tag,
  AlertCircle, Loader2, ArrowLeft, Eye, EyeOff, Shield
} from 'lucide-react';

const CATEGORIES = [
  { value: 'food_drink',        label: '🍕 Food & Drink' },
  { value: 'fashion',           label: '👗 Fashion & Clothing' },
  { value: 'tech',              label: '💻 Tech & Electronics' },
  { value: 'health_beauty',     label: '💆 Health & Beauty' },
  { value: 'fitness',           label: '🏋️ Fitness & Sports' },
  { value: 'entertainment',     label: '🎬 Entertainment' },
  { value: 'travel',            label: '✈️ Travel' },
  { value: 'books_stationery',  label: '📚 Books & Stationery' },
  { value: 'other',             label: '🏷️ Other' },
];

export default function VendorSignUpPage() {
  const router = useRouter();
  const t = useT();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('food_drink');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Age gate — Hungarian civil law (Ptk. § 12-23): must be 18+ to enter contracts
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    // Age gate — Ptk. § 12: full legal capacity (cselekvőképesség) requires 18+
    if (!ageConfirmed) {
      setError('You must confirm you are at least 18 years old to create a business account.');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'vendor',
          business_name: businessName,
          business_category: businessCategory,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="min-h-screen bg-[#0f0b2e] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link href="/sign-up" className="inline-flex items-center gap-2 text-purple-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-bold text-xl">Studeals</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('auth.signUpTitle')}</h1>
          <p className="text-purple-300 mt-1">{t('auth.vendorSignUpSubtitle', 'Reach thousands of verified students')}</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Your name */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-1.5">Your name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Emmanuel Lamptey"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-purple-400/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Business name */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-1.5">Business name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  required
                  placeholder="Campus Coffee Co."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-purple-400/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-1.5">Business category</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 z-10" />
                <select
                  value={businessCategory}
                  onChange={e => setBusinessCategory(e.target.value)}
                  className="w-full bg-[#1a1640] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-1.5">Business email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="hello@yourbusiness.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-purple-400/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-3 text-white placeholder-purple-400/50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && password.length < 8 && (
                <p className="mt-1 text-xs text-amber-400">{8 - password.length} more characters needed</p>
              )}
            </div>

            {/* Age confirmation — Hungarian civil law (Ptk. § 12–23): 18+ required for contracts */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div className="mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={e => setAgeConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer accent-blue-600"
                />
              </div>
              <span className="text-sm text-purple-200 leading-snug">
                Megerősítem, hogy betöltöttem a 18. életévemet és jogosult vagyok vállalkozói szerződést kötni.{' '}
                <span className="text-purple-400 font-normal">I confirm I am at least 18 years old and have legal capacity to enter into business contracts.</span>
              </span>
            </label>

            {ageConfirmed && (
              <p className="flex items-center gap-1.5 text-xs text-blue-400">
                <Shield className="w-3 h-3 flex-shrink-0" />
                Legal capacity confirmed — you can create and manage business agreements
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !ageConfirmed}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}</>
              ) : (
                t('auth.signUpButton')
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-purple-300 mt-6 text-sm">
          {t('auth.haveAccount')}{' '}
          <Link href="/sign-in" className="text-purple-400 hover:text-white font-medium transition-colors">
            {t('auth.signInLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
