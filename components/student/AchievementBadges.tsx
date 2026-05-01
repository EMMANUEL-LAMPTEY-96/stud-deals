'use client';

// =============================================================================
// components/student/AchievementBadges.tsx
//
// Gamification badge strip shown on the student dashboard.
// Badges are earned by accumulating stamps and confirmed rewards across
// ALL vendors. The component fetches the student's total stamp count and
// reward count from the redemptions table, then renders a horizontal
// scroll of locked/unlocked badges.
//
// Badge tiers (stamps):
//   🌱 First Stamp     — 1 stamp
//   ☕ Coffee Regular  — 5 stamps
//   🎯 Deal Hunter     — 10 stamps
//   🔥 On a Roll       — 25 stamps
//   ⭐ Loyalty Star    — 50 stamps
//   💎 Campus Legend   — 100 stamps
//   🚀 Deal God        — 250 stamps
//
// Badge tiers (rewards):
//   🎁 First Reward    — 1 confirmed reward
//   🏆 Freebie Fan     — 5 confirmed rewards
//   👑 Reward Royalty  — 10 confirmed rewards
// =============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  requirement: string;
  threshold: number;
  type: 'stamps' | 'rewards';
  color: string;
  glow: string;
}

const BADGES: Badge[] = [
  {
    id: 'first_stamp',
    emoji: '🌱',
    label: 'First Stamp',
    description: 'You scanned your first QR and earned your first stamp!',
    requirement: '1 stamp',
    threshold: 1,
    type: 'stamps',
    color: 'from-emerald-400 to-green-500',
    glow: 'shadow-green-200',
  },
  {
    id: 'coffee_regular',
    emoji: '☕',
    label: 'Coffee Regular',
    description: 'You\'re becoming a regular — 5 stamps earned.',
    requirement: '5 stamps',
    threshold: 5,
    type: 'stamps',
    color: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-200',
  },
  {
    id: 'deal_hunter',
    emoji: '🎯',
    label: 'Deal Hunter',
    description: 'Seriously good at this — 10 stamps collected.',
    requirement: '10 stamps',
    threshold: 10,
    type: 'stamps',
    color: 'from-blue-400 to-indigo-500',
    glow: 'shadow-blue-200',
  },
  {
    id: 'on_a_roll',
    emoji: '🔥',
    label: 'On a Roll',
    description: 'You\'re on fire — 25 stamps and counting!',
    requirement: '25 stamps',
    threshold: 25,
    type: 'stamps',
    color: 'from-red-400 to-orange-500',
    glow: 'shadow-red-200',
  },
  {
    id: 'loyalty_star',
    emoji: '⭐',
    label: 'Loyalty Star',
    description: 'Half a century of stamps. You\'re a true loyalty champion.',
    requirement: '50 stamps',
    threshold: 50,
    type: 'stamps',
    color: 'from-yellow-400 to-amber-500',
    glow: 'shadow-yellow-200',
  },
  {
    id: 'campus_legend',
    emoji: '💎',
    label: 'Campus Legend',
    description: '100 stamps — you\'re a campus institution.',
    requirement: '100 stamps',
    threshold: 100,
    type: 'stamps',
    color: 'from-cyan-400 to-blue-500',
    glow: 'shadow-cyan-200',
  },
  {
    id: 'deal_god',
    emoji: '🚀',
    label: 'Deal God',
    description: '250 stamps — basically a professional student.',
    requirement: '250 stamps',
    threshold: 250,
    type: 'stamps',
    color: 'from-purple-400 to-pink-500',
    glow: 'shadow-purple-200',
  },
  {
    id: 'first_reward',
    emoji: '🎁',
    label: 'First Reward',
    description: 'You claimed your very first loyalty reward. Enjoy!',
    requirement: '1 reward',
    threshold: 1,
    type: 'rewards',
    color: 'from-pink-400 to-rose-500',
    glow: 'shadow-pink-200',
  },
  {
    id: 'freebie_fan',
    emoji: '🏆',
    label: 'Freebie Fan',
    description: '5 free rewards earned through loyalty — nice work.',
    requirement: '5 rewards',
    threshold: 5,
    type: 'rewards',
    color: 'from-orange-400 to-red-500',
    glow: 'shadow-orange-200',
  },
  {
    id: 'reward_royalty',
    emoji: '👑',
    label: 'Reward Royalty',
    description: 'Ten confirmed rewards. Loyalty is paying off.',
    requirement: '10 rewards',
    threshold: 10,
    type: 'rewards',
    color: 'from-violet-400 to-purple-600',
    glow: 'shadow-violet-200',
  },
];

