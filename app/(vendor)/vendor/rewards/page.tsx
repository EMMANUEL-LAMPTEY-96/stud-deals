'use client';

// =============================================================================
// app/(vendor)/vendor/rewards/page.tsx — Reward Claim Queue
//
// Shows all redemptions with status = 'reward_earned' that students haven't
// yet physically claimed. The vendor sees: student name, which offer, what the
// reward is, when it was earned, and a "Mark as claimed" button.
//
// Claiming updates the redemption status to 'confirmed' (same status used when
// the vendor confirms a standard voucher redemption).
//
// Also shows a "Claimed today" history at the bottom.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Gift, CheckCircle, Loader2, Clock, User, Star,
  AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, Trophy,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoyaltyConfig {
  mode: string;
  reward_label?: string;
  required_visits?: number;
  tiers?: { stamps: number; reward_label: string }[];
}

interface RewardRow {
  id: string;
  status: string;
  redemption_code: string;
  confirmed_at: string;
  claimed_at: string;
  offer: {
    id: string;
    title: string;
    terms_and_conditions: string | null;
  } | null;
  student_profile_id: string;
  student_name: string;
  student_initials: string;
  reward_label: string;
  is_tier: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLoyaltyConfig(tc: string | null): LoyaltyConfig | null {
  if (!tc) return null;
  const m = tc.match(/^\[\[LOYALTY:(.*?)\]\]/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function extractRewardLabel(tc: string | null, isTier: boolean, redemptionCode: string): string {
  const lc = parseLoyaltyConfig(tc);
  if (!lc) return 'Free reward';
  if (isTier && lc.tiers) {
    const match = redemptionCode.match(/^TIER-(\d+)-/);
    if (match) {
      const stamps = parseInt(match[1]);
      const tier = lc.tiers.find(t => t.stamps === stamps);
      if (tier) return tier.reward_label;
    }
  }
  return lc.reward_label ?? 'Free reward';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RewardsPage() {
  const router  = useRouter();
  const supabase = createClient();

  const [vendorId, setVendorId]     = useState<string | null>(null);
  const [pending, setPending]       = useState<RewardRow[]>([]);
  const [claimed, setClaimed]       = useState<RewardRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [claiming, setClaiming]     = useState<Set<string>>(new Set());
  const [showClaimed, setShowClaimed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadRewards = useCallback(async (vid: string) => {
    // Step 1: fetch pending rewards (reward_earned + tier_reward not yet confirmed)
    const { data: rawPending } = await supabase
      .from('redemptions')
      .select(`
        id, status, redemption_code, confirmed_at, claimed_at, student_id,
        offer:offers(id, title, terms_and_conditions)
      `)
      .eq('vendor_id', vid)
      .in('status', ['reward_earned', 'tier_reward'])
      .order('confirmed_at', { ascending: false })
      .limit(100);

    // Step 2: fetch today's confirmed rewards (claimed in last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rawClaimed } = await supabase
      .from('redemptions')
      .select(`
        id, status, redemption_code, confirmed_at, claimed_at, student_id,
        offer:offers(id, title, terms_and_conditions)
      `)
      .eq('vendor_id', vid)
      .eq('status', 'confirmed')
      .gte('claimed_at', since)
      .order('claimed_at', { ascending: false })
      .limit(50);

    // Step 3: resolve student names for all rows
    const allRows = [...(rawPending ?? []), ...(rawClaimed ?? [])];
    const studentIds = [...new Set(allRows.map((r: any) => r.student_id))];

    const nameMap: Record<string, string> = {};
    if (studentIds.length > 0) {
      // Get user_ids from student_profiles
      const { data: spRows } = await supabase
        .from('student_profiles')
        .select('id, user_id')
        .in('id', studentIds);
      const userIds = (spRows ?? []).map((r: any) => r.user_id);
      const spMap: Record<string, string> = {};
      (spRows ?? []).forEach((r: any) => { spMap[r.id] = r.user_id; });

      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, display_name')
          .in('id', userIds);
        const profileMap: Record<string, any> = {};
        (profileRows ?? []).forEach((p: any) => { profileMap[p.id] = p; });

        studentIds.forEach(sid => {
          const uid = spMap[sid];
          const p = uid ? profileMap[uid] : null;
          nameMap[sid] = p?.first_name
            ? `${p.first_name} ${p.last_name ?? ''}`.trim()
            : p?.display_name ?? 'Student';
        });
      }
    }

    const toRow = (r: any): RewardRow => {
      const isTier = r.status === 'tier_reward' || (r.redemption_code ?? '').startsWith('TIER-');
      const offer = Array.isArray(r.offer) ? r.offer[0] : r.offer;
      const sName = nameMap[r.student_id] ?? 'Student';
      return {
        id: r.id,
        status: r.status,
        redemption_code: r.redemption_code ?? '',
        confirmed_at: r.confirmed_at,
        claimed_at: r.claimed_at,
        offer: offer ?? null,
        student_profile_id: r.student_id,
        student_name: sName,
        student_initials: initials(sName),
        reward_label: extractRewardLabel(offer?.terms_and_conditions ?? null, isTier, r.redemption_code ?? ''),
        is_tier: isTier,
      };
    };

    setPending((rawPending ?? []).map(toRow));
    setClaimed((rawClaimed ?? []).map(toRow));
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (!vp) { router.push('/vendor'); return; }
      setVendorId(vp.id);
      await loadRewards(vp.id);
      setLoading(false);
    })();
  }, []);

  const handleClaim = async (row: RewardRow) => {
    if (!vendorId) return;
    setClaiming(prev => new Set(prev).add(row.id));
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('redemptions')
      .update({ status: 'confirmed', claimed_at: now })
      .eq('id', row.id);
    if (!error) {
      setPending(prev => prev.filter(r => r.id !== row.id));
      setClaimed(prev => [{ ...row, status: 'confirmed', claimed_at: now }, ...prev]);
    }
    setClaiming(prev => { const s = new Set(prev); s.delete(row.id); return s; });
  };

  const handleRefresh = async () => {
    if (!vendorId) return;
    setRefreshing(true);
    await loadRewards(vendorId);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <>
        <Navbar /><VendorNav />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-vendor-600" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Reward queue</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Students who have earned a reward and are waiting to claim it
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Pending count banner */}
          {pending.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Gift size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-amber-900">
                  {pending.length} reward{pending.length !== 1 ? 's' : ''} waiting to be claimed
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Ask students to show their Stud Deals app, then mark as claimed after handing out the reward.
                </p>
              </div>
            </div>
          )}

          {/* Pending rewards list */}
          <div className="space-y-3 mb-8">
            {pending.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle size={28} className="text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">All clear!</p>
                  <p className="text-sm text-gray-400 mt-1">No rewards waiting to be claimed right now.</p>
                </div>
              </div>
            ) : (
              pending.map((row) => (
                <div key={row.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    {/* Student avatar */}
                    <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-brand-700">{row.student_initials}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">{row.student_name}</p>
                        {row.is_tier ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            Tier milestone
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Cycle complete
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {row.offer?.title ?? 'Loyalty reward'}
                      </p>
                    </div>

                    {/* Reward + time */}
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-xs font-bold text-gray-800">{row.reward_label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-end gap-1">
                        <Clock size={11} /> {timeAgo(row.confirmed_at)}
                      </p>
                    </div>

                    {/* Claim button */}
                    <button
                      onClick={() => handleClaim(row)}
                      disabled={claiming.has(row.id)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-vendor-600 text-white text-sm font-bold hover:bg-vendor-700 transition-colors disabled:opacity-60 ml-2"
                    >
                      {claiming.has(row.id)
                        ? <Loader2 size={14} className="animate-spin" />
                        : <CheckCircle size={14} />}
                      Mark claimed
                    </button>
                  </div>

                  {/* Reward label full-width on mobile */}
                  <div className="sm:hidden px-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg font-semibold">
                      <Sparkles size={12} />
                      {row.reward_label}
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={11} /> {timeAgo(row.confirmed_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Claimed today (collapsible) */}
          {claimed.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowClaimed(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trophy size={15} className="text-green-600" />
                  <span className="text-sm font-bold text-gray-700">
                    Claimed in the last 24 hours ({claimed.length})
                  </span>
                </div>
                {showClaimed ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>

              {showClaimed && (
                <div className="border-t border-gray-100">
                  {claimed.map((row) => (
                    <div key={row.id} className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 last:border-b-0">
                      <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-green-700">{row.student_initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700">{row.student_name}</p>
                        <p className="text-xs text-gray-400 truncate">{row.reward_label} · {row.offer?.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                        <CheckCircle size={13} />
                        Claimed {timeAgo(row.claimed_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info box */}
          <div className="mt-6 flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <AlertCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Students earn rewards by collecting stamps on your loyalty card.
              When they hit the target, they appear here. Hand out the reward in person, then tap{' '}
              <strong>Mark claimed</strong> to log it. Unclaimed rewards stay here until you action them.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
