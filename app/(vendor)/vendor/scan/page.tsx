'use client';

// =============================================================================
// app/(vendor)/vendor/scan/page.tsx — Staff Scan-Only Interface
//
// A minimal, PIN-protected page for counter staff.
// No full vendor auth required — staff open /vendor/scan?v=<vendorId> and
// enter their 4-digit PIN, which is checked server-side by /api/staff/login
// against that vendor's hashed PINs. The session is an HttpOnly cookie.
//
// Once authenticated:
//   - Shows a compact QR code panel (same as vendor dashboard)
//   - Shows pending rewards to claim (reward_earned redemptions)
//   - Mark reward as claimed
//
// Session cookie expires after 4 hours; PIN entry UI re-appears then.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import VendorQRPanel from '@/components/vendor/VendorQRPanel';
import {
  Lock, CheckCircle, AlertCircle, Loader2, Gift,
  QrCode, LogOut, User, Clock, RefreshCw, Zap,
} from 'lucide-react';

interface PendingReward {
  id: string;
  student_name: string;
  offer_title: string;
  reward_label: string;
  status: string;
  created_at: string;
}

const SESSION_KEY = 'stud_staff_session';
const VENDOR_KEY = 'stud_staff_vendor';
const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours

interface StaffSession {
  vendorId: string;
  businessName: string;
  staffName: string;
  city: string | null;
  expiresAt: number;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── PIN Entry Screen ───────────────────────────────────────────────────────────

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS  = 60;

/** Vendor this scan page belongs to: ?v=<id> from the staff link, remembered per device. */
function scanVendorId(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get('v');
  try {
    if (fromUrl) { localStorage.setItem(VENDOR_KEY, fromUrl); return fromUrl; }
    return localStorage.getItem(VENDOR_KEY);
  } catch (_) {
    return fromUrl;
  }
}

function PinEntry({ onSuccess }: { onSuccess: (session: StaffSession) => void }) {
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown ticker
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) { setLockedUntil(null); setAttempts(0); setCountdown(0); }
      else setCountdown(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  const press = (d: string) => {
    if (lockedUntil) return; // locked out
    if (d === '⌫') { setPin(p => p.slice(0,-1)); setError(''); return; }
    if (pin.length >= 4) return;
    setPin(p => p + d);
  };

  useEffect(() => {
    if (pin.length === 4 && !lockedUntil) verify(pin);
  }, [pin]);

  const verify = async (entered: string) => {
    setChecking(true);
    setError('');

    let matched: StaffSession | null = null;
    let serverError: string | null = null;
    try {
      const res = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: scanVendorId(), pin: entered }),
      });
      const data = await res.json();
      if (res.ok && data.session) {
        matched = { ...data.session, expiresAt: Date.now() + SESSION_TTL };
      } else if (res.status !== 401) {
        serverError = data.error ?? 'Could not verify PIN. Please try again.';
      }
    } catch (_) {
      serverError = 'Network error. Please try again.';
    }

    setChecking(false);

    if (serverError) {
      setPin('');
      setError(serverError);
      return;
    }

    if (!matched) {
      setPin('');
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_PIN_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
        setError(`Too many attempts. Locked for ${LOCKOUT_SECONDS} seconds.`);
      } else {
        setError(`Incorrect PIN. ${MAX_PIN_ATTEMPTS - newAttempts} attempt${MAX_PIN_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`);
      }
      return;
    }

    onSuccess(matched);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-vendor-600 flex items-center justify-center mx-auto mb-4">
            <QrCode size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-black text-white">Studeals</h1>
          <p className="text-gray-400 text-sm mt-1">Staff Scan Mode</p>
        </div>

        {/* Lockout banner */}
        {lockedUntil && (
          <div className="bg-red-900/60 border border-red-700 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-red-300 text-sm font-bold">Too many failed attempts</p>
            <p className="text-red-400 text-xs mt-0.5">Try again in <span className="font-mono font-bold text-red-200">{countdown}s</span></p>
          </div>
        )}

        {/* PIN display */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all ${
                lockedUntil ? 'bg-red-900/40 border-red-700' :
                pin.length > i
                  ? 'bg-vendor-600 border-vendor-500'
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              {pin.length > i && <div className="w-3 h-3 rounded-full bg-white" />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-center gap-2 mb-4 text-red-400 text-sm font-medium">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Loading */}
        {checking && (
          <div className="flex items-center justify-center gap-2 mb-4 text-vendor-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Verifying…
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {digits.map((d, i) => (
            <button
              key={i}
              onClick={() => d && press(d)}
              disabled={!d || checking}
              className={`h-16 rounded-2xl text-xl font-bold transition-all ${
                !d
                  ? 'invisible'
                  : d === '⌫'
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 active:scale-95'
                    : 'bg-gray-800 text-white hover:bg-gray-700 active:scale-95 active:bg-vendor-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Enter your 4-digit staff PIN provided by the business owner.
        </p>
      </div>
    </div>
  );
}

// ── Main Scan Screen ───────────────────────────────────────────────────────────

function ScanScreen({ session, onLogout }: { session: StaffSession; onLogout: () => void }) {
  const [pending, setPending] = useState<PendingReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sessionMinsLeft, setSessionMinsLeft] = useState<number | null>(null);

  // Session expiry countdown — warn when < 30 minutes left
  useEffect(() => {
    const tick = () => {
      const remaining = Math.ceil((session.expiresAt - Date.now()) / 60000);
      setSessionMinsLeft(remaining <= 0 ? 0 : remaining);
      if (remaining <= 0) onLogout();
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [session.expiresAt]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/rewards');
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setPending(Array.isArray(data.rewards) ? data.rewards : []);
    } catch (_) {
      /* keep previous list */
    } finally {
      setLoading(false);
    }
  }, [session.vendorId]);

  useEffect(() => { load(); }, [load]);

  const handleClaim = async (id: string) => {
    setClaiming(id);
    const res = await fetch('/api/staff/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    setClaiming(null);
    if (res?.status === 401) { onLogout(); return; }
    setToast(res?.ok ? '✅ Reward claimed!' : '⚠️ Could not claim reward. Please try again.');
    setTimeout(() => setToast(null), 4000);
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Session expiry warning */}
      {sessionMinsLeft !== null && sessionMinsLeft <= 30 && sessionMinsLeft > 0 && (
        <div className="bg-amber-500 text-white text-xs font-bold text-center py-2 px-4">
          ⏳ Session expires in {sessionMinsLeft} minute{sessionMinsLeft !== 1 ? 's' : ''} — staff will need to re-enter their PIN
        </div>
      )}

      {/* Minimal header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-sm mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-vendor-600 flex items-center justify-center">
              <QrCode size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 leading-none">{session.businessName}</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Staff: {session.staffName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-5">

        {/* QR Code — compact */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Show students this QR to earn stamps</p>
          <VendorQRPanel
            vendorId={session.vendorId}
            businessName={session.businessName}
            city={session.city ?? undefined}
          />
        </div>

        {/* Pending rewards */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Gift size={15} className="text-vendor-600" />
              <p className="text-sm font-bold text-gray-900">Pending rewards</p>
              {pending.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pending.length}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : pending.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500">No pending rewards</p>
              <p className="text-xs text-gray-400 mt-1">All rewards have been claimed.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pending.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-vendor-100 flex items-center justify-center flex-shrink-0">
                    <Gift size={16} className="text-vendor-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{r.student_name}</p>
                    <p className="text-xs text-gray-400 line-clamp-1">{r.offer_title}</p>
                    <p className="text-xs font-bold text-vendor-600">{r.reward_label}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <p className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</p>
                    <button
                      onClick={() => handleClaim(r.id)}
                      disabled={claiming === r.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-vendor-600 text-white text-xs font-bold hover:bg-vendor-700 transition-colors disabled:opacity-50"
                    >
                      {claiming === r.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <CheckCircle size={12} />
                      }
                      Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session info */}
        <p className="text-center text-[10px] text-gray-400">
          Logged in as <strong>{session.staffName}</strong> · Session expires in 4 hours
        </p>

      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export default function StaffScanPage() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The HttpOnly cookie is the real session; sessionStorage only remembers
    // the expiry for the countdown banner.
    (async () => {
      try {
        const res = await fetch('/api/staff/session');
        if (res.ok) {
          const data = await res.json();
          let expiresAt = Date.now() + SESSION_TTL;
          try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (raw) expiresAt = JSON.parse(raw).expiresAt ?? expiresAt;
          } catch (_) { /* ignore */ }
          setSession({ ...data.session, expiresAt });
        }
      } catch (_) { /* show PIN entry */ }
      setReady(true);
    })();
  }, []);

  const handleSuccess = (s: StaffSession) => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: s.expiresAt })); } catch (_) { /* ignore */ }
    setSession(s);
  };

  const handleLogout = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* ignore */ }
    fetch('/api/staff/login', { method: 'DELETE' }).catch(() => {});
    setSession(null);
  };

  if (!ready) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-vendor-400" />
    </div>
  );

  if (!session) return <PinEntry onSuccess={handleSuccess} />;
  return <ScanScreen session={session} onLogout={handleLogout} />;
}
