'use client';

// =============================================================================
// app/(vendor)/vendor/page.tsx — Vendor Loyalty Dashboard
//
// The LOYALTY-FIRST command centre for a vendor.
// Core purpose: scan student QR codes to award stamps.
//
// Layout:
//   - Big "Scan Student" primary CTA (always visible at top)
//   - 4 KPI cards: Active Members, Stamps Today, Rewards Given, Active Programs
//   - Active loyalty programs list (with stamp-rate sparklines)
//   - Recent stamp activity feed (who visited, when, what progress)
//   - "Create loyalty program" prompt if none exist
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import AdminPreviewBanner from '@/components/shared/AdminPreviewBanner';
import OnboardingChecklist from '@/components/vendor/OnboardingChecklist';
import VendorNav from '@/components/vendor/VendorNav';
import MetricCard from '@/components/vendor/MetricCard';
import VendorQRPanel from '@/components/vendor/VendorQRPanel';
import {
  Plus, ChevronRight, Store,
  Stamp, Gift, Users, TrendingUp, Trophy,
  AlertCircle, Sparkles, Tag, Clock,
  CheckCircle,
} from 'lucide-react';
import type { VendorProfile, Offer, Redemption } from '@/lib/types/database.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function parseLoyaltyConfig(terms: string | null) {
  if (!terms) return null;
  const match = terms.match(/^\[\[LOYALTY:(.*?)\]\]/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// ── Offer row ─────────────────────────────────────────────────────────────────
function LoyaltyProgramRow({ offer }: { offer: Offer }) {
  const config = parseLoyaltyConfig(offer.terms_and_conditions ?? null);
  const required = config?.required_visits ?? 5;
  const rewardLabel = config?.reward_label ?? 'Reward';
  const mode = config?.mode ?? 'standard';

  const modeLabel: Record<string, string> = {
    punch_card: 'Punch Card',
    first_visit: 'First Visit',
    milestone: 'Milestone',
    standard: 'Discount',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-vendor-500',
    paused: 'bg-yellow-400',
    draft: 'bg-gray-300',
    expired: 'bg-red-400',
  };

  return (
    <Link
      href={`/vendor/offers/${offer.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-colors group"
    >
      <div className="w-12 h-12 rounded-xl bg-vendor-100 flex items-center justify-center flex-shrink-0">
        <Gift size={20} className="text-vendor-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{offer.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColors[offer.status] ?? 'bg-gray-300'}`} />
          <span className="text-xs text-gray-500">{modeLabel[mode]}</span>
          {config && (
            <span className="text-xs text-gray-400">
              · {required} stamps → {rewardLabel}
            </span>
          )}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-5 text-right flex-shrink-0">
        <div>
          <p className="text-sm font-bold text-gray-900">{formatNumber(offer.redemption_count)}</p>
          <p className="text-xs text-gray-400">Stamps</p>
        </div>
      </div>
      <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
    </Link>
  );
}

// ── Recent stamp item ──────────────────────────────────────────────────────────
function StampItem({ r }: { r: Redemption & { offer?: { title: string } } }) {
  const isReward = r.status === 'reward_earned';
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isReward ? 'bg-amber-100 text-amber-600' : 'bg-vendor-100 text-vendor-600'
      }`}>
        {isReward ? <Trophy size={15} /> : <Stamp size={15} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 font-medium truncate">
          {r.offer?.title ?? 'Loyalty stamp'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {isReward ? '🎉 Reward unlocked!' : 'Stamp logged'}
        </p>
      </div>
      <p className="text-xs text-gray-400 flex-shrink-0">
        {timeAgo(r.confirmed_at ?? r.claimed_at)}
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VendorDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [recentStamps, setRecentStamps] = useState<(Redemption & { offer?: { title: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayStamps, setTodayStamps] = useState(0);
  const [rewardsGiven, setRewardsGiven] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Check role — admin can preview vendor pages
      const { data: profileData } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();
      const isAdmin = profileData?.role === 'admin';

      const { data: vp } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!vp && !isAdmin) { router.push('/vendor/profile'); return; }
      if (vp) setVendorProfile(vp);

      // Fetch active loyalty programs
      const { data: offerData } = await supabase
        .from('offers')
        .select('*')
        .eq('vendor_id', vp.id)
        .in('status', ['active', 'draft', 'paused'])
        .order('created_at', { ascending: false })
        .limit(10);
      setOffers(offerData ?? []);

      // Fetch recent stamp activity (last 72h)
      const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data: stampData } = await supabase
        .from('redemptions')
        .select('*, offer:offers(title)')
        .eq('vendor_id', vp.id)
        .in('status', ['stamp', 'reward_earned'])
        .gte('confirmed_at', cutoff72h)
        .order('confirmed_at', { ascending: false })
        .limit(20);
      setRecentStamps(stampData ?? []);

      // Today's stamp count
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vp.id)
        .in('status', ['stamp', 'reward_earned'])
        .gte('confirmed_at', midnight.toISOString());
      setTodayStamps(todayCount ?? 0);

      // Total rewards given
      const { count: rewardCount } = await supabase
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vp.id)
        .eq('status', 'reward_earned');
      setRewardsGiven(rewardCount ?? 0);

      setLoading(false);
    };

    fetchData();
  }, []);

  const vp = vendorProfile;
  const activePrograms = offers.filter((o) => o.status === 'active').length;
  const hasLoyaltyProgram = offers.some(
    (o) => parseLoyaltyConfig(o.terms_and_conditions ?? null) !== null
  );

  return (
    <>
      <AdminPreviewBanner />
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* ── PAGE HEADER ──────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                {vp?.business_name ?? 'Your Dashboard'}
              </h1>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
                <Store size={13} />
                Loyalty Platform · {vp?.city ?? 'Your city'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/vendor/offers/create" className="btn-vendor flex-shrink-0">
                <Plus size={16} />
                New Program
              </Link>
            </div>
          </div>

          {/* ── ONBOARDING CHECKLIST ─────────────────────────────────────── */}
          {vp && <OnboardingChecklist vendorId={vp.id} />}

          {/* ── UNVERIFIED WARNING ────────────────────────────────────────── */}
          {vp && !vp.is_verified && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 mb-6">
              <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Business pending verification</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your loyalty programs won&apos;t be visible to students until we verify your business details. Usually within 24 hours.
                </p>
              </div>
            </div>
          )}

          {/* ── NO LOYALTY PROGRAM NUDGE ─────────────────────────────────── */}
          {!loading && !hasLoyaltyProgram && (
            <div className="bg-gradient-to-r from-vendor-600 to-vendor-700 rounded-2xl p-5 flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Gift size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold">Create your first loyalty program</p>
                <p className="text-white/70 text-xs mt-0.5">
                  Set up a punch card, milestone reward, or first-visit discount to start building student loyalty.
                </p>
              </div>
              <Link
                href="/vendor/offers/create"
                className="flex-shrink-0 bg-white text-vendor-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-vendor-50 transition-colors whitespace-nowrap"
              >
                Get started →
              </Link>
            </div>
          )}

          {/* ── KPI CARDS ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              title="Active Members"
              value={formatNumber(vp?.total_lifetime_redemptions ?? 0)}
              subLabel="Students with stamps"
              icon={<Users size={17} />}
              accentColor="blue"
              loading={loading}
            />
            <MetricCard
              title="Stamps Today"
              value={todayStamps}
              subLabel="Scans logged today"
              icon={<Stamp size={17} />}
              accentColor="green"
              loading={loading}
            />
            <MetricCard
              title="Rewards Given"
              value={rewardsGiven}
              subLabel="Total free rewards earned"
              icon={<Gift size={17} />}
              accentColor="amber"
              loading={loading}
            />
            <MetricCard
              title="Active Programs"
              value={activePrograms}
              subLabel="Live loyalty programs"
              icon={<Tag size={17} />}
              accentColor="purple"
              loading={loading}
            />
          </div>

          {/* ── MAIN GRID ────────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* LEFT: Loyalty programs (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Gift size={15} className="text-gray-500" />
                    <h2 className="font-bold text-gray-900">Loyalty Programs</h2>
                  </div>
                  <Link href="/vendor/offers" className="text-xs text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1">
                    Manage all
                    <ChevronRight size={12} />
                  </Link>
                </div>

                {loading ? (
                  <div className="divide-y divide-gray-100">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                        <div className="w-12 h-12 rounded-xl bg-gray-100" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-gray-100 rounded w-3/4" />
                          <div className="h-2 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : offers.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="inline-flex w-14 h-14 rounded-2xl bg-gray-100 items-center justify-center mb-4">
                      <Sparkles size={22} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">No programs yet</p>
                    <p className="text-xs text-gray-400 mb-4">
                      Create a punch card, milestone reward, or first-visit discount.
                    </p>
                    <Link href="/vendor/offers/create" className="btn-vendor text-sm px-5 py-2.5 inline-flex">
                      <Plus size={14} />
                      Create loyalty program
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 px-2">
                    {offers.map((offer) => (
                      <LoyaltyProgramRow key={offer.id} offer={offer} />
                    ))}
                  </div>
                )}
              </div>

              {/* Analytics CTA */}
              <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">See your loyalty analytics</p>
                  <p className="text-white/70 text-xs mt-0.5">
                    Peak stamp hours, top students, reward conversion rates.
                  </p>
                </div>
                <Link
                  href="/vendor/analytics"
                  className="flex-shrink-0 bg-white text-brand-700 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-brand-50 transition-colors whitespace-nowrap"
                >
                  Analytics →
                </Link>
              </div>
            </div>

            {/* RIGHT: Recent activity (1/3 width) */}
            <div className="space-y-4">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-gray-500" />
                    <h2 className="font-bold text-gray-900">Recent Stamps</h2>
                  </div>
                  <span className="text-xs text-gray-400">Last 72h</span>
                </div>

                <div className="px-4">
                  {loading ? (
                    <div className="py-4 space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                            <div className="h-2 bg-gray-100 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentStamps.length === 0 ? (
                    <div className="py-12 text-center">
                      <Stamp size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No stamps in the last 72 hours.</p>
                      <p className="text-xs text-gray-400 mt-0.5">Scan a student card to get started.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {recentStamps.slice(0, 8).map((r) => (
                        <StampItem key={r.id} r={r} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Vendor QR Code — students scan this to earn stamps */}
              {vp && (
                <VendorQRPanel
                  vendorId={vp.id}
                  businessName={vp.business_name}
                  city={vp.city ?? undefined}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
