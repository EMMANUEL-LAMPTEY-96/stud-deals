'use client';

// =============================================================================
// app/reset-password/page.tsx — Set new password
// User lands here after clicking the reset link in their email.
// Supabase has already set a session via /auth/callback?next=/reset-password.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GraduationCap, Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters',       pass: password.length >= 8 },
    { label: 'Uppercase letter',     pass: /[A-Z]/.test(password) },
    { label: 'Number',               pass: /[0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const colors = ['bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-green-500'];
  const labels = ['', 'Weak', 'Fair', 'Strong'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-gray-200'}`} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {checks.map(c => (
            <span key={c.label} className={`text-xs flex items-center gap-1 ${c.pass ? 'text-green-600' : 'text-gray-400'}`}>
              <CheckCircle className="w-3 h-3" />
              {c.label}
            </span>
          ))}
        </div>
        {score > 0 && <span className={`text-xs font-semibold ${score === 3 ? 'text-green-600' : score === 2 ? 'text-yellow-600' : 'text-red-500'}`}>{labels[score]}</span>}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/login'), 2500);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[420px]">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-900 font-bold text-xl">Stud<span className="text-purple-600">Deals</span></span>
          </Link>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h2>
              <p className="text-gray-500 text-sm">Redirecting you to sign in&hellip;</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-gray-900">New password</h1>
                  <p className="text-gray-500 text-xs">Choose a strong password for your account</p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Min. 8 characters"
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      className={`w-full border rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all text-sm ${
                        confirm && password !== confirm
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                          : 'border-gray-200 focus:border-purple-500 focus:ring-purple-100'
                      }`}
                    />
                  </div>
                  {confirm && password !== confirm && (
                    <p className="mt-1 text-xs text-red-500">Passwords don&apos;t match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || password.length < 8 || password !== confirm}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm mt-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                  ) : (
                    'Update password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
