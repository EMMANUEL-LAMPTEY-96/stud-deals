'use client';

// =============================================================================
// components/vendor/RoiWidget.tsx
//
// ROI insight card shown on the vendor dashboard.
// Uses real stamp + redemption data to estimate revenue impact:
//
//   - Loyalty members (unique students with ≥1 stamp)
//   - Stamps this month
//   - Avg estimated spend per visit (configurable)
//   - 2.4× repeat-visit multiplier (research-backed for loyalty programmes)
//   - Estimated extra revenue vs non-loyalty baseline
//
// Numbers are estimates — shown clearly as such. Purpose is to demonstrate
// the value of the loyalty programme so vendors stay engaged and upgrade.
// =============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  TrendingUp, Users, ArrowUpRight, Zap, ChevronRight,
  DollarSign, Star, RefreshCw,
} from 'lucide-react';

interface RoiData {
  loyaltyMembers: number;    // unique students with ≥1 stamp
  stampsThisMonth: number;
  rewardsGiven: number;      // confirmed rewards
  repeatVisitMultiplier: number; // 2.4
  avgSpendEstimate: number;  // HUF per visit estimate (default: 1500)
  estimatedExtraRevenue: number;
  estimatedSavingsOnAcq: number; // cost if acquired via ads
  returnVisitRate: number;   // % students who came back
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const t = setInterval(() => {
      current += increment;
      if (current >= value) { setDisplayed(value); clearInterval(t); }
      else setDisplayed(Math.floor(current));
    }, 30);
    return () => clearInterval(t);
  }, [value]);

  return (
    <span>{prefix}{displayed.toLocaleString()}{suffix}</span>
  );
}

export default function RoiWidget({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [data, setData] = useState<RoiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [avgSpend, setAvgSpend] = useState(1500); // HUF default

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        // All-time stamps
        const { data: allStamps } = await supabase
          .from('redemptions')
          .select('student_profile_id, claimed_at, status')
          .eq('vendor_id', vendorId)
          .in('status', ['stamp', 'reward_earned', 'tier_reward', 'confirmed']);

        if (cancelled) return;

        const rows = allStamps ?? [];

        // Unique loyalty members
        const uniqueStudents = new Set(rows.map(r => r.student_profile_id));
        const loyaltyMembers = uniqueStudents.size;

        // Stamps this month
        const stampsThisMonth = rows.filter(r =>
          r.status === 'stamp' &&
          new Date(r.claimed_at) >= monthStart
        ).length;

        // Confirmed rewards
        const rewardsGiven = rows.filter(r => r.status === 'confirmed').length;

        // Return visit rate: students who stamped more than once
        const stampCount: Record<string, number> = {};
        rows.filter(r => r.status === 'stamp').forEach(r => {
          stampCount[r.student_profile_id] = (stampCount[r.student_profile_id] ?? 0) + 1;
        });
        const returners = Object.values(stampCount).filter(c => c > 1).length;
        const returnVisitRate = loyaltyMembers > 0 ? (returners / loyaltyMembers) * 100 : 0;

        // ROI estimates
        const multiplier = 2.4;
        const baselineVisits = loyaltyMembers;
        const loyaltyVisits  = loyaltyMembers * multiplier;
        const extraVisits    = loyaltyVisits - baselineVisits;
        const estimatedExtraRevenue = Math.round(extraVisits * avgSpend);

        // Acquisition cost saving: avg cost to acquire a customer via ads ~3000 HUF
        const acqCostPerCustomer = 3000;
        const estimatedSavingsOnAcq = loyaltyMembers * acqCostPerCustomer;

        if (!cancelled) {
          setData({
            loyaltyMembers,
            stampsThisMonth,
            rewardsGiven,
            repeatVisitMultiplier: multiplier,
            avgSpendEstimate: avgSpend,
            estimatedExtraRevenue,
            estimatedSavingsOnAcq,
            returnVisitRate,
          });
        }
      } catch (_) {
        // Silently fail — widget just stays hidden
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [vendorId, avgSpend]);

  if (loading || !data || data.loyaltyMembers === 0) return null;

  return (
    <div className="bg-gradient-to-br from-emerald-600 via-vendor-600 to-teal-700 rounded-2xl p-5 text-white mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="opacity-80" />
            <p className="text-sm font-bold opacity-90">Your loyalty ROI estimate</p>
          </div>
          <p className="text-xs text-white/60">Based on {data.loyaltyMembers} loyalty members · {data.repeatVisitMultiplier}× repeat-visit multiplier</p>
        </div>
        <Link
          href="/vendor/analytics"
          className="flex items-center gap-1 text-xs font-bold text-white/80 hover:text-white transition-colors whitespace-nowrap"
        >
          Full analytics <ChevronRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Extra revenue estimate */}
        <div className="bg-white/15 rounded-xl p-3.5">
          <p className="text-2xl font-black leading-none mb-1">
            <AnimatedNumber value={Math.round(data.estimatedExtraRevenue / 1000)} suffix="K" />
            <span className="text-sm font-bold ml-1 opacity-70">HUF</span>
          </p>
          <p className="text-[10px] text-white/70 font-medium leading-tight">Estimated extra revenue<br/>from loyalty effect</p>
        </div>

        {/* Acquisition savings */}
        <div className="bg-white/15 rounded-xl p-3.5">
          <p className="text-2xl font-black leading-none mb-1">
            <AnimatedNumber value={Math.round(data.estimatedSavingsOnAcq / 1000)} suffix="K" />
            <span className="text-sm font-bold ml-1 opacity-70">HUF</span>
          </p>
          <p className="text-[10px] text-white/70 font-medium leading-tight">Saved vs paid ads<br/>for same reach</p>
        </div>

        {/* Return visit rate */}
        <div className="bg-white/15 rounded-xl p-3.5">
          <p className="text-2xl font-black leading-none mb-1">
            <AnimatedNumber value={Math.round(data.returnVisitRate)} suffix="%" />
          </p>
          <p className="text-[10px] text-white/70 font-medium leading-tight">Students who<br/>came back</p>
        </div>

        {/* Rewards given */}
        <div className="bg-white/15 rounded-xl p-3.5">
          <p className="text-2xl font-black leading-none mb-1">
            <AnimatedNumber value={data.rewardsGiven} />
          </p>
          <p className="text-[10px] text-white/70 font-medium leading-tight">Free rewards<br/>redeemed</p>
        </div>
      </div>

      {/* Avg spend adjuster */}
      <div className="mt-4 flex items-center gap-3">
        <p className="text-[10px] text-white/50 flex-shrink-0">Avg spend/visit:</p>
        <div className="flex items-center gap-1.5">
          {[500, 1000, 1500, 2500, 5000].map(v => (
            <button
              key={v}
              onClick={() => setAvgSpend(v)}
              className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors ${
                avgSpend === v ? 'bg-white text-vendor-700' : 'bg-white/20 text-white/70 hover:bg-white/30'
              }`}
            >
              {v >= 1000 ? `${v/1000}K` : v} HUF
            </button>
          ))}
        </div>
        <p className="text-[9px] text-white/40 ml-auto">estimates only</p>
      </div>
    </div>
  );
}
