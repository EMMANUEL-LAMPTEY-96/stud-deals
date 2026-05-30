'use client';

// =============================================================================
// app/(student)/my-savings/page.tsx — Student Savings History
//
// Full savings breakdown for a student:
//   - Lifetime total in HUF (+ EUR toggle)
//   - Stat cards: redemptions count, avg per deal, best month
//   - Month-by-month bar chart (last 6 months)
//   - Per-vendor breakdown
//   - Chronological deal history table
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Trophy, TrendingUp, Zap, ArrowLeft, ChevronDown, ChevronUp,
  Calendar, Store, Tag, BarChart2, Star
} from 'lucide-react';
import { fmtHUF, fmtEUR, fmtDate } from '@/lib/currency';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RedemptionRow {
  id: string;
  claimed_at: string | null;
  discount_value_applied: number | null;
  offer_category: string | null;
  offers: {
    title: string;
    discount_type: string;
    discount_value: number | null;
    vendor_profiles: { business_name: string; logo_url: string | null } | null;
  } | null;
}

interface MonthBucket {
  label: string;    // e.g. "Jan 2026"
  key: string;      // e.g. "2026-01"
  totalHuf: number;
  count: number;
}

interface VendorBucket {
  vendorName: string;
  logoUrl: string | null;
  totalHuf: number;
  count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HUF_PER_EUR = 400;

const CATEGORY_LABELS: Record<string, string> = {
  food_drink:       '🍕 Food & Drink',
  groceries:        '🛒 Groceries',
  tech:             '💻 Tech',
  books_stationery: '📚 Books',
  fitness:          '🏋️ Fitness',
  fashion:          '👗 Fashion',
  other:            '🎁 Other',
};

function hufFromRow(r: RedemptionRow): number {
  if (!r.offers) return 0;
  if (r.offers.discount_type === 'percentage') return 0;
  return r.discount_value_applied ?? 0;
}

function monthKey(iso: string | null): string {
  if (!iso) return 'unknown';
  return iso.slice(0, 7); // "2026-03"
}

function monthLabel(key: string): string {
  if (key === 'unknown') return 'Unknown';
  const [year, month] = key.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('hu-HU', { month: 'short', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MySavingsPage() {
  const router = useRouter();
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEUR, setShowEUR] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const supabase = createClient();

      // Get student profile id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in'); return; }

      const { data: spRaw } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('user_id', user.id as string)
        .maybeSingle();
      const sp = (spRaw as unknown) as { id: string } | null;

      if (!sp) { router.replace('/dashboard'); return; }

      const { data: rows } = await supabase
        .from('redemptions')
        .select(`
          id,
          claimed_at,
          discount_value_applied,
          offer_category,
          offers (
            title,
            discount_type,
            discount_value,
            vendor_profiles ( business_name, logo_url )
          )
        `)
        .eq('student_id', sp.id)
        .eq('status', 'confirmed')
        .order('claimed_at', { ascending: false });

      setRedemptions((rows ?? []) as RedemptionRow[]);
    } catch (_) {
      // fail silently
    } finally {
      setLoading(false);
    }
  }

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalHuf = redemptions.reduce((s, r) => s + hufFromRow(r), 0);
  const fixedCount = redemptions.filter(r => r.offers?.discount_type !== 'percentage').length;
  const percentageCount = redemptions.filter(r => r.offers?.discount_type === 'percentage').length;
  const avgHuf = fixedCount > 0 ? Math.round(totalHuf / fixedCount) : 0;

  // Month buckets — last 6 months
  const monthMap = new Map<string, MonthBucket>();
  for (const r of redemptions) {
    const key = monthKey(r.claimed_at);
    if (!monthMap.has(key)) {
      monthMap.set(key, { label: monthLabel(key), key, totalHuf: 0, count: 0 });
    }
    const b = monthMap.get(key)!;
    b.totalHuf += hufFromRow(r);
    b.count += 1;
  }
  const months = Array.from(monthMap.values())
    .filter(m => m.key !== 'unknown')
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6);

  const bestMonth = months.reduce((best, m) => m.totalHuf > (best?.totalHuf ?? 0) ? m : best, months[0]);
  const chartMax = Math.max(...months.map(m => m.totalHuf), 1);

  // Vendor breakdown
  const vendorMap = new Map<string, VendorBucket>();
  for (const r of redemptions) {
    const name = r.offers?.vendor_profiles?.business_name ?? 'Unknown';
    const logo = r.offers?.vendor_profiles?.logo_url ?? null;
    if (!vendorMap.has(name)) vendorMap.set(name, { vendorName: name, logoUrl: logo, totalHuf: 0, count: 0 });
    const b = vendorMap.get(name)!;
    b.totalHuf += hufFromRow(r);
    b.count += 1;
  }
  const vendors = Array.from(vendorMap.values()).sort((a, b) => b.totalHuf - a.totalHuf).slice(0, 8);

