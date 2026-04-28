'use client';

// =============================================================================
// app/(vendor)/dashboard/page.tsx — Vendor Dashboard
//
// The B2B command centre. A coffee shop owner opens this and sees:
//   - 4 KPI metric cards (Views, Redemptions, Conversion Rate, Active Offers)
//   - Quick-access redemption scanner panel
//   - Active offers list with per-offer stats
//   - Recent redemptions activity feed
//   - "Create offer" CTA
//
// Data strategy:
//   - Metrics fetched from the v_vendor_performance_summary view (single join)
//   - Recent redemptions fetched with 24hr window for the activity feed
//   - All counts are denormalised on the DB side — no slow aggregations here
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import MetricCard from '@/components/vendor/MetricCard';
import RedemptionScanner from '@/components/vendor/RedemptionScanner';
import {
  BarChart3, Eye, Tag, Plus, QrCode, TrendingUp,
  Clock, CheckCircle, AlertCircle, ArrowUpRight,
  Store, Sparkles, ChevronRight, BarChart2,
} from 'lucide-react';
import type { VendorProfile, Offer, Redemption } from '@/lib/types/database.types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function conversionRate(views: number, redemptions: number): string {
  if (views === 0) return '—';
  return `${((redemptions / views) * 100).toFixed(1)}%`;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Offer row in the active offers list ──────────────────────────────────────
