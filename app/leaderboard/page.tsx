'use client';

/**
 * /leaderboard — Public institution leaderboard
 * No login required — shareable and embeddable.
 * Shows which universities are saving the most on Unideals.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import { Trophy, TrendingUp, Users, Zap, Medal, Crown, Star } from 'lucide-react';
import { fmtHUF } from '@/lib/currency';

interface InstitutionStat {
  institution_id: string;
  institution_name: string;
  city: string;
  total_redemptions: number;
  total_savings_huf: number;
  active_students: number;
  rank: number;
}

const RANK_ICONS = [
  <Crown key={1} size={20} className="text-yellow-400" />,
  <Medal key={2} size={20} className="text-gray-400" />,
  <Medal key={3} size={20} className="text-amber-600" />,
];

const CITY_EMOJI: Record<string, string> = {
  Budapest: '🏙️',
  Szeged: '🌅',
  Debrecen: '🌿',
  Pécs: '🏛️',
  Győr: '⚙️',
  Miskolc: '🏔️',
};

export default function LeaderboardPage() {
  const [stats, setStats] = useState<InstitutionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'semester' | 'month' | 'all'>('semester');

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  async function loadLeaderboard() {
    setLoading(true);
    const supabase = createClient();

    let fromDate: string | null = null;
    const now = new Date();
    if (period === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      fromDate = m.toISOString();
    } else if (period === 'semester') {
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      if (month >= 9) fromDate = `${year}-09-01`;
      else if (month >= 2) fromDate = `${year}-02-01`;
      else fromDate = `${year - 1}-09-01`;
    }

    try {
      // Get all confirmed redemptions with institution data
      let query = supabase
        .from('redemptions')
        .select(`
          savings_amount_huf,
          confirmed_at,
          student_profiles!inner(
            institution_id,
            institutions(id, name, city)
          )
        `)
        .eq('status', 'confirmed');

      if (fromDate) {
        query = query.gte('confirmed_at', fromDate);
      }

      const { data: redemptions } = await query;

      if (!redemptions?.length) {
        setStats([]);
        setLoading(false);
        return;
      }

      // Aggregate by institution
      const map: Record<string, {
        name: string; city: string;
        totalSavings: number; totalRedemptions: number; students: Set<string>;
      }> = {};

      for (const r of redemptions) {
        const sp = Array.isArray(r.student_profiles) ? r.student_profiles[0] : r.student_profiles;
        if (!sp?.institution_id || !sp.institutions) continue;
        const inst = Array.isArray(sp.institutions) ? sp.institutions[0] : sp.institutions;
        if (!inst) continue;

        const id = sp.institution_id;
        if (!map[id]) {
          map[id] = { name: inst.name, city: inst.city, totalSavings: 0, totalRedemptions: 0, students: new Set() };
        }
        map[id].totalSavings += r.savings_amount_huf ?? 0;
        map[id].totalRedemptions += 1;
        // We can't identify unique students without PII — use redemption count as proxy
      }

      const ranked: InstitutionStat[] = Object.entries(map)
        .map(([id, d]) => ({
          institution_id: id,
          institution_name: d.name,
          city: d.city,
          total_redemptions: d.totalRedemptions,
          total_savings_huf: d.totalSavings,
          active_students: d.students.size,
          rank: 0,
        }))
        .sort((a, b) => b.total_savings_huf - a.total_savings_huf)
        .map((item, i) => ({ ...item, rank: i + 1 }));

      setStats(ranked);
    } catch (_) {
      setStats([]);
    } finally {
      setLoading(false);
    }
  }

  const topThree = stats.slice(0, 3);
  const rest = stats.slice(3);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-surface-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
              <Trophy size={15} />
              University Leaderboard
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
              Who's saving the most? 🏆
            </h1>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Verified students saving the most on Unideals — ranked by university.
              Updated weekly.
            </p>
          </div>

          {/* Period selector */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm">
              {(['semester', 'month', 'all'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    period === p
                      ? 'bg-brand-600 text-white shadow'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {p === 'semester' ? 'This Semester' : p === 'month' ? 'This Month' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100" />
              ))}
            </div>
          ) : stats.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Trophy size={48} className="mx-auto mb-3 opacity-30" />
              <p>No data yet for this period.</p>
              <p className="text-sm mt-1">Be the first to redeem and put your university on the map!</p>
            </div>
          ) : (
            <>
              {/* Top 3 podium */}
              {topThree.length >= 2 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {/* 2nd place */}
                  {topThree[1] && (
                    <div className="col-start-1 flex flex-col items-center pt-6">
                      <div className="text-2xl mb-1">{RANK_ICONS[1]}</div>
                      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-3 text-center w-full">
                        <div className="text-lg font-black text-gray-900">{CITY_EMOJI[topThree[1].city] ?? '🎓'}</div>
                        <div className="text-xs font-bold text-gray-700 mt-1 leading-tight line-clamp-2">{topThree[1].institution_name}</div>
                        <div className="text-brand-600 font-black text-sm mt-2">{fmtHUF(topThree[1].total_savings_huf)}</div>
                        <div className="text-xs text-gray-400">{topThree[1].total_redemptions} deals</div>
                      </div>
                    </div>
                  )}

                  {/* 1st place */}
                  {topThree[0] && (
                    <div className="col-start-2 flex flex-col items-center">
                      <div className="text-2xl mb-1">{RANK_ICONS[0]}</div>
                      <div className="bg-gradient-to-b from-yellow-50 to-white border-2 border-yellow-300 rounded-2xl shadow-lg p-3 text-center w-full">
                        <div className="text-2xl font-black text-gray-900">{CITY_EMOJI[topThree[0].city] ?? '🎓'}</div>
                        <div className="text-xs font-bold text-gray-700 mt-1 leading-tight line-clamp-2">{topThree[0].institution_name}</div>
                        <div className="text-brand-700 font-black text-base mt-2">{fmtHUF(topThree[0].total_savings_huf)}</div>
                        <div className="text-xs text-gray-400">{topThree[0].total_redemptions} deals</div>
                      </div>
                    </div>
                  )}

                  {/* 3rd place */}
                  {topThree[2] && (
                    <div className="col-start-3 flex flex-col items-center pt-10">
                      <div className="text-2xl mb-1">{RANK_ICONS[2]}</div>
                      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-3 text-center w-full">
                        <div className="text-lg font-black text-gray-900">{CITY_EMOJI[topThree[2].city] ?? '🎓'}</div>
                        <div className="text-xs font-bold text-gray-700 mt-1 leading-tight line-clamp-2">{topThree[2].institution_name}</div>
                        <div className="text-brand-600 font-black text-sm mt-2">{fmtHUF(topThree[2].total_savings_huf)}</div>
                        <div className="text-xs text-gray-400">{topThree[2].total_redemptions} deals</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rest of the rankings */}
              <div className="space-y-2">
                {(topThree.length < 3 ? stats : rest).map(inst => (
                  <div
                    key={inst.institution_id}
                    className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:border-brand-200 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-600 text-sm flex-shrink-0">
                      #{inst.rank}
                    </div>
                    <div className="text-xl flex-shrink-0">{CITY_EMOJI[inst.city] ?? '🎓'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-sm truncate">{inst.institution_name}</div>
                      <div className="text-xs text-gray-400">{inst.city} · {inst.total_redemptions} redemptions</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-brand-600 text-sm">{fmtHUF(inst.total_savings_huf)}</div>
                      <div className="text-xs text-gray-400">saved</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-8 bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-6 text-center text-white">
                <Star size={24} className="mx-auto mb-2 text-yellow-300" />
                <h3 className="font-black text-lg mb-1">Help your university climb the rankings!</h3>
                <p className="text-white/80 text-sm mb-4">Every deal you redeem adds to your university's score.</p>
                <a
                  href="/sign-up/student"
                  className="inline-flex items-center gap-2 bg-white text-brand-700 font-bold px-6 py-3 rounded-xl hover:bg-brand-50 transition-colors text-sm"
                >
                  Join Unideals Free
                  <TrendingUp size={16} />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
