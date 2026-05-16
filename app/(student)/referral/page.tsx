'use client';

// =============================================================================
// app/(student)/referral/page.tsx — Student Referral Hub
//
// Surfaces everything a student needs to share Unideals with friends:
//
//   1. SHARE CARD — Referral link with one-tap copy + QR code for IRL sharing.
//   2. STATS ROW — Pending / completed referrals + total bonus stamps earned.
//   3. HOW IT WORKS — 3-step explainer.
//   4. FRIENDS LIST — Each referred friend with their status (pending → completed).
//
// Referral link format: /sign-up/student?ref=<CODE>
// Reward: both parties earn 2 bonus stamps when the referred friend claims
// their first deal. Bonus stamps count toward any punch-card progress.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Gift, Copy, Check, Users, Star, Clock,
  ArrowLeft, Loader2, AlertCircle, QrCode,
  Share2, ChevronRight, Stamp,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReferralStats {
  pending:       number;
  completed:     number;
  stamps_earned: number;
}

interface ReferredFriend {
  display_name:      string;
  status:            'pending' | 'completed';
  joined_at:         string;
  reward_granted_at: string | null;
}

interface ReferralData {
  referral_code: string;
  referral_link: string;
  stats:         ReferralStats;
  friends:       ReferredFriend[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Mini QR renderer (uses Google Charts API — no npm dep) ────────────────────
function ReferralQR({ link }: { link: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link)}&bgcolor=1a1040&color=a78bfa&margin=8`;
  return (
    <img
      src={src}
      alt="Referral QR code"
      width={160}
      height={160}
      className="rounded-xl"
    />
  );
}

// ── Friend status pill ────────────────────────────────────────────────────────
function StatusPill({ status }: { status: 'pending' | 'completed' }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2.5 py-0.5">
        <Check className="w-3 h-3" /> +2 stamps earned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-0.5">
      <Clock className="w-3 h-3" /> Awaiting first deal
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReferralPage() {
  const router = useRouter();
  const [data, setData]         = useState<ReferralData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [copied, setCopied]     = useState(false);
  const [showQr, setShowQr]     = useState(false);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/sign-in?redirect=/referral');
    });
  }, [router]);

  // ── Fetch referral data ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/referral');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to load referral data');
      }
      const json: ReferralData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Copy referral link ───────────────────────────────────────────────────
  async function copyLink() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select and copy via execCommand
      const input = document.createElement('input');
      input.value = data.referral_link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  // ── Share via Web Share API (mobile) ────────────────────────────────────
  async function shareLink() {
    if (!data) return;
    if (navigator.share) {
      await navigator.share({
        title: 'Join me on Unideals!',
        text:  'Get exclusive student discounts near campus. Use my link and we both earn bonus stamps when you claim your first deal!',
        url:   data.referral_link,
      }).catch(() => {});
    } else {
      copyLink();
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0b2e]">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0f0b2e]">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 pt-16 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 text-sm mb-4">{error || 'Could not load referral data.'}</p>
          <button
            onClick={fetchData}
            className="text-purple-400 hover:text-white text-sm underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { referral_code, referral_link, stats, friends } = data;

  return (
    <div className="min-h-screen bg-[#0f0b2e]">
      <Navbar />

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-purple-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="w-6 h-6 text-purple-400" />
            Refer a friend
          </h1>
          <p className="text-purple-300 mt-1 text-sm">
            Invite friends to Unideals. When they claim their first deal, you both earn <strong className="text-purple-200">2 bonus stamps</strong>.
          </p>
        </div>

        {/* ── Share card ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-purple-900/60 to-indigo-900/60 border border-purple-500/30 rounded-2xl p-5 space-y-4">

          {/* Code display */}
          <div className="text-center">
            <p className="text-xs text-purple-400 uppercase tracking-widest font-medium mb-1">Your referral code</p>
            <p className="text-3xl font-mono font-bold text-white tracking-widest">{referral_code}</p>
          </div>

          {/* Link box */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
            <span className="text-purple-300 text-xs truncate flex-1 font-mono">
              {referral_link}
            </span>
            <button
              onClick={copyLink}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-purple-300 hover:text-white transition-colors"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied!</span></>
              ) : (
                <><Copy className="w-3.5 h-3.5" />Copy</>
              )}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={shareLink}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              <Share2 className="w-4 h-4" /> Share link
            </button>
            <button
              onClick={() => setShowQr(v => !v)}
              className="flex items-center justify-center gap-2 border border-white/15 hover:border-purple-400 text-purple-300 hover:text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
            >
              <QrCode className="w-4 h-4" /> {showQr ? 'Hide' : 'QR'}
            </button>
          </div>

          {/* QR code — toggle */}
          {showQr && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <ReferralQR link={referral_link} />
              <p className="text-xs text-purple-400">Friends can scan this QR code to sign up</p>
            </div>
          )}
        </div>

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.pending}</p>
            <p className="text-xs text-purple-400 mt-0.5">Pending</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
            <p className="text-xs text-purple-400 mt-0.5">Completed</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-purple-300">{stats.stamps_earned}</p>
              <Stamp className="w-4 h-4 text-purple-400 mb-0.5" />
            </div>
            <p className="text-xs text-purple-400 mt-0.5">Stamps earned</p>
          </div>
        </div>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-400" />
            How it works
          </h2>
          <ol className="space-y-3">
            {[
              {
                step: '1',
                title: 'Share your link',
                desc:  'Send your unique referral link or QR code to a student friend.',
              },
              {
                step: '2',
                title: 'Friend signs up',
                desc:  'They create a free Unideals account using your link.',
              },
              {
                step: '3',
                title: 'Both earn stamps',
                desc:  'When they claim their first deal, you both get 2 bonus stamps — instantly.',
              },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{title}</p>
                  <p className="text-purple-300 text-xs mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Friends list ─────────────────────────────────────────────── */}
        <div>
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Friends you referred
            {friends.length > 0 && (
              <span className="text-xs text-purple-400 font-normal">({friends.length})</span>
            )}
          </h2>

          {friends.length === 0 ? (
            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-8 text-center">
              <Users className="w-8 h-8 text-purple-500/50 mx-auto mb-2" />
              <p className="text-purple-300 text-sm">No referrals yet</p>
              <p className="text-purple-400/70 text-xs mt-1">Share your link above to get started!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map((friend, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                >
                  {/* Avatar initial */}
                  <div className="w-9 h-9 bg-purple-600/40 rounded-full flex items-center justify-center text-purple-200 font-semibold text-sm flex-shrink-0">
                    {friend.display_name[0]?.toUpperCase() ?? '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{friend.display_name}</p>
                    <p className="text-purple-400 text-xs">
                      Joined {formatDate(friend.joined_at)}
                      {friend.reward_granted_at && (
                        <> · Reward {formatDate(friend.reward_granted_at)}</>
                      )}
                    </p>
                  </div>

                  <StatusPill status={friend.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom padding */}
        <div className="h-6" />
      </div>
    </div>
  );
}
