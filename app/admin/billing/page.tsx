// @ts-nocheck
'use client';

// =============================================================================
// /admin/billing — Billing & Revenue Dashboard
// Shows MRR, plan tier distribution, trials expiring soon, past-due vendors,
// recent upgrades, and revenue by city.
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminNav from '@/components/admin/AdminNav';
import {
  CreditCard, RefreshCw, Loader2, TrendingUp, Users,
  AlertTriangle, CheckCircle, Clock, XCircle, Banknote,
  ArrowUpRight, Building2, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface BillingSummary {
  total_vendors: number;
  total_free: number;
  total_trialing: number;
  total_growth_active: number;
  total_pro_active: number;
  total_past_due: number;
  total_cancelled: number;
  estimated_mrr_huf: number;
  estimated_mrr_eur: number;
}

interface TierRow {
  tier: string;
  count: number;
  paying: number;
  mrr_huf: number;
}

interface CityRow {
  city: string;
  free: number;
  trialing: number;
  growth: number;
  pro: number;
  total: number;
}

interface VendorRow {
  id: string;
  business_name: string;
  city: string;
  plan_tier: string;
  plan_status: string;
  trial_ends_at: string | null;
  plan_started_at: string | null;
  has_stripe: boolean;
}

interface BillingData {
  summary: BillingSummary;
  by_tier: TierRow[];
  by_city: CityRow[];
  trials_expiring: VendorRow[];
  past_due: VendorRow[];
  recent_upgrades: VendorRow[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtHUF(n: number) {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(n);
}

function fmtEUR(n: number) {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function daysUntil(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

const TIER_BADGE: Record<string, string> = {
  free:   'bg-gray-100 text-gray-500',
  growth: 'bg-blue-100 text-blue-700',
  pro:    'bg-purple-100 text-purple-700',
};

const STATUS_BADGE: Record<string, string> = {
  trialing: 'bg-amber-100 text-amber-700',
  active:   'bg-green-100 text-green-700',
  past_due: 'bg-red-100 text-red-700',
  cancelled:'bg-gray-100 text-gray-500',
  free:     'bg-gray-100 text-gray-500',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
      </div>
      <div className="text-2xl font-black text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function TierBar({ by_tier, total }: { by_tier: TierRow[]; total: number }) {
  if (!total) return null;
  const order = ['free', 'trialing', 'growth', 'pro'];
  const sorted = order
    .map(t => by_tier.find(r => r.tier === t))
    .filter(Boolean) as TierRow[];

  const COLORS: Record<string, string> = {
    free:   'bg-gray-200',
    growth: 'bg-blue-400',
    pro:    'bg-purple-500',
  };
  // trialing shows as amber
  const extra: Record<string, string> = { trialing: 'bg-amber-400' };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
      <h2 className="text-sm font-bold text-gray-700 mb-4">Plan distribution</h2>
      <div className="flex h-4 rounded-full overflow-hidden gap-px mb-4">
        {sorted.map((r) => {
          const pct = Math.round((r.count / total) * 100);
          if (!pct) return null;
          const color = extra[r.tier] ?? COLORS[r.tier] ?? 'bg-gray-300';
          return <div key={r.tier} style={{ width: `${pct}%` }} className={`${color} first:rounded-l-full last:rounded-r-full`} />;
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sorted.map((r) => {
          const color = extra[r.tier] ?? COLORS[r.tier] ?? 'bg-gray-300';
          return (
            <div key={r.tier} className="text-center">
              <div className={`inline-block w-3 h-3 rounded-full ${color} mb-1`} />
              <div className="text-lg font-black text-gray-900">{r.count}</div>
              <div className="text-xs text-gray-400 capitalize">{r.tier}</div>
              {r.mrr_huf > 0 && (
                <div className="text-xs text-gray-500 font-medium mt-0.5">{fmtHUF(r.mrr_huf)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VendorTable({
  title, icon, vendors, emptyMsg, highlightCol, accentClass,
}: {
  title: string;
  icon: React.ReactNode;
  vendors: VendorRow[];
  emptyMsg: string;
  highlightCol: (v: VendorRow) => string;
  accentClass?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className={`flex items-center gap-2 px-5 py-3 border-b border-gray-100 ${accentClass ?? ''}`}>
        {icon}
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        <span className="ml-auto text-xs text-gray-400">{vendors.length}</span>
      </div>
      {vendors.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400">{emptyMsg}</div>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {vendors.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-semibold text-gray-800">{v.business_name}</div>
                  <div className="text-xs text-gray-400">{v.city}</div>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${TIER_BADGE[v.plan_tier] ?? 'bg-gray-100 text-gray-500'}`}>
                    {v.plan_tier}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[v.plan_status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {v.plan_status}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500 font-medium">{highlightCol(v)}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/vendors/${v.id}`}
                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold"
                  >
                    View <ChevronRight size={11} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/sign-in');
    });
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/billing');
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const s = data?.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav active="/admin/billing" />

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <CreditCard size={22} className="text-purple-600" />
              Billing & Revenue
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Platform-wide subscription metrics and plan health.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={32} className="animate-spin text-purple-400" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertTriangle size={24} className="text-red-500 mx-auto mb-2" />
            <p className="text-red-700 font-semibold text-sm">{error}</p>
            <button onClick={fetchData} className="mt-3 text-red-600 text-xs underline">Retry</button>
          </div>
        ) : s ? (
          <>
            {/* ── KPI cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <KpiCard
                label="Est. MRR"
                value={fmtHUF(s.estimated_mrr_huf)}
                sub={`≈ ${fmtEUR(s.estimated_mrr_eur)}`}
                icon={<TrendingUp size={16} className="text-green-600" />}
                accent="bg-green-50"
              />
              <KpiCard
                label="Paying vendors"
                value={String(s.total_growth_active + s.total_pro_active)}
                sub={`${s.total_trialing} trialing`}
                icon={<CheckCircle size={16} className="text-blue-600" />}
                accent="bg-blue-50"
              />
              <KpiCard
                label="Free / churned"
                value={String(s.total_free + s.total_cancelled)}
                sub={`${s.total_cancelled} cancelled`}
                icon={<Users size={16} className="text-gray-500" />}
                accent="bg-gray-50"
              />
              <KpiCard
                label="Past due"
                value={String(s.total_past_due)}
                sub={s.total_past_due > 0 ? 'Action required' : 'All clear'}
                icon={<AlertTriangle size={16} className={s.total_past_due > 0 ? 'text-red-500' : 'text-green-500'} />}
                accent={s.total_past_due > 0 ? 'bg-red-50' : 'bg-green-50'}
              />
            </div>

            {/* Secondary KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <KpiCard
                label="Growth plan"
                value={String(s.total_growth_active)}
                sub={`${fmtHUF(s.total_growth_active * 13_990)} / mo`}
                icon={<Banknote size={16} className="text-blue-500" />}
                accent="bg-blue-50"
              />
              <KpiCard
                label="Pro plan"
                value={String(s.total_pro_active)}
                sub={`${fmtHUF(s.total_pro_active * 27_990)} / mo`}
                icon={<ArrowUpRight size={16} className="text-purple-600" />}
                accent="bg-purple-50"
              />
              <KpiCard
                label="Trials active"
                value={String(s.total_trialing)}
                sub={`${data!.trials_expiring.length} expiring soon`}
                icon={<Clock size={16} className="text-amber-500" />}
                accent="bg-amber-50"
              />
              <KpiCard
                label="Total vendors"
                value={String(s.total_vendors)}
                sub="All accounts"
                icon={<Building2 size={16} className="text-gray-500" />}
                accent="bg-gray-50"
              />
            </div>

            {/* ── Plan distribution bar ──────────────────────────────── */}
            <TierBar by_tier={data!.by_tier} total={s.total_vendors} />

            {/* ── Revenue by city ────────────────────────────────────── */}
            {data!.by_city.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
                <h2 className="text-sm font-bold text-gray-700 mb-4">Revenue by city</h2>
                <div className="space-y-2">
                  {data!.by_city.map((c) => {
                    const paidMRR = (c.growth * 13_990) + (c.pro * 27_990);
                    return (
                      <div key={c.city} className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-700 w-24 shrink-0">{c.city}</span>
                        <div className="flex-1 flex h-5 rounded-full overflow-hidden gap-px bg-gray-100">
                          {c.free > 0 && (
                            <div
                              style={{ width: `${Math.round((c.free / c.total) * 100)}%` }}
                              className="bg-gray-200 first:rounded-l-full"
                              title={`Free: ${c.free}`}
                            />
                          )}
                          {c.trialing > 0 && (
                            <div
                              style={{ width: `${Math.round((c.trialing / c.total) * 100)}%` }}
                              className="bg-amber-300"
                              title={`Trialing: ${c.trialing}`}
                            />
                          )}
                          {c.growth > 0 && (
                            <div
                              style={{ width: `${Math.round((c.growth / c.total) * 100)}%` }}
                              className="bg-blue-400"
                              title={`Growth: ${c.growth}`}
                            />
                          )}
                          {c.pro > 0 && (
                            <div
                              style={{ width: `${Math.round((c.pro / c.total) * 100)}%` }}
                              className="bg-purple-500 last:rounded-r-full"
                              title={`Pro: ${c.pro}`}
                            />
                          )}
                        </div>
                        <span className="text-xs text-gray-400 w-16 text-right shrink-0">
                          {paidMRR > 0 ? fmtHUF(paidMRR) : `${c.total} vendors`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
                  {[
                    { color: 'bg-gray-200',   label: 'Free' },
                    { color: 'bg-amber-300',  label: 'Trial' },
                    { color: 'bg-blue-400',   label: 'Growth' },
                    { color: 'bg-purple-500', label: 'Pro' },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Three vendor tables ────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <VendorTable
                title="Trials expiring soon"
                icon={<Clock size={14} className="text-amber-500" />}
                vendors={data!.trials_expiring}
                emptyMsg="No trials expiring in 7 days 🎉"
                accentClass="bg-amber-50"
                highlightCol={(v) => `${daysUntil(v.trial_ends_at)}d left`}
              />
              <VendorTable
                title="Past due — action needed"
                icon={<XCircle size={14} className="text-red-500" />}
                vendors={data!.past_due}
                emptyMsg="No past-due accounts 🎉"
                accentClass="bg-red-50"
                highlightCol={(v) => `${daysSince(v.plan_started_at)}d overdue`}
              />
              <VendorTable
                title="Recent upgrades (30d)"
                icon={<ArrowUpRight size={14} className="text-green-600" />}
                vendors={data!.recent_upgrades}
                emptyMsg="No upgrades in last 30 days"
                accentClass="bg-green-50"
                highlightCol={(v) => `Upgraded ${fmtDate(v.plan_started_at)}`}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
