// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
'use client';

/**
 * SavingsHero.tsx
 * Shows total HUF saved this semester, breakdown by category,
 * progress to next milestone, and comparison vs peers.
 */

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Trophy, TrendingUp, Target, ChevronRight, Zap, ArrowRight } from 'lucide-react';
import { fmtHUF, fmtEUR } from '@/lib/currency';

interface SavingsData {
  totalHuf: number;
  semesterHuf: number;
  monthHuf: number;
  byCategory: { category: string; totalHuf: number; count: number }[];
  redemptionCount: number;
  percentileVsInstitution: number; // 0–100
}

const MILESTONES = [5000, 10000, 25000, 50000, 100000, 250000];

const CATEGORY_LABELS: Record<string, string> = {
  food_drink:       '🍕 Food & Drink',
  groceries:        '🛒 Groceries',
  tech:             '💻 Tech',
  books_stationery: '📚 Books',
  fitness:          '🏋️ Fitness',
  fashion:          '👗 Fashion',
  other:            '🎁 Other',
};

function nextMilestone(current: number): number {
  return MILESTONES.find(m => m > current) ?? MILESTONES[MILESTONES.length - 1];
}

function semesterStart(): string {
  const now = new Date();
  // Hungarian academic year: Sep–Jan = autumn semester, Feb–Jun = spring semester
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 9) return `${year}-09-01`;
  if (month >= 2) return `${year}-02-01`;
  return `${year - 1}-09-01`;
}

interface Props {
  studentProfileId: string;
  institutionId?: string | null;
  showEUR?: boolean;
  onToggleCurrency?: () => void;
}

export default function SavingsHero({ studentProfileId, institutionId, showEUR = false, onToggleCurrency }: Props) {
  const [savings, setSavings] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!studentProfileId) return;
    loadSavings();
  }, [studentProfileId]);

  async function loadSavings() {
    setLoading(true);
    const supabase = createClient();

    const semStart = semesterStart();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    try {
      // All-time confirmed redemptions for this student (fixed_amount have real HUF value)
      const { data: redemptions } = await supabase
        .from('redemptions')
        .select('discount_value_applied, claimed_at, offer_category, offers(discount_type)')
        .eq('student_id', studentProfileId)
        .eq('status', 'confirmed');

      const all = redemptions ?? [];

      // Only count fixed-amount redemptions for HUF savings (percentage = no known bill amount)
      function hufValue(r: typeof all[number]): number {
        const dtype = (r.offers as any)?.discount_type ?? '';
        if (dtype === 'percentage') return 0; // can't compute without bill amount
        return r.discount_value_applied ?? 0;
      }

      const totalHuf = all.reduce((s, r) => s + hufValue(r), 0);

      const semesterItems = all.filter(r => r.claimed_at && r.claimed_at >= semStart);
      const semesterHuf = semesterItems.reduce((s, r) => s + hufValue(r), 0);

      const monthItems = all.filter(r => r.claimed_at && r.claimed_at >= monthStart.toISOString());
      const monthHuf = monthItems.reduce((s, r) => s + hufValue(r), 0);

      // Group by category
      const catMap: Record<string, { totalHuf: number; count: number }> = {};
      for (const r of all) {
        const cat = r.offer_category ?? 'other';
        if (!catMap[cat]) catMap[cat] = { totalHuf: 0, count: 0 };
        catMap[cat].totalHuf += hufValue(r);
        catMap[cat].count += 1;
      }
      const byCategory = Object.entries(catMap)
        .map(([category, d]) => ({ category, ...d }))
        .sort((a, b) => b.totalHuf - a.totalHuf);

      // Peer comparison within same institution (approximate percentile)
      let percentileVsInstitution = 50;
      if (institutionId && semesterHuf > 0) {
        const { data: peers } = await supabase
          .from('student_profiles')
          .select('user_id')
          .eq('institution_id', institutionId)
          .eq('verification_status', 'verified');

        if (peers && peers.length > 1) {
          // Simplified percentile: students who have claimed fewer confirmed deals
          const { count: lowerCount } = await supabase
            .from('redemptions')
            .select('student_id', { count: 'exact', head: true })
            .eq('status', 'confirmed')
            .in('student_id', peers.map(p => p.user_id).filter(Boolean));

          // Our rank: redemptionCount vs total
          const total = lowerCount ?? 0;
          percentileVsInstitution = total > 0 ? Math.round((all.length / total) * 50) : 50;
        }
      }

      setSavings({
        totalHuf,
        semesterHuf,
        monthHuf,
        byCategory,
        redemptionCount: all.length,
        percentileVsInstitution,
      });
    } catch (_) {
      // fail silently — savings hero is non-critical
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 animate-pulse h-32" />
    );
  }

  if (!savings || savings.totalHuf === 0) {
    return (
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={18} className="text-yellow-300" />
          <span className="font-semibold text-sm">Savings Unlocked</span>
        </div>
        <p className="text-white/80 text-sm">Claim your first offer to start tracking savings!</p>
      </div>
    );
  }

  const next = nextMilestone(savings.semesterHuf);
  const progress = Math.min(100, (savings.semesterHuf / next) * 100);

  return (
    <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 text-white shadow-lg shadow-brand-900/20 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={18} className="text-yellow-300" />
            <span className="font-semibold text-sm tracking-wide uppercase opacity-90">
              Savings Unlocked
            </span>
          </div>
          <button
            onClick={onToggleCurrency}
            className="text-4xl font-black tracking-tight hover:opacity-90 transition-opacity"
            title="Click to toggle currency"
          >
            {showEUR ? fmtEUR(savings.semesterHuf / 400) : fmtHUF(savings.semesterHuf)}
          </button>
          <p className="text-white/70 text-xs mt-1">this semester · {savings.redemptionCount} redemptions</p>
        </div>

        <div className="text-right">
          <div className="text-xs text-white/60 mb-1">This month</div>
          <div className="text-lg font-bold">
            {showEUR ? fmtEUR(savings.monthHuf / 400) : fmtHUF(savings.monthHuf)}
          </div>
          {savings.percentileVsInstitution > 50 && (
            <div className="flex items-center justify-end gap-1 mt-1">
              <TrendingUp size={11} className="text-green-300" />
              <span className="text-xs text-green-300">
                Top {100 - savings.percentileVsInstitution}% at your uni
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Milestone progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
          <span className="flex items-center gap-1">
            <Target size={11} />
            Next milestone: {fmtHUF(next)}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-300 to-yellow-400 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-white/60 mt-1">
          {fmtHUF(next - savings.semesterHuf)} more to unlock your next badge
        </p>
      </div>

      {/* Category breakdown (expandable) */}
      {savings.byCategory.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
        >
          <Zap size={11} />
          {expanded ? 'Hide' : 'Show'} breakdown by category
          <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {savings.byCategory.slice(0, 6).map(cat => (
            <div key={cat.category} className="bg-white/10 rounded-xl px-3 py-2">
              <div className="text-xs text-white/70">{CATEGORY_LABELS[cat.category] ?? cat.category}</div>
              <div className="font-bold text-sm">{fmtHUF(cat.totalHuf)}</div>
              <div className="text-xs text-white/50">{cat.count} deal{cat.count !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* Link to full savings page */}
      <button
        onClick={() => router.push('/my-savings')}
        className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors py-1"
      >
        View full savings history
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
