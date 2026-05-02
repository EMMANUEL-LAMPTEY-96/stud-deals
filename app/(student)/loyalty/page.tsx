'use client';

// =============================================================================
// app/(student)/loyalty/page.tsx — Student Loyalty Cards
//
// Shows all punch cards a student has started across all vendors.
// Each card displays:
//   - Vendor name, logo, city
//   - Progress: X / Y stamps in current cycle
//   - Visual punch dots (filled vs empty)
//   - Reward label (what they're working towards)
//   - Completed cycles count (times they've earned the reward)
//   - "Earn stamp" shortcut — links to /stamp/[vendorId]
//   - Highlight for nearly-complete cards (≥ 80% progress)
//
// Data source: redemptions table joined to vendor_profiles + offers
// Auth: requires verified student
// =============================================================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Stamp, Trophy, Coffee, MapPin, ArrowRight,
  Loader2, AlertCircle, Sparkles, Star, Gift,
  CheckCircle2, QrCode, GraduationCap,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface LoyaltyCard {
  vendor_id: string;
  offer_id: string;
  vendor_name: string;
  vendor_logo: string | null;
  vendor_city: string | null;
  offer_title: string;
  required_visits: number;
  reward_label: string;
  stamps_in_cycle: number;   // progress in current cycle
  total_stamps: number;      // all-time stamps at this vendor
  cycles_completed: number;  // number of times reward was fully earned
  last_visited: string;      // ISO date of most recent stamp
  is_active: boolean;        // whether the offer is still active
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Punch card visual ─────────────────────────────────────────────────────────

function PunchDots({ filled, total, small = false }: { filled: number; total: number; small?: boolean }) {
  const displayTotal = Math.min(total, 12);
  const dotSize = small ? 'w-6 h-6' : 'w-8 h-8';
  const iconSize = small ? 11 : 14;

  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: displayTotal }).map((_, i) => (
        <div
          key={i}
          className={`
            ${dotSize} rounded-full flex items-center justify-center
            ${i < filled
              ? 'bg-brand-600 shadow-sm shadow-brand-200'
              : 'bg-gray-100 border border-dashed border-gray-300'
            }
          `}
        >
          {i < filled && <Stamp size={iconSize} className="text-white" />}
        </div>
      ))}
      {total > 12 && (
        <div className={`${dotSize} rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-400`}>
          +{total - 12}
        </div>
      )}
    </div>
  );
}

// ── Card component ────────────────────────────────────────────────────────────

