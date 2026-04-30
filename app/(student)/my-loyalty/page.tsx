'use client';

// =============================================================================
// app/(student)/my-loyalty/page.tsx — Student Loyalty Hub
//
// Everything a student needs to use the loyalty platform:
//
//   1. LOYALTY CARD — A big QR code showing their student_profiles.id.
//      They show this to vendors who scan it to award stamps.
//
//   2. MY STAMP CARDS — One card per vendor they've interacted with,
//      showing: vendor name, stamp dots, reward progress, total rewards earned.
//
//   3. REWARDS EARNED — A history of rewards they've unlocked.
//
// The QR code encodes the student's student_profiles.id UUID.
// This is their permanent loyalty card — they never need a different code.
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Stamp, Gift, Star, Coffee, Store,
  Trophy, RefreshCw, AlertCircle, QrCode,
} from 'lucide-react';
import type { StudentProfile, Profile } from '@/lib/types/database.types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoyaltyConfig {
  mode: string;
  required_visits?: number;
  reward_label?: string;
  reward_type?: string;
  reward_value?: number;
}

interface VendorProgress {
  vendor_id: string;
  vendor_name: string;
  logo_url: string | null;
  offer_id: string;
  offer_title: string;
  loyalty_config: LoyaltyConfig | null;
  stamps_in_cycle: number;
  required_visits: number;
  rewards_earned: number;
  last_stamp_at: string | null;
}

