'use client';

// =============================================================================
// app/admin-mfa/page.tsx — two-factor login for admins (Supabase TOTP)
//
// Middleware sends admins here when their session isn't aal2 (see RULE 0 and
// the admin-panel check in middleware.ts). Lives outside app/admin/ so the
// admin layout doesn't load admin data before the second factor is done.
//   - No verified factor yet → enrol: scan the QR in an authenticator app
//     (Google Authenticator, 1Password, Authy…), then enter a 6-digit code.
//   - Verified factor        → enter the current 6-digit code.
// =============================================================================

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, Loader2, LogOut } from 'lucide-react';

type Mode = 'loading' | 'enroll' | 'challenge' | 'error';

function safeNext(raw: string | null): string {
  // Only allow returning to an admin page on this site.
  return raw && (raw === '/admin' || raw.startsWith('/admin/')) ? raw : '/admin';
}

function AdminMfa() {
  const supabase = createClient();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));

  const [mode, setMode]         = useState<Mode>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr]             = useState<string | null>(null);
  const [secret, setSecret]     = useState<string | null>(null);
  const [code, setCode]         = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') { router.replace(next); return; }

      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;

      const verified = factors?.totp?.[0];
      if (verified) { setFactorId(verified.id); setMode('challenge'); return; }

      // Clear half-finished enrolments so a new one can be created.
      for (const f of factors?.all ?? []) {
        if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `StudDeals admin ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollErr || !enrolled) throw enrollErr ?? new Error('Could not start setup.');
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
      setMode('enroll');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setMode('error');
    }
  }, [supabase, router, next]);

  useEffect(() => { start(); }, [start]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your app.'); return; }
    setBusy(true); setError(null);
    try {
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (vErr) throw vErr;
      router.replace(next);
      router.refresh();
    } catch {
      setError('That code didn’t work. Check your app and try the newest code.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={22} className="text-brand-600" />
          <h1 className="text-xl font-bold text-gray-900">Two-factor login</h1>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Admin access needs a code from an authenticator app on your phone.
        </p>

        {mode === 'loading' && (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
        )}

        {mode === 'enroll' && qr && (
          <div className="mb-4">
            <p className="text-sm text-gray-700 mb-3">
              1. Scan this with Google Authenticator, 1Password, Authy or similar.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Authenticator setup QR code" className="w-44 h-44 mx-auto border border-gray-100 rounded-lg" />
            {secret && (
              <p className="text-xs text-gray-500 mt-2 text-center break-all">
                Can&apos;t scan? Enter this key: <span className="font-mono">{secret}</span>
              </p>
            )}
            <p className="text-sm text-gray-700 mt-4">2. Enter the 6-digit code it shows.</p>
          </div>
        )}

        {(mode === 'enroll' || mode === 'challenge') && (
          <form onSubmit={verify} className="space-y-3">
            <input
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full text-center tracking-[0.4em] text-lg font-mono border border-gray-200 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="submit" disabled={busy || code.length !== 6}
              className="w-full btn-primary py-3 disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === 'enroll' ? 'Turn on two-factor login' : 'Verify'}
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        {mode === 'error' && (
          <button onClick={start} className="w-full btn-secondary py-2.5 mt-3">Try again</button>
        )}

        <button onClick={signOut} className="mt-6 text-xs text-gray-500 inline-flex items-center gap-1 hover:text-gray-700">
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </div>
  );
}

export default function AdminMfaPage() {
  return (
    <Suspense fallback={null}>
      <AdminMfa />
    </Suspense>
  );
}
