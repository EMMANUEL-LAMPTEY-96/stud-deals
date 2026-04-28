'use client';

// =============================================================================
// app/(vendor)/vendor/analytics/page.tsx — Analytics
//
// Data sources:
//   - v_vendor_performance_summary → headline KPI cards
//   - v_monthly_redemption_trend   → monthly line chart (recharts)
//   - v_redemptions_by_day_of_week → day-of-week bar chart
//   - v_redemptions_by_hour        → peak-hours bar chart
//   - v_redemptions_by_institution → institution breakdown table
//   - offers (raw)                 → top performing offers table
//
// Charts use recharts (available in the project's node_modules).
// Free plan: shows last 30 days. Growth plan: full history.
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  BarChart3, TrendingUp, Users, CheckCircle, Eye,
  ArrowUpRight, Building2, Loader2, Lock, Zap,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import type { VendorProfile, Offer } from '@/lib/types/database.types';

// ── Types from DB views ───────────────────────────────────────────────────────

interface MonthlyRow {
  vendor_id: string; claimed_year: number; claimed_month: number;
  month_start: string; total_claimed: number; total_confirmed: number;
  unique_students: number; total_discounts_usd: number | null;
}

interface DayOfWeekRow {
  vendor_id: string; claimed_day_of_week: number; day_name: string;
  total_claimed: number; total_confirmed: number;
}

interface HourRow {
  vendor_id: string; claimed_hour: number;
  total_claimed: number; total_confirmed: number;
}

interface InstitutionRow {
  vendor_id: string; student_institution_id: string | null;
  student_institution_name: string; total_claimed: number;
  total_confirmed: number; unique_students: number;
}