function LoyaltyCardItem({ card }: { card: LoyaltyCard }) {
  const pct = card.required_visits > 0 ? (card.stamps_in_cycle / card.required_visits) * 100 : 0;
  const isNearComplete = pct >= 80 && pct < 100;
  const isComplete = pct >= 100;
  const isInactive = !card.is_active;

  return (
    <div className={`
      bg-white rounded-2xl p-4 border transition-all
      ${isNearComplete ? 'border-brand-300 shadow-md shadow-brand-100' : 'border-gray-100 shadow-sm'}
      ${isInactive ? 'opacity-60' : ''}
    `}>
      {/* Near-complete badge */}
      {isNearComplete && (
        <div className="flex items-center gap-1.5 mb-3 text-brand-700 text-xs font-bold bg-brand-50 rounded-lg px-2.5 py-1.5 w-fit">
          <Sparkles size={12} /> Almost there!
        </div>
      )}

      {/* Vendor header */}
      <div className="flex items-start gap-3 mb-4">
        {card.vendor_logo ? (
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
            <Image src={card.vendor_logo} alt={card.vendor_name} width={44} height={44} className="object-cover w-full h-full" />
          </div>
        ) : (
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex-shrink-0 flex items-center justify-center shadow-sm">
            <Coffee size={18} className="text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-gray-900 text-sm truncate">{card.vendor_name}</h3>
          {card.vendor_city && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {card.vendor_city}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(card.last_visited)}</p>
        </div>
        {card.cycles_completed > 0 && (
          <div className="flex items-center gap-1 bg-amber-50 text-amber-700 rounded-lg px-2 py-1 text-xs font-bold flex-shrink-0">
            <Trophy size={11} /> {card.cycles_completed}×
          </div>
        )}
      </div>

      {/* Offer title */}
      <p className="text-xs font-semibold text-gray-500 mb-2">{card.offer_title}</p>

      {/* Stamp dots */}
      <div className="mb-3">
        <PunchDots filled={card.stamps_in_cycle} total={card.required_visits} />
      </div>

      {/* Progress line */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">
          <span className="font-black text-brand-700">{card.stamps_in_cycle}</span>
          <span className="text-gray-400"> / {card.required_visits}</span>
          <span className="text-gray-400"> stamps</span>
        </p>
        {card.required_visits > card.stamps_in_cycle ? (
          <p className="text-xs text-gray-400">
            {card.required_visits - card.stamps_in_cycle} more for{' '}
            <span className="font-semibold text-gray-600">{card.reward_label}</span>
          </p>
        ) : (
          <div className="flex items-center gap-1 text-xs font-bold text-green-600">
            <Gift size={12} /> {card.reward_label} ready!
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isComplete ? 'bg-amber-500' : isNearComplete ? 'bg-brand-500' : 'bg-brand-400'
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Earn stamp CTA */}
      {card.is_active ? (
        <Link
          href={`/stamp/${card.vendor_id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-colors"
        >
          <QrCode size={15} /> Earn stamp at {card.vendor_name.split(' ')[0]}
        </Link>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-100 text-gray-400 text-sm rounded-xl">
          <AlertCircle size={15} /> Programme ended
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LoyaltyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!user) {
          router.push('/sign-in?next=/loyalty');
          return;
        }

        // Student profile
        const { data: sp } = await supabase
          .from('student_profiles')
          .select('id, verification_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (!sp || sp.verification_status !== 'verified') {
          setIsVerified(false);
          setLoading(false);
          return;
        }

        const studentProfileId = sp.id;

        // Fetch all stamps for this student
        const { data: redemptions, error: rdError } = await supabase
          .from('redemptions')
          .select(`
            vendor_id,
            status,
            claimed_at,
            vendor_profiles!inner (
              id,
              business_name,
              city,
              logo_url
            )
          `)
          .eq('student_profile_id', studentProfileId)
          .in('status', ['stamp', 'reward_earned', 'tier_reward', 'confirmed'])
          .order('claimed_at', { ascending: false });

        if (cancelled) return;

        if (rdError) {
          setError('Failed to load your loyalty cards. Please refresh.');
          setLoading(false);
          return;
        }

        const rows = redemptions ?? [];

        // Get unique vendor IDs
        const vendorIds = [...new Set(rows.map(r => r.vendor_id))];

        if (vendorIds.length === 0) {
          setCards([]);
          setLoading(false);
          return;
        }

        // Fetch active punch card offers for those vendors
        const { data: offers } = await supabase
          .from('offers')
          .select('id, vendor_id, title, required_visits, reward_label, is_active')
          .in('vendor_id', vendorIds)
          .eq('offer_type', 'punch_card')
          .order('is_active', { ascending: false })
          .order('created_at', { ascending: false });

        if (cancelled) return;

        // Map vendor → most relevant offer (prefer active)
        const offerByVendor = new Map<string, typeof offers extends (infer T)[] | null ? T : never>();
        for (const o of offers ?? []) {
          if (!offerByVendor.has(o.vendor_id) || o.is_active) {
            offerByVendor.set(o.vendor_id, o);
          }
        }

        // Aggregate stamps per vendor
        interface VendorAgg {
          vendor_id: string;
          // @ts-ignore
          vendor_profile: any;
          total_stamps: number;
          all_time_events: number;
          last_visited: string;
          events: Array<{ status: string; claimed_at: string }>;
        }

        const vendorAgg = new Map<string, VendorAgg>();

        for (const row of rows) {
          const vid = row.vendor_id;
          const existing = vendorAgg.get(vid);

          if (!existing) {
            vendorAgg.set(vid, {
              vendor_id: vid,
              // @ts-ignore
              vendor_profile: row.vendor_profiles,
              total_stamps: row.status === 'stamp' ? 1 : 0,
              all_time_events: 1,
              last_visited: row.claimed_at,
              events: [{ status: row.status, claimed_at: row.claimed_at }],
            });
          } else {
            if (row.status === 'stamp') existing.total_stamps += 1;
            existing.all_time_events += 1;
            existing.events.push({ status: row.status, claimed_at: row.claimed_at });
            if (new Date(row.claimed_at) > new Date(existing.last_visited)) {
              existing.last_visited = row.claimed_at;
            }
          }
        }

        // Build loyalty cards
        const loyaltyCards: LoyaltyCard[] = [];

        for (const [vid, agg] of vendorAgg.entries()) {
          const offer = offerByVendor.get(vid);
          if (!offer) continue; // skip vendors with no punch card

          const req = offer.required_visits;

          // Count stamps in current cycle
          // Cycle: every req stamps = 1 completed cycle
          const stamps = agg.events
            .filter(e => e.status === 'stamp')
            .sort((a, b) => new Date(a.claimed_at).getTime() - new Date(b.claimed_at).getTime());

          const totalStamps = stamps.length;
          const cyclesCompleted = Math.floor(totalStamps / req);
          const stampsInCycle = totalStamps % req;

          const vp = agg.vendor_profile;

          loyaltyCards.push({
            vendor_id: vid,
            offer_id: offer.id,
            vendor_name: vp?.business_name ?? 'Unknown venue',
            vendor_logo: vp?.logo_url ?? null,
            vendor_city: vp?.city ?? null,
            offer_title: offer.title,
            required_visits: req,
            reward_label: offer.reward_label ?? 'Free reward',
            stamps_in_cycle: stampsInCycle,
            total_stamps: totalStamps,
            cycles_completed: cyclesCompleted,
            last_visited: agg.last_visited,
            is_active: offer.is_active,
          });
        }

        // Sort: nearly complete first, then by stamps in cycle desc, then by last visited
        loyaltyCards.sort((a, b) => {
          const aPct = a.stamps_in_cycle / a.required_visits;
          const bPct = b.stamps_in_cycle / b.required_visits;
          if (Math.abs(aPct - bPct) > 0.01) return bPct - aPct;
          return new Date(b.last_visited).getTime() - new Date(a.last_visited).getTime();
        });

        if (!cancelled) {
          setCards(loyaltyCards);
          setLoading(false);
        }
      } catch (_) {
        if (!cancelled) {
          setError('Something went wrong. Please try again.');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Unverified nudge ──────────────────────────────────────────────────────────
  if (!isVerified && !loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 pt-20 pb-16 px-4">
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 mx-auto mb-4 flex items-center justify-center shadow-lg">
              <GraduationCap size={36} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Verify to unlock loyalty</h1>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              Student verification unlocks loyalty stamps across all STUD-DEALS partner venues. It only takes 60 seconds.
            </p>
            <Link
              href="/verification"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-600 transition-colors"
            >
              Verify my student status <ArrowRight size={16} />
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading your loyalty cards…</p>
          </div>
        </main>
      </>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-gray-50 pt-20 px-4">
          <div className="max-w-md mx-auto pt-16 text-center">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-brand-600 text-white font-bold rounded-xl text-sm"
            >
              Retry
            </button>
          </div>
        </main>
      </>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  const activeCards = cards.filter(c => c.is_active);
  const inactiveCards = cards.filter(c => !c.is_active);
  const totalStampsAllTime = cards.reduce((s, c) => s + c.total_stamps, 0);
  const totalRewards = cards.reduce((s, c) => s + c.cycles_completed, 0);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-4">

          {/* Page header */}
          <div className="pt-8 pb-6">
            <h1 className="text-2xl font-black text-gray-900 mb-1">My Loyalty Cards</h1>
            <p className="text-gray-400 text-sm">Collect stamps at your favourite student spots</p>
          </div>

          {/* Stats strip */}
          {cards.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-2xl p-3.5 text-center border border-gray-100 shadow-sm">
                <p className="text-2xl font-black text-brand-700">{cards.length}</p>
                <p className="text-[11px] text-gray-400 font-medium">Venues</p>
              </div>
              <div className="bg-white rounded-2xl p-3.5 text-center border border-gray-100 shadow-sm">
                <p className="text-2xl font-black text-brand-700">{totalStampsAllTime}</p>
                <p className="text-[11px] text-gray-400 font-medium">Total stamps</p>
              </div>
              <div className="bg-white rounded-2xl p-3.5 text-center border border-gray-100 shadow-sm">
                <p className="text-2xl font-black text-amber-600">{totalRewards}</p>
                <p className="text-[11px] text-gray-400 font-medium">Rewards earned</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {cards.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 mx-auto mb-4 flex items-center justify-center">
                <Stamp size={32} className="text-brand-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">No stamps yet</h2>
              <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                Scan a venue's QR code to earn your first stamp and start building loyalty.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition-colors"
              >
                Browse partner venues <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {/* Active cards */}
          {activeCards.length > 0 && (
            <div className="space-y-4 mb-6">
              {activeCards.map(card => (
                <LoyaltyCardItem key={card.vendor_id} card={card} />
              ))}
            </div>
          )}

          {/* Inactive / ended programmes */}
          {inactiveCards.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">
                Ended programmes
              </h2>
              <div className="space-y-4">
                {inactiveCards.map(card => (
                  <LoyaltyCardItem key={card.vendor_id} card={card} />
                ))}
              </div>
            </div>
          )}

          {/* Find more venues CTA */}
          {cards.length > 0 && (
            <div className="mt-8 bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-5 text-white text-center">
              <Star size={24} className="mx-auto mb-2 opacity-80" />
              <h3 className="font-black mb-1">Discover more venues</h3>
              <p className="text-xs text-white/70 mb-4">Hundreds of student-friendly spots are waiting for you</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-brand-50 transition-colors"
              >
                Browse all deals <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
