'use client';

// =============================================================================
// app/stamp/[vendorId]/page.tsx — Student QR Stamp Landing Page
//
// This is where students land after scanning a vendor's QR code.
// Flow:
//   1. Auth check  → if not logged in, redirect to /sign-in?next=/stamp/xxx
//   2. Profile check → fetch student_profile to check verification_status
//   3. Vendor info → fetch vendor_profiles to show business name/logo/city
//   4. Stamp earn  → POST /api/loyalty/stamp on button press
//   5. Success UI  → animated stamp count, reward celebration if triggered
//   6. Rate-limit  → countdown timer showing when next stamp is allowed
// =============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Stamp, Coffee, CheckCircle2, Clock, AlertCircle,
  GraduationCap, Star, Zap, Gift, ArrowRight, Loader2,
  MapPin, ChevronLeft, RefreshCw, Trophy, Sparkles,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface VendorInfo {
  id: string;
  business_name: string;
  city: string | null;
  logo_url: string | null;
  is_approved: boolean;
}

interface ActiveOffer {
  id: string;
  title: string;
  required_visits: number;
  reward_label: string;
  is_active: boolean;
}

type PageState =
  | 'loading'         // checking auth + loading vendor
  | 'unauthenticated' // not logged in
  | 'unverified'      // logged in but student not verified
  | 'ready'           // ready to stamp
  | 'stamping'        // POST in flight
  | 'success'         // stamp earned
  | 'reward'          // reward triggered
  | 'rate_limited'    // cooldown active
  | 'vendor_not_found'
  | 'no_offer'        // vendor has no active loyalty programme
  | 'error';          // generic error

interface StampResult {
  vendor_name: string;
  vendor_logo: string | null;
  vendor_city: string | null;
  offer_title: string;
  stamps_in_cycle: number;
  required_visits: number;
  stamps_awarded: number;
  reward_triggered: boolean;
  reward_label: string;
  is_first_visit: boolean;
  double_stamp: boolean;
  bonus_stamps: number;
  tier_rewards: { stamps: number; reward_label: string; reward_type: string; reward_value: string }[];
  stamped_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Stamp progress dots ───────────────────────────────────────────────────────

function StampDots({ filled, total }: { filled: number; total: number }) {
  const dots = Math.min(total, 12); // cap display at 12
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-xs mx-auto">
      {Array.from({ length: dots }).map((_, i) => (
        <div
          key={i}
          className={`
            w-9 h-9 rounded-full flex items-center justify-center
            transition-all duration-500
            ${i < filled
              ? 'bg-brand-600 shadow-lg shadow-brand-200 scale-110'
              : 'bg-gray-100 border-2 border-dashed border-gray-300'
            }
          `}
          style={{ transitionDelay: `${i * 40}ms` }}
        >
          {i < filled && <Stamp size={16} className="text-white" />}
        </div>
      ))}
    </div>
  );
}

// ── Animated stamp celebration ────────────────────────────────────────────────

function StampCelebration({ double: isDouble }: { double: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-28 h-28 mx-auto mb-4">
      {/* Pulse rings */}
      <div className="absolute inset-0 rounded-full bg-brand-100 animate-ping opacity-40" />
      <div className="absolute inset-2 rounded-full bg-brand-200 animate-ping opacity-30" style={{ animationDelay: '150ms' }} />
      {/* Main circle */}
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-xl shadow-brand-300">
        {isDouble
          ? <Zap size={36} className="text-white" />
          : <CheckCircle2 size={36} className="text-white" />
        }
      </div>
    </div>
  );
}

// ── Reward celebration ────────────────────────────────────────────────────────