interface PerformanceSummary {
  vendor_id: string; business_name: string; city: string; plan_tier: string;
  total_offers: number; total_views: number; total_redemptions: number;
  overall_conversion_rate_pct: number; total_discounts_given_usd: number | null;
  total_estimated_revenue_driven_usd: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const HOUR_LABEL = (h: number) => {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
};

const CHART_GREEN = '#16a34a';
const CHART_BRAND = '#7c3aed';
const CHART_BLUE  = '#3b82f6';
const TOOLTIP_STYLE = {
  contentStyle: { borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '12px' },
};

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`card p-5 ${accent ? 'bg-vendor-50 border-vendor-100' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-vendor-100 text-vendor-600' : 'bg-gray-100 text-gray-500'}`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-black mb-0.5 ${accent ? 'text-vendor-700' : 'text-gray-900'}`}>{value}</div>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, locked }: {
  title: string; subtitle?: string; children: React.ReactNode; locked?: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {locked && (
          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-semibold">
            <Lock size={11} />
            Growth plan
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className={`bg-gray-50 rounded-xl animate-pulse`} style={{ height }} />
  );
}

// ── Upgrade CTA ───────────────────────────────────────────────────────────────
function UpgradeBanner() {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Zap size={20} className="text-white" />
      </div>
      <div className="flex-1">
        <p className="text-white font-bold">Unlock full analytics history</p>
        <p className="text-white/70 text-sm mt-0.5">Growth plan includes full redemption history, peak-hour heatmap, institution insights, and Looker Studio export.</p>
      </div>
      <a href="/vendor/upgrade" className="flex-shrink-0 bg-white text-brand-700 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-50 transition-colors whitespace-nowrap flex items-center gap-1.5">
        Upgrade plan
        <ArrowUpRight size={14} />
      </a>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [dayData, setDayData] = useState<DayOfWeekRow[]>([]);
  const [hourData, setHourData] = useState<HourRow[]>([]);
  const [institutionData, setInstitutionData] = useState<InstitutionRow[]>([]);
  const [topOffers, setTopOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }

      const { data: vp } = await supabase
        .from('vendor_profiles').select('*').eq('user_id', user.id).single();
      if (!vp) { router.push('/vendor'); return; }
      setVendorProfile(vp);

      // Parallel fetch all analytics views
      const [summaryRes, monthlyRes, dayRes, hourRes, instRes, offersRes] = await Promise.all([
        supabase.from('v_vendor_performance_summary').select('*').eq('vendor_id', vp.id).single(),
        supabase.from('v_monthly_redemption_trend').select('*').eq('vendor_id', vp.id).order('claimed_year').order('claimed_month'),
        supabase.from('v_redemptions_by_day_of_week').select('*').eq('vendor_id', vp.id).order('claimed_day_of_week'),
        supabase.from('v_redemptions_by_hour').select('*').eq('vendor_id', vp.id).order('claimed_hour'),
        supabase.from('v_redemptions_by_institution').select('*').eq('vendor_id', vp.id).order('total_confirmed', { ascending: false }).limit(10),
        supabase.from('offers').select('*').eq('vendor_id', vp.id).order('redemption_count', { ascending: false }).limit(5),
      ]);

      setSummary(summaryRes.data as PerformanceSummary ?? null);
      setMonthlyData((monthlyRes.data ?? []) as MonthlyRow[]);
      setDayData((dayRes.data ?? []) as DayOfWeekRow[]);
      setHourData((hourRes.data ?? []) as HourRow[]);
      setInstitutionData((instRes.data ?? []) as InstitutionRow[]);
      setTopOffers(offersRes.data ?? []);
      setLoading(false);
    })();
  }, []);

  const isPro = vendorProfile?.plan_tier === 'starter' || vendorProfile?.plan_tier === 'growth';

  // ── Prepare chart data ─────────────────────────────────────────────────────
  const monthChartData = monthlyData.map((row) => ({
    name: monthLabel(row.claimed_year, row.claimed_month),
    Claimed: row.total_claimed,
    Confirmed: row.total_confirmed,
    Students: row.unique_students,
  }));

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayChartData = (() => {
    const map: Record<number, DayOfWeekRow> = {};
    dayData.forEach((d) => { map[d.claimed_day_of_week] = d; });
    return DAYS.map((name, i) => ({
      name,
      Confirmed: map[i]?.total_confirmed ?? 0,
      Claimed: map[i]?.total_claimed ?? 0,
    }));
  })();

  const hourChartData = (() => {
    const map: Record<number, HourRow> = {};
    hourData.forEach((h) => { map[h.claimed_hour] = h; });
    return Array.from({ length: 24 }, (_, i) => ({
      name: HOUR_LABEL(i),
      Confirmed: map[i]?.total_confirmed ?? 0,
    }));
  })();

  return (
    <>
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="mb-7">
            <h1 className="text-2xl font-black text-gray-900">Analytics</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {vendorProfile?.business_name} · {vendorProfile?.plan_tier ?? 'free'} plan
            </p>
          </div>

          {/* Upgrade banner for free plan */}
          {!isPro && <UpgradeBanner />}

          {/* KPI cards */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-20 mb-4" />
                  <div className="h-7 bg-gray-100 rounded w-16 mb-2" />
                  <div className="h-2 bg-gray-100 rounded w-28" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              <KpiCard icon={<Eye size={15} />} label="Total views" value={fmtNum(summary?.total_views ?? 0)} sub="All-time impressions" />
              <KpiCard icon={<CheckCircle size={15} />} label="Confirmed visits" value={fmtNum(summary?.total_redemptions ?? 0)} sub="Verified redemptions" accent />
              <KpiCard icon={<TrendingUp size={15} />} label="Conversion rate" value={summary?.overall_conversion_rate_pct != null ? `${summary.overall_conversion_rate_pct}%` : '—'} sub="Views → confirmed" />
              <KpiCard icon={<BarChart3 size={15} />} label="Active offers" value={fmtNum(summary?.total_offers ?? 0)} sub="Currently running" />
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">

            {/* Monthly trend */}
            <div className="lg:col-span-2">
              <ChartCard title="Monthly redemption trend" subtitle="Claimed vs confirmed visits by month">
                {loading ? <ChartSkeleton height={240} /> : monthChartData.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                    <BarChart3 size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">No redemption data yet. Publish an offer to start seeing trends.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={monthChartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="Claimed" stroke={CHART_BRAND} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Confirmed" stroke={CHART_GREEN} strokeWidth={2.5} dot={{ r: 3, fill: CHART_GREEN }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Day of week */}
            <ChartCard title="Best days" subtitle="Which days drive the most confirmed visits">
              {loading ? <ChartSkeleton height={200} /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dayChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="Confirmed" fill={CHART_GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Peak hours */}
            <ChartCard
              title="Peak hours"
              subtitle="When students confirm your offers throughout the day"
              locked={!isPro}
            >
              {loading ? <ChartSkeleton height={200} /> : !isPro ? (
                <div className="h-48 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Lock size={20} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Peak hours on Growth plan</p>
                    <p className="text-xs text-gray-400 mt-0.5">Know exactly when to staff up and run promos.</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false} tickLine={false}
                      interval={3}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="Confirmed" fill={CHART_BLUE} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Top offers */}
            <ChartCard title="Top performing offers" subtitle="Ranked by confirmed redemptions">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                        <div className="h-2 bg-gray-100 rounded w-1/2" />
                      </div>
                      <div className="h-4 bg-gray-100 rounded w-10" />
                    </div>
                  ))}
                </div>
              ) : topOffers.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <p className="text-sm">No offers yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {topOffers.map((offer, idx) => {
                    const max = topOffers[0]?.redemption_count || 1;
                    const pct = Math.round((offer.redemption_count / max) * 100);
                    return (
                      <div key={offer.id} className="flex items-center gap-3 py-2.5 group">
                        <span className="w-5 text-xs font-bold text-gray-400 flex-shrink-0">{idx + 1}</span>
                        <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 text-brand-700 text-[10px] font-black text-center leading-tight px-1">
                          {offer.discount_label.slice(0, 6)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{offer.title}</p>
                          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-vendor-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-gray-700 flex-shrink-0 ml-2">
                          {fmtNum(offer.redemption_count)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>

            {/* Institution breakdown */}
            <ChartCard
              title="University breakdown"
              subtitle="Which institutions are shopping with you"
              locked={!isPro}
            >
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 bg-gray-100 rounded w-2/3" />
                        <div className="h-1.5 bg-gray-100 rounded-full w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isPro ? (
                <div className="h-48 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Lock size={20} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">University insights on Growth plan</p>
                    <p className="text-xs text-gray-400 mt-0.5">See exactly which campuses are driving your foot traffic.</p>
                  </div>
                </div>
              ) : institutionData.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <Building2 size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No institution data yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {institutionData.slice(0, 6).map((row) => {
                    const max = institutionData[0]?.total_confirmed || 1;
                    const pct = Math.round((row.total_confirmed / max) * 100);
                    return (
                      <div key={row.student_institution_id ?? row.student_institution_name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-gray-700 truncate">{row.student_institution_name}</p>
                            <span className="text-xs font-bold text-gray-600 ml-2 flex-shrink-0">{row.total_confirmed}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">{row.unique_students} unique students</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      </div>
    </>
  );
}