function OfferRow({ offer }: { offer: Offer }) {
  const convRate = conversionRate(offer.view_count, offer.redemption_count);

  const statusConfig: Record<string, { label: string; dot: string }> = {
    active:   { label: 'Active',   dot: 'bg-vendor-500' },
    paused:   { label: 'Paused',   dot: 'bg-yellow-400' },
    draft:    { label: 'Draft',    dot: 'bg-gray-300'   },
    expired:  { label: 'Expired',  dot: 'bg-red-400'    },
    depleted: { label: 'Depleted', dot: 'bg-orange-400' },
  };
  const sc = statusConfig[offer.status] ?? statusConfig.draft;

  return (
    <Link
      href={`/vendor/offers/${offer.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-xl transition-colors group"
    >
      {/* Discount badge */}
      <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 text-brand-700 text-xs font-black text-center leading-tight px-1">
        {offer.discount_label}
      </div>

      {/* Offer info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{offer.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          <span className="text-xs text-gray-500">{sc.label}</span>
          {offer.expires_at && (
            <span className="text-xs text-gray-400">
              · Expires {new Date(offer.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-5 text-right flex-shrink-0">
        <div>
          <p className="text-sm font-bold text-gray-900">{formatNumber(offer.view_count)}</p>
          <p className="text-xs text-gray-400">Views</p>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">{formatNumber(offer.redemption_count)}</p>
          <p className="text-xs text-gray-400">Redeemed</p>
        </div>
        <div>
          <p className={`text-sm font-bold ${offer.view_count > 0 ? 'text-vendor-600' : 'text-gray-400'}`}>
            {convRate}
          </p>
          <p className="text-xs text-gray-400">Conv.</p>
        </div>
      </div>

      <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
    </Link>
  );
}

// ── Redemption activity item ──────────────────────────────────────────────────
function ActivityItem({ r }: { r: Redemption & { offer?: { title: string } } }) {
  const isConfirmed = r.status === 'confirmed';
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isConfirmed ? 'bg-vendor-100 text-vendor-600' : 'bg-gray-100 text-gray-400'
      }`}>
        {isConfirmed ? <CheckCircle size={15} /> : <Clock size={15} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 font-medium truncate">
          {r.offer?.title ?? 'Offer claimed'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">
          {isConfirmed ? 'Redeemed in store' : 'Code claimed · awaiting scan'}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-xs font-semibold ${isConfirmed ? 'text-vendor-600' : 'text-gray-400'}`}>
          {isConfirmed ? '✓ Confirmed' : '⏳ Pending'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(r.claimed_at)}</p>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function VendorDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [recentRedemptions, setRecentRedemptions] = useState<
    (Redemption & { offer?: { title: string } })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Fetch vendor profile (denormalised metrics live here)
      const { data: vp } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!vp) { router.push('/vendor/profile'); return; }
      setVendorProfile(vp);

      // Fetch active + draft offers
      const { data: offerData } = await supabase
        .from('offers')
        .select('*')
        .eq('vendor_id', vp.id)
        .in('status', ['active', 'draft', 'paused'])
        .order('created_at', { ascending: false })
        .limit(10);
      setOffers(offerData ?? []);

      // Fetch recent redemptions (last 72 hours)
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data: redemptionData } = await supabase
        .from('redemptions')
        .select('*, offer:offers(title)')
        .eq('vendor_id', vp.id)
        .gte('claimed_at', cutoff)
        .order('claimed_at', { ascending: false })
        .limit(20);
      setRecentRedemptions(redemptionData ?? []);

      setLoading(false);
    };
    fetchData();
  }, []);

  const vp = vendorProfile;
  const convRate = vp ? conversionRate(vp.total_lifetime_views, vp.total_lifetime_redemptions) : '—';
  const activeOffersCount = offers.filter((o) => o.status === 'active').length;
  const pendingCount = recentRedemptions.filter((r) => r.status === 'claimed').length;

  return (
    <>
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
                {vp?.city ?? 'Local business'} · {vp?.plan_tier ?? 'free'} plan
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Scan code button — prominent */}
              <button
                onClick={() => setScannerOpen(true)}
                className="btn-vendor flex-shrink-0"
              >
                <QrCode size={16} />
                Scan voucher
              </button>
              <Link href="/vendor/offers/create" className="btn-secondary flex-shrink-0">
                <Plus size={16} />
                New offer
              </Link>
            </div>
          </div>

          {/* ── UNVERIFIED BUSINESS WARNING ──────────────────────────────── */}
          {vp && !vp.is_verified && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 mb-6">
              <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Your business is pending verification</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  We&apos;ll review your details within 24 hours. Your offers won&apos;t be visible to students until then.
                </p>
              </div>
            </div>
          )}

          {/* ── KPI METRIC CARDS ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              title="Total Views"
              value={formatNumber(vp?.total_lifetime_views ?? 0)}
              subLabel="All-time offer impressions"
              icon={<Eye size={17} />}
              accentColor="blue"
              loading={loading}
            />
            <MetricCard
              title="Redemptions"
              value={formatNumber(vp?.total_lifetime_redemptions ?? 0)}
              subLabel="Confirmed in-store visits"
              icon={<CheckCircle size={17} />}
              accentColor="green"
              loading={loading}
            />
            <MetricCard
              title="Conversion Rate"
              value={convRate}
              subLabel="Views → confirmed visits"
              icon={<TrendingUp size={17} />}
              accentColor="purple"
              loading={loading}
            />
            <MetricCard
              title="Active Offers"
              value={activeOffersCount}
              subLabel={`${pendingCount} pending confirmation`}
              icon={<Tag size={17} />}
              accentColor="amber"
              loading={loading}
            />
          </div>

          {/* ── MAIN GRID: Offers + Activity ─────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── LEFT COL: Active Offers (2/3 width) ──────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Active offers list */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Tag size={15} className="text-gray-500" />
                    <h2 className="font-bold text-gray-900">Your Offers</h2>
                  </div>
                  <Link href="/vendor/offers" className="text-xs text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1">
                    Manage all
                    <ArrowUpRight size={12} />
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
                    <p className="text-sm font-semibold text-gray-700 mb-1">No offers yet</p>
                    <p className="text-xs text-gray-400 mb-4">Create your first student discount to start driving foot traffic.</p>
                    <Link href="/vendor/offers/create" className="btn-vendor text-sm px-5 py-2.5 inline-flex">
                      <Plus size={14} />
                      Create first offer
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 px-2">
                    {offers.map((offer) => (
                      <OfferRow key={offer.id} offer={offer} />
                    ))}
                  </div>
                )}
              </div>

              {/* Analytics CTA for higher plan tiers */}
              {vp?.plan_tier === 'free' && (
                <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <BarChart3 size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">Unlock full analytics</p>
                    <p className="text-white/70 text-xs mt-0.5">Peak hours, university breakdown, and Looker Studio export.</p>
                  </div>
                  <Link href="/vendor/upgrade" className="flex-shrink-0 bg-white text-brand-700 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-brand-50 transition-colors whitespace-nowrap">
                    Upgrade →
                  </Link>
                </div>
              )}
            </div>

            {/* ── RIGHT COL: Activity Feed (1/3 width) ─────────────────── */}
            <div className="space-y-4">

              {/* Recent activity */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={15} className="text-gray-500" />
                    <h2 className="font-bold text-gray-900">Recent Activity</h2>
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
                  ) : recentRedemptions.length === 0 ? (
                    <div className="py-12 text-center">
                      <Clock size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">No activity in the last 72 hours.</p>
                      <p className="text-xs text-gray-400 mt-0.5">Publish an offer to attract students.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {recentRedemptions.slice(0, 8).map((r) => (
                        <ActivityItem key={r.id} r={r} />
                      ))}
                    </div>
                  )}
                </div>

                {recentRedemptions.length > 8 && (
                  <div className="px-5 py-3 border-t border-gray-100">
                    <Link href="/vendor/analytics" className="text-xs text-brand-600 font-semibold hover:text-brand-700">
                      View full history →
                    </Link>
                  </div>
                )}
              </div>

              {/* Quick tip card */}
              <div className="card p-4 bg-vendor-50 border-vendor-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-vendor-200 flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={15} className="text-vendor-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-vendor-900 mb-1">📊 Connect to Looker Studio</p>
                    <p className="text-xs text-vendor-700 leading-relaxed">
                      Your data is ready. Use Supabase PostgreSQL credentials to build professional ROI dashboards.
                    </p>
                    <Link href="/vendor/analytics" className="mt-2 text-xs font-bold text-vendor-700 hover:text-vendor-900 underline underline-offset-2 block">
                      Set up analytics →
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── REDEMPTION SCANNER MODAL ──────────────────────────────────────── */}
      {scannerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setScannerOpen(false); }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="font-black text-gray-900 text-lg">Confirm Voucher</h2>
                <p className="text-xs text-gray-500 mt-0.5">Scan or enter the student&apos;s code</p>
              </div>
              <button
                onClick={() => setScannerOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <RedemptionScanner />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