function RewardCelebration() {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 mx-auto mb-4">
      <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-50" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-300">
        <Trophy size={40} className="text-white" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StampPage() {
  const params = useParams();
  const vendorId = params?.vendorId as string;
  const router = useRouter();
  const supabase = createClient();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null);
  const [stampResult, setStampResult] = useState<StampResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [nextAllowedAt, setNextAllowedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // ── Countdown ticker ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nextAllowedAt) return;

    const tick = () => {
      const ms = nextAllowedAt.getTime() - Date.now();
      if (ms <= 0) {
        setCountdown('');
        setPageState('ready');
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else {
        setCountdown(formatCountdown(ms));
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [nextAllowedAt]);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;

    const init = async () => {
      try {
        // 1. Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!user) {
          setPageState('unauthenticated');
          return;
        }

        // 2. Student profile check
        const { data: sp } = await supabase
          .from('student_profiles')
          .select('verification_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (!sp || sp.verification_status !== 'verified') {
          setPageState('unverified');
          return;
        }

        // 3. Vendor info
        const { data: vp } = await supabase
          .from('vendor_profiles')
          .select('id, business_name, city, logo_url, is_approved')
          .eq('id', vendorId)
          .maybeSingle();

        if (cancelled) return;

        if (!vp) {
          setPageState('vendor_not_found');
          return;
        }

        if (!vp.is_approved) {
          setPageState('error');
          setErrorMsg('This vendor is not yet approved on STUD-DEALS.');
          return;
        }

        setVendor(vp);

        // 4. Active offer
        const { data: offer } = await supabase
          .from('offers')
          .select('id, title, required_visits, reward_label, is_active')
          .eq('vendor_id', vendorId)
          .eq('offer_type', 'punch_card')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (!offer) {
          setPageState('no_offer');
          return;
        }

        setActiveOffer(offer);
        setPageState('ready');
      } catch (_) {
        if (!cancelled) {
          setPageState('error');
          setErrorMsg('Something went wrong loading this page. Please try again.');
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [vendorId]);

  // ── Earn stamp ───────────────────────────────────────────────────────────────
  const earnStamp = useCallback(async () => {
    if (!vendorId || pageState !== 'ready') return;
    setPageState('stamping');
    setErrorMsg('');

    try {
      const res = await fetch('/api/loyalty/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId }),
      });

      const json = await res.json();

      if (res.status === 429) {
        // Rate limited
        const next = json.next_allowed_at ? new Date(json.next_allowed_at) : null;
        setNextAllowedAt(next);
        setPageState('rate_limited');
        return;
      }

      if (res.status === 401) {
        setPageState('unauthenticated');
        return;
      }

      if (res.status === 404) {
        if (json.error?.includes('profile')) {
          setPageState('unverified');
        } else {
          setPageState('vendor_not_found');
        }
        return;
      }

      if (!res.ok) {
        setPageState('error');
        setErrorMsg(json.error ?? 'Could not earn stamp. Please try again.');
        return;
      }

      // Success
      setStampResult(json);
      setPageState(json.reward_triggered ? 'reward' : 'success');
    } catch (_) {
      setPageState('error');
      setErrorMsg('Network error. Please check your connection and try again.');
    }
  }, [vendorId, pageState]);

  // ── Render ───────────────────────────────────────────────────────────────────

  // Shared header card
  const VendorHeader = () => (
    <div className="text-center mb-8">
      {/* Logo or placeholder */}
      {vendor?.logo_url ? (
        <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-3 shadow-md">
          <Image
            src={vendor.logo_url}
            alt={vendor.business_name}
            width={80}
            height={80}
            className="object-cover w-full h-full"
          />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 mx-auto mb-3 shadow-md flex items-center justify-center">
          <Coffee size={32} className="text-white" />
        </div>
      )}
      <h1 className="text-2xl font-black text-gray-900">{vendor?.business_name ?? 'Loading…'}</h1>
      {vendor?.city && (
        <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
          <MapPin size={12} /> {vendor.city}
        </p>
      )}
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-brand-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </main>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────────────────
  if (pageState === 'unauthenticated') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 mx-auto mb-4 flex items-center justify-center shadow-lg">
              <GraduationCap size={36} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Sign in to earn stamps</h1>
            <p className="text-gray-500 text-sm">Join STUD-DEALS and collect loyalty stamps at hundreds of student-friendly spots.</p>
          </div>
          <Link
            href={`/sign-in?next=/stamp/${vendorId}`}
            className="block w-full py-4 bg-brand-600 text-white font-bold text-center rounded-2xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href={`/sign-up?next=/stamp/${vendorId}`}
            className="block w-full py-3 mt-3 border-2 border-brand-200 text-brand-700 font-bold text-center rounded-2xl hover:bg-brand-50 transition-colors"
          >
            Create account
          </Link>
        </div>
      </main>
    );
  }

  // ── Unverified ───────────────────────────────────────────────────────────────
  if (pageState === 'unverified') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <GraduationCap size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Verify your student status</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            STUD-DEALS is exclusively for verified students. It only takes 60 seconds — then you can earn stamps here and at hundreds of other spots.
          </p>
          <Link
            href={`/verification?next=/stamp/${vendorId}`}
            className="block w-full py-4 bg-amber-500 text-white font-bold text-center rounded-2xl shadow-lg shadow-amber-200 hover:bg-amber-600 transition-colors"
          >
            Verify now — it's free
          </Link>
          <Link href="/dashboard" className="block mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ── Vendor not found ─────────────────────────────────────────────────────────
  if (pageState === 'vendor_not_found') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-gray-200 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle size={36} className="text-gray-400" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Venue not found</h1>
          <p className="text-gray-500 text-sm mb-6">This QR code doesn't match any active venue on STUD-DEALS. It may have been removed or the link is incorrect.</p>
          <Link href="/dashboard" className="block w-full py-4 bg-brand-600 text-white font-bold text-center rounded-2xl">
            Browse deals
          </Link>
        </div>
      </main>
    );
  }

  // ── No active offer ──────────────────────────────────────────────────────────
  if (pageState === 'no_offer') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <VendorHeader />
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
            <Star size={32} className="text-gray-300 mx-auto mb-3" />
            <h2 className="font-bold text-gray-700 mb-2">No active loyalty programme</h2>
            <p className="text-sm text-gray-400">This venue doesn't have an active punch card right now. Check back soon!</p>
          </div>
          <Link href="/dashboard" className="block mt-4 text-center text-sm text-brand-600 font-semibold hover:text-brand-700">
            ← Back to deals
          </Link>
        </div>
      </main>
    );
  }

  // ── Generic error ────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-red-100 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle size={36} className="text-red-400" />
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 text-sm mb-6">{errorMsg || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => { setPageState('loading'); setErrorMsg(''); window.location.reload(); }}
            className="flex items-center gap-2 mx-auto px-6 py-3 bg-brand-600 text-white font-bold rounded-xl"
          >
            <RefreshCw size={16} /> Try again
          </button>
        </div>
      </main>
    );
  }

  // ── Rate limited ─────────────────────────────────────────────────────────────
  if (pageState === 'rate_limited') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <VendorHeader />
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-orange-100">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <Clock size={28} className="text-orange-500" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Come back soon!</h2>
            <p className="text-gray-500 text-sm mb-4">
              You've already earned a stamp here recently. Stamps are limited to one per visit to keep things fair.
            </p>
            {countdown && (
              <div className="bg-orange-50 rounded-xl px-4 py-3 mb-4">
                <p className="text-xs text-orange-600 font-medium mb-1">Next stamp available in</p>
                <p className="text-3xl font-black text-orange-700 tabular-nums">{countdown}</p>
              </div>
            )}
            <p className="text-xs text-gray-400">Come back after your next visit to earn your next stamp.</p>
          </div>
          <Link href="/dashboard" className="block mt-4 text-center text-sm text-brand-600 font-semibold hover:text-brand-700">
            ← Browse more deals
          </Link>
        </div>
      </main>
    );
  }

  // ── Success / Reward ─────────────────────────────────────────────────────────
  if (pageState === 'success' || pageState === 'reward') {
    const r = stampResult!;
    const isReward = pageState === 'reward';

    return (
      <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          {/* Back link */}
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
            <ChevronLeft size={16} /> Dashboard
          </Link>

          {/* Vendor header */}
          <VendorHeader />

          {/* Celebration animation */}
          {isReward ? <RewardCelebration /> : <StampCelebration double={r.double_stamp} />}

          {/* Title */}
          {isReward ? (
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-gray-900 mb-1">Reward unlocked! 🎉</h2>
              <p className="text-sm text-gray-500">Show this screen to the staff member</p>
            </div>
          ) : (
            <div className="text-center mb-6">
              {r.is_first_visit ? (
                <>
                  <h2 className="text-2xl font-black text-gray-900 mb-1">Welcome! First stamp earned 🎉</h2>
                  <p className="text-sm text-gray-500">You've joined {r.vendor_name}'s loyalty programme</p>
                </>
              ) : r.double_stamp ? (
                <>
                  <h2 className="text-2xl font-black text-gray-900 mb-1">Double stamp! ⚡️</h2>
                  <p className="text-sm text-gray-500">You earned 2 stamps this visit</p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-black text-gray-900 mb-1">Stamp earned!</h2>
                  <p className="text-sm text-gray-500">{r.offer_title}</p>
                </>
              )}
            </div>
          )}

          {/* Main card */}
          <div className={`rounded-2xl p-5 mb-4 shadow-sm border ${
            isReward
              ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
              : 'bg-white border-gray-100'
          }`}>
            {isReward ? (
              /* Reward earned */
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 rounded-full px-4 py-2 font-black text-sm mb-4">
                  <Gift size={16} /> {r.reward_label}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  You've completed all <strong>{r.required_visits} stamps</strong> — your free reward is waiting at the counter!
                </p>
                {/* Completed dots */}
                <StampDots filled={r.required_visits} total={r.required_visits} />
              </div>
            ) : (
              /* Progress */
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">
                  <span className="font-black text-brand-700 text-xl">{r.stamps_in_cycle}</span>
                  <span className="text-gray-400"> / {r.required_visits} stamps</span>
                </p>
                <StampDots filled={r.stamps_in_cycle} total={r.required_visits} />
                {r.stamps_in_cycle < r.required_visits && (
                  <p className="text-xs text-gray-400 mt-3">
                    {r.required_visits - r.stamps_in_cycle} more {r.required_visits - r.stamps_in_cycle === 1 ? 'visit' : 'visits'} until your{' '}
                    <strong className="text-gray-600">{r.reward_label}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tier rewards if any */}
          {r.tier_rewards && r.tier_rewards.length > 0 && !isReward && (
            <div className="bg-white rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles size={12} /> Tier rewards
              </p>
              <div className="space-y-2">
                {r.tier_rewards.map((tr, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Stamp size={14} className="text-brand-400" />
                      <span>{tr.stamps} stamps</span>
                    </div>
                    <span className="font-semibold text-gray-700">{tr.reward_label}</span>
                    {r.stamps_in_cycle >= tr.stamps && (
                      <CheckCircle2 size={14} className="text-green-500 ml-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bonus stamp note */}
          {r.bonus_stamps > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm text-blue-700">
              <Zap size={16} className="flex-shrink-0 text-blue-500" />
              <span>+{r.bonus_stamps} bonus {r.bonus_stamps === 1 ? 'stamp' : 'stamps'} applied!</span>
            </div>
          )}

          {/* CTA */}
          <Link
            href="/loyalty"
            className="block w-full py-4 bg-brand-600 text-white font-bold text-center rounded-2xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition-colors"
          >
            View all my loyalty cards
          </Link>
          <Link href="/dashboard" className="block mt-3 text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Back to deals
          </Link>
        </div>
      </main>
    );
  }

  // ── Ready state (default) ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Back link */}
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors">
          <ChevronLeft size={16} /> Dashboard
        </Link>

        <VendorHeader />

        {/* Active offer card */}
        {activeOffer && (
          <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Star size={12} /> Active loyalty programme
            </p>
            <h3 className="font-black text-gray-900 text-lg mb-1">{activeOffer.title}</h3>
            <p className="text-sm text-gray-500 mb-4">
              Collect {activeOffer.required_visits} stamps → earn{' '}
              <strong className="text-brand-700">{activeOffer.reward_label}</strong>
            </p>
            {/* Empty punch grid preview */}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: Math.min(activeOffer.required_visits, 10) }).map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center"
                >
                  <Stamp size={13} className="text-gray-300" />
                </div>
              ))}
              {activeOffer.required_visits > 10 && (
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
                  +{activeOffer.required_visits - 10}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Earn stamp CTA */}
        <button
          onClick={earnStamp}
          disabled={pageState === 'stamping'}
          className="w-full py-5 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-brand-300 hover:shadow-brand-400 hover:from-brand-700 hover:to-brand-800 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {pageState === 'stamping' ? (
            <>
              <Loader2 size={22} className="animate-spin" />
              Earning stamp…
            </>
          ) : (
            <>
              <Stamp size={22} />
              Earn stamp
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4 leading-relaxed">
          One stamp per visit · 8-hour cooldown between stamps<br/>
          Exclusive to verified STUD-DEALS members
        </p>
      </div>
    </main>
  );
}