interface Props {
  studentProfileId: string;
}

export default function AchievementBadges({ studentProfileId }: Props) {
  const supabase = createClient();
  const [totalStamps, setTotalStamps] = useState(0);
  const [totalRewards, setTotalRewards] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tooltipId, setTooltipId] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!studentProfileId) return;
    (async () => {
      const { data } = await supabase
        .from('redemptions')
        .select('status')
        .eq('student_profile_id', studentProfileId)
        .in('status', ['stamp', 'reward_earned', 'tier_reward', 'confirmed']);

      const rows = data ?? [];
      const stamps  = rows.filter(r => r.status === 'stamp').length;
      const rewards = rows.filter(r => r.status === 'confirmed').length;

      // Check which badges are newly earned (vs cached in localStorage)
      const storageKey = `badges_seen_${studentProfileId}`;
      const seen: string[] = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      const freshlyUnlocked = new Set<string>();

      BADGES.forEach(b => {
        const val = b.type === 'stamps' ? stamps : rewards;
        if (val >= b.threshold && !seen.includes(b.id)) {
          freshlyUnlocked.add(b.id);
        }
      });

      if (freshlyUnlocked.size > 0) {
        const allSeen = [...seen, ...Array.from(freshlyUnlocked)];
        localStorage.setItem(storageKey, JSON.stringify(allSeen));
        setNewlyUnlocked(freshlyUnlocked);
      }

      setTotalStamps(stamps);
      setTotalRewards(rewards);
      setLoading(false);
    })();
  }, [studentProfileId]);

  if (loading || (totalStamps === 0 && totalRewards === 0)) return null;

  const unlockedCount = BADGES.filter(b => {
    const val = b.type === 'stamps' ? totalStamps : totalRewards;
    return val >= b.threshold;
  }).length;

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🏅</span>
          <p className="text-sm font-bold text-gray-900">Achievements</p>
          <span className="bg-vendor-100 text-vendor-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {unlockedCount}/{BADGES.length}
          </span>
        </div>
        <p className="text-xs text-gray-400">{totalStamps} stamps · {totalRewards} rewards</p>
      </div>

      {/* Badge strip */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {BADGES.map(badge => {
          const val = badge.type === 'stamps' ? totalStamps : totalRewards;
          const unlocked = val >= badge.threshold;
          const isNew = newlyUnlocked.has(badge.id);

          return (
            <div
              key={badge.id}
              className="relative flex-shrink-0"
              onMouseEnter={() => setTooltipId(badge.id)}
              onMouseLeave={() => setTooltipId(null)}
              onTouchStart={() => setTooltipId(tooltipId === badge.id ? null : badge.id)}
            >
              {/* Badge circle */}
              <div
                className={`
                  w-16 h-16 rounded-2xl flex flex-col items-center justify-center cursor-pointer
                  transition-all duration-200 select-none
                  ${unlocked
                    ? `bg-gradient-to-br ${badge.color} shadow-lg ${badge.glow} ${isNew ? 'scale-110 ring-2 ring-white ring-offset-2' : 'hover:scale-105'}`
                    : 'bg-gray-100 opacity-40 grayscale'
                  }
                `}
              >
                <span className={`${unlocked ? 'text-2xl' : 'text-xl grayscale'}`}>{badge.emoji}</span>
              </div>

              {/* "NEW" ribbon */}
              {isNew && (
                <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-sm animate-bounce">
                  NEW
                </div>
              )}

              {/* Label */}
              <p className={`text-[9px] font-semibold text-center mt-1.5 leading-tight w-16 truncate ${unlocked ? 'text-gray-700' : 'text-gray-300'}`}>
                {badge.label}
              </p>

              {/* Tooltip */}
              {tooltipId === badge.id && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-48 bg-gray-900 text-white rounded-xl px-3 py-2.5 text-xs shadow-xl pointer-events-none">
                  <p className="font-bold mb-1">{badge.emoji} {badge.label}</p>
                  <p className="text-white/70 text-[11px] leading-relaxed mb-1.5">
                    {unlocked ? badge.description : `Earn ${badge.requirement} to unlock`}
                  </p>
                  {!unlocked && (
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-vendor-400 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min((val / badge.threshold) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                  {!unlocked && (
                    <p className="text-white/50 text-[10px] mt-1">
                      {val} / {badge.threshold} {badge.type === 'stamps' ? 'stamps' : 'rewards'}
                    </p>
                  )}
                  {/* Tooltip arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