  const fmt = (huf: number) => showEUR ? fmtEUR(huf / HUF_PER_EUR) : fmtHUF(huf);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* Back */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to dashboard
        </button>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-lg shadow-brand-900/20 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={20} className="text-yellow-300" />
                <span className="font-semibold text-sm tracking-wide uppercase opacity-90">
                  Lifetime Savings
                </span>
              </div>
              <button
                onClick={() => setShowEUR(v => !v)}
                className="text-5xl font-black tracking-tight hover:opacity-90 transition-opacity"
                title="Toggle currency"
              >
                {fmt(totalHuf)}
              </button>
              <p className="text-white/70 text-sm mt-2">
                {redemptions.length} deal{redemptions.length !== 1 ? 's' : ''} redeemed
                {percentageCount > 0 && ` · ${percentageCount} % discount${percentageCount !== 1 ? 's' : ''} not counted`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/60 mb-1">Avg per deal</p>
              <p className="text-xl font-bold">{fmt(avgHuf)}</p>
              {bestMonth && (
                <>
                  <p className="text-xs text-white/60 mt-2 mb-1">Best month</p>
                  <p className="text-sm font-semibold text-yellow-300">{bestMonth.label}</p>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-white/50 mt-4">
            {showEUR ? 'Tap total to show Ft' : 'Tap total to show €'} · Only fixed-amount discounts counted
          </p>
        </div>

        {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <Store size={18} className="text-brand-500 mx-auto mb-1.5" />
            <p className="text-2xl font-black text-gray-900">{vendors.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Vendors</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <Tag size={18} className="text-green-500 mx-auto mb-1.5" />
            <p className="text-2xl font-black text-gray-900">{redemptions.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Deals used</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
            <BarChart2 size={18} className="text-purple-500 mx-auto mb-1.5" />
            <p className="text-2xl font-black text-gray-900">{months.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Active months</p>
          </div>
        </div>

        {/* ── MONTHLY CHART ──────────────────────────────────────────────── */}
        {months.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-brand-600" />
              <h2 className="font-bold text-gray-900 text-sm">Savings by Month</h2>
            </div>
            <div className="flex items-end gap-2 h-28">
              {months.map(m => {
                const pct = chartMax > 0 ? (m.totalHuf / chartMax) * 100 : 0;
                const isMax = m.key === bestMonth?.key;
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10px] text-gray-500 font-medium truncate w-full text-center">
                      {fmt(m.totalHuf)}
                    </span>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${isMax ? 'bg-brand-500' : 'bg-brand-200'}`}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                    <span className="text-[10px] text-gray-400 truncate w-full text-center">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TOP VENDORS ────────────────────────────────────────────────── */}
        {vendors.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Star size={16} className="text-yellow-500" />
              <h2 className="font-bold text-gray-900 text-sm">Top Vendors</h2>
            </div>
            <div className="space-y-3">
              {vendors.map((v, i) => (
                <div key={v.vendorName} className="flex items-center gap-3">
                  {/* Rank */}
                  <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
                    {i + 1}
                  </span>
                  {/* Logo */}
                  {v.logoUrl ? (
                    <img src={v.logoUrl} alt={v.vendorName} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <Store size={14} className="text-brand-600" />
                    </div>
                  )}
                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800 truncate">{v.vendorName}</span>
                      <span className="text-sm font-bold text-brand-700 flex-shrink-0">{fmt(v.totalHuf)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-400 rounded-full"
                        style={{ width: `${(v.totalHuf / (vendors[0]?.totalHuf || 1)) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{v.count} deal{v.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DEAL HISTORY ───────────────────────────────────────────────── */}
        {redemptions.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-500" />
                <h2 className="font-bold text-gray-900 text-sm">Deal History</h2>
              </div>
              <button
                onClick={() => setExpandedHistory(v => !v)}
                className="text-xs text-brand-600 flex items-center gap-1"
              >
                {expandedHistory ? 'Show less' : `Show all ${redemptions.length}`}
                {expandedHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            <div className="space-y-3">
              {(expandedHistory ? redemptions : redemptions.slice(0, 5)).map(r => {
                const vendor = r.offers?.vendor_profiles?.business_name ?? 'Unknown';
                const title = r.offers?.title ?? 'Deal';
                const huf = hufFromRow(r);
                const isPercentage = r.offers?.discount_type === 'percentage';
                return (
                  <div key={r.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <Tag size={14} className="text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {vendor} · {r.claimed_at ? fmtDate(r.claimed_at) : '—'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {isPercentage ? (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          {r.discount_value_applied ?? r.offers?.discount_value}% off
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-brand-700">{fmt(huf)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── EMPTY STATE ────────────────────────────────────────────────── */}
        {redemptions.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trophy size={28} className="text-brand-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No savings yet</h3>
            <p className="text-gray-500 text-sm mb-6">
              Claim your first deal to start building your savings history.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-brand-600 text-white rounded-2xl font-bold text-sm hover:bg-brand-700 transition-colors"
            >
              Browse deals
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
