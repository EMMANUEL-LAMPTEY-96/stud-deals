'use client';

// =============================================================================
// app/verify-email/page.tsx — Check your inbox
// =============================================================================

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GraduationCap, Mail, RefreshCw, CheckCircle, ArrowLeft } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function resendEmail() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resend({ type: 'signup', email });
    setResent(true);
    setLoading(false);
    setTimeout(() => setResent(false), 5000);
  }

  return (
    <div className="min-h-screen bg-[#0f0b2e] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-bold text-xl">Stud-deals</span>
        </Link>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          {/* Icon */}
          <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail className="w-8 h-8 text-purple-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-purple-300 mb-1">We&apos;ve sent a verification link to:</p>
          <p className="text-white font-semibold mb-6 break-all">{email}</p>

          {/* Steps */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-5 py-4 text-sm text-purple-200 mb-6 text-left space-y-2">
            <p className="flex items-start gap-2">
              <span className="w-5 h-5 bg-purple-600 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              Open the email from Stud-deals
            </p>
            <p className="flex items-start gap-2">
              <span className="w-5 h-5 bg-purple-600 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              Click the <strong className="text-white">&quot;Confirm your email&quot;</strong> button
            </p>
            <p className="flex items-start gap-2">
              <span className="w-5 h-5 bg-purple-600 rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              You&apos;ll land straight on your dashboard
            </p>
          </div>

          {/* Resend */}
          {resent ? (
            <div className="flex items-center justify-center gap-2 text-green-400 text-sm mb-4 py-3">
              <CheckCircle className="w-4 h-4" /> Email resent! Check your inbox.
            </div>
          ) : (
            <button
              onClick={resendEmail}
              disabled={loading}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-purple-200 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mb-4"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Resend verification email
            </button>
          )}

          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Wrong email? Start over
          </Link>
        </div>

        <p className="text-purple-400 text-xs mt-6">
          Check your spam folder if you don&apos;t see it within a minute.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