// ── Stamp dots ────────────────────────────────────────────────────────────────
function StampRow({ filled, total }: { filled: number; total: number }) {
  const slots = Math.min(total, 10);
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: slots }).map((_, i) => (
        <div
          key={i}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            i < filled
              ? 'bg-brand-500 shadow-sm'
              : 'bg-gray-100 border border-gray-200'
          }`}
        >
          {i < filled && <Stamp size={12} className="text-white" />}
        </div>
      ))}
    </div>
  );
}

// ── Loyalty card skeleton ──────────────────────────────────────────────────────
function LoyaltyCardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-100 rounded w-2/3" />
          <div className="h-2.5 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-7 h-7 rounded-full bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyLoyaltyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loyaltyData, setLoyaltyData] = useState<VendorProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'stamps' | 'rewards'>('stamps');

  // ── Fetch user ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const [pRes, spRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('student_profiles').select('*').eq('user_id', user.id).single(),
      ]);

      setProfile(pRes.data);
      setStudentProfile(spRes.data);
      setLoading(false);
    };
    init();
  }, []);

  // ── Fetch loyalty progress ─────────────────────────────────────────────────
  const fetchLoyalty = async (studentId: string) => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/loyalty/stamp?student_id=${studentId}`);
      if (!res.ok) { setRefreshing(false); return; }
      const { stamps } = await res.json();

      // Group by offer → compute progress per offer
      const grouped: Record<string, {
        vendor_id: string;
        vendor_name: string;
        logo_url: string | null;
        offer_id: string;
        offer_title: string;
        terms: string | null;
        stamps: { status: string; stamped_at: string }[];
      }> = {};

      for (const s of stamps ?? []) {
        const key = s.offer_id;
        if (!grouped[key]) {
          grouped[key] = {
            vendor_id: s.offer?.vendor?.id ?? s.vendor_id,
            vendor_name: s.offer?.vendor?.business_name ?? 'Business',
            logo_url: s.offer?.vendor?.logo_url ?? null,
            offer_id: s.offer_id,
            offer_title: s.offer?.title ?? 'Loyalty Program',
            terms: s.offer?.terms_and_conditions ?? null,
            stamps: [],
          };
        }
        grouped[key].stamps.push({ status: s.status, stamped_at: s.stamped_at });
      }

      const progress: VendorProgress[] = Object.values(grouped).map((g) => {
        // Parse loyalty config
        let config: LoyaltyConfig | null = null;
        if (g.terms) {
          const match = g.terms.match(/^\[\[LOYALTY:(.*?)\]\]/);
          if (match) {
            try { config = JSON.parse(match[1]); } catch { /* ignore */ }
          }
        }

        const required = config?.required_visits ?? 5;
        const totalStamps = g.stamps.filter((s) => ['stamp', 'reward_earned'].includes(s.status)).length;
        const rewardsEarned = g.stamps.filter((s) => s.status === 'reward_earned').length;
        const cyclePos = totalStamps % required;
        const stampsInCycle = cyclePos === 0 && totalStamps > 0 ? required : cyclePos;
        const lastStamp = g.stamps[0]?.stamped_at ?? null;

        return {
          vendor_id: g.vendor_id,
          vendor_name: g.vendor_name,
          logo_url: g.logo_url,
          offer_id: g.offer_id,
          offer_title: g.offer_title,
          loyalty_config: config,
          stamps_in_cycle: stampsInCycle,
          required_visits: required,
          rewards_earned: rewardsEarned,
          last_stamp_at: lastStamp,
        };
      });

      setLoyaltyData(progress);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (studentProfile?.id) {
      fetchLoyalty(studentProfile.id);
    }
  }, [studentProfile?.id]);

  const firstName = profile?.first_name ?? profile?.display_name?.split(' ')[0] ?? 'Student';
  const isVerified = studentProfile?.verification_status === 'verified';
  const totalRewards = loyaltyData.reduce((n, v) => n + v.rewards_earned, 0);

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center animate-pulse">
              <Stamp size={20} className="text-brand-600" />
            </div>
            <p className="text-sm text-gray-500">Loading your loyalty cards…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-6">

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="mb-6">
            <h1 className="text-2xl font-black text-gray-900">My Loyalty Cards</h1>
            <p className="text-gray-500 text-sm mt-1">
              Scan the QR code at any partner business to earn stamps and unlock rewards.
            </p>
          </div>

          {/* ── NOT VERIFIED BANNER ────────────────────────────────────── */}
          {!isVerified && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 mb-5">
              <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-900">Verify to claim your rewards</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You can earn stamps right now — verify your student status to claim rewards and vouchers.
                </p>
                <Link href="/verification" className="mt-2 inline-block text-xs font-bold text-amber-700 underline">
                  Verify now →
                </Link>
              </div>
            </div>
          )}

          {/* ── STATS ROW ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Partners', value: loyaltyData.length, icon: <Store size={14} /> },
              { label: 'Total Stamps', value: loyaltyData.reduce((n, v) => n + v.stamps_in_cycle + (v.rewards_earned * v.required_visits), 0), icon: <Stamp size={14} /> },
              { label: 'Rewards', value: totalRewards, icon: <Gift size={14} /> },
            ].map((s) => (
              <div key={s.label} className="card p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-brand-600 mb-1">
                  {s.icon}
                </div>
                <div className="text-xl font-black text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── TABS ───────────────────────────────────────────────────── */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {[
              { id: 'stamps' as const, label: 'Stamp Cards' },
              { id: 'rewards' as const, label: 'Rewards' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              TAB: STAMP CARDS
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'stamps' && (
            <div className="space-y-4 animate-fade-in">
              {/* Refresh button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{loyaltyData.length} active loyalty {loyaltyData.length === 1 ? 'program' : 'programs'}</p>
                <button
                  onClick={() => studentProfile?.id && fetchLoyalty(studentProfile.id)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 text-xs text-brand-600 font-semibold"
                >
                  <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {refreshing ? (
                <>
                  <LoyaltyCardSkeleton />
                  <LoyaltyCardSkeleton />
                  <LoyaltyCardSkeleton />
                </>
              ) : loyaltyData.length === 0 ? (
                <div className="card p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                    <Coffee size={28} className="text-brand-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">No stamps yet</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Visit a partner business, tap <strong>Earn Stamp</strong> on the dashboard, and scan their QR code at the counter.
                  </p>
                </div>
              ) : (
                loyaltyData.map((vp) => {
                  const pct = (vp.stamps_in_cycle / vp.required_visits) * 100;
                  return (
                    <div key={vp.offer_id} className="card p-5 hover:shadow-md transition-shadow">
                      {/* Vendor header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                          {vp.logo_url ? (
                            <img src={vp.logo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Store size={18} className="text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{vp.vendor_name}</p>
                          <p className="text-xs text-gray-500 truncate">{vp.offer_title}</p>
                        </div>
                        {vp.rewards_earned > 0 && (
                          <div className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full flex-shrink-0">
                            <Trophy size={11} />
                            {vp.rewards_earned}
                          </div>
                        )}
                      </div>

                      {/* Stamp dots */}
                      <StampRow filled={vp.stamps_in_cycle} total={vp.required_visits} />

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-gray-400">
                            {vp.stamps_in_cycle} / {vp.required_visits} stamps
                          </span>
                          <span className="text-xs text-brand-600 font-semibold">
                            {vp.required_visits - vp.stamps_in_cycle === 0
                              ? '🎉 Reward ready!'
                              : `${vp.required_visits - vp.stamps_in_cycle} to go`
                            }
                          </span>
                        </div>
                      </div>

                      {vp.last_stamp_at && (
                        <p className="text-xs text-gray-400 mt-2">
                          Last stamp: {new Date(vp.last_stamp_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: REWARDS
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'rewards' && (
            <div className="space-y-4 animate-fade-in">
              {loyaltyData.filter((v) => v.rewards_earned > 0).length === 0 ? (
                <div className="card p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                    <Gift size={28} className="text-amber-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">No rewards yet</h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Fill up your stamp cards to earn free items and discounts from your favourite businesses.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Trophy size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        {totalRewards} reward{totalRewards !== 1 ? 's' : ''} earned
                      </p>
                      <p className="text-white/80 text-xs">Keep collecting stamps for more</p>
                    </div>
                  </div>

                  {loyaltyData.filter((v) => v.rewards_earned > 0).map((vp) => (
                    <div key={vp.offer_id} className="card p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Star size={18} className="text-amber-600 fill-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900">{vp.loyalty_config?.reward_label ?? 'Free reward'}</p>
                          <p className="text-xs text-gray-500">{vp.vendor_name} · {vp.offer_title}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-amber-600">×{vp.rewards_earned}</span>
                          <p className="text-xs text-gray-400">earned</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
