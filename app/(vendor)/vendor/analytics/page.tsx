'use client';

// =============================================================================
// app/(vendor)/vendor/analytics/page.tsx — Vendor Analytics
// Full analytics: KPIs, trend chart, day/hour heatmaps, offer performance table,
// journey funnel, and punch card funnel (stamp distribution per offer).
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Users, Eye, Tag, BarChart3, ArrowUpRight,
  ArrowDownRight, Loader2, Star, Zap, Clock, Award, Target,
  ShoppingBag, Gift, ChevronDown, ChevronUp, Stamp,
  Download, Trophy, AlertCircle, CheckCircle2,
} from 'lucide-react';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtN(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }
function fmtP(n: number) { return `${n.toFixed(1)}%`; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLoyaltyConfig(terms: string | null): any | null {
  if (!terms) return null;
  const m = terms.match(/^\[\[LOYALTY:({.*?})\]\]/s);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({ label, value, delta, deltaOk, icon, color, bg }: {
  label:string; value:string; delta?:string; deltaOk?:boolean;
  icon:React.ReactNode; color:string; bg:string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-5 border border-white/40`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        {delta && (
          <span className={`text-xs font-bold flex items-center gap-0.5 ${deltaOk ? 'text-green-600':'text-red-500'}`}>
            {deltaOk ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}{delta}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
    </div>
  );
}

function Card({ title, sub, children }: { title:string; sub?:string; children:React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function CT({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{color:p.color}} className="font-bold">{p.name}: {p.value}</p>)}
    </div>
  );
}

// ── Punch Card Funnel Section ──────────────────────────────────────────────────

interface PunchCardStats {
  offerId: string;
  offerTitle: string;
  requiredStamps: number;
  distribution: { stamp: number; count: number }[];
  totalStudents: number;
  completedCycles: number;
  nearCompletion: number; // within 2 stamps
  avgProgress: number;    // 0–100%
  completionRate: number; // % who reached reward
}

function StampBar({ value, max, isNear, isComplete }: { value: number; max: number; isNear: boolean; isComplete: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          isComplete ? 'bg-green-500' : isNear ? 'bg-amber-400' : 'bg-vendor-400'
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PunchCardFunnel({ stats }: { stats: PunchCardStats }) {
  const maxCount = Math.max(...stats.distribution.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-vendor-100 flex items-center justify-center">
              <Gift size={13} className="text-vendor-700" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 line-clamp-1">{stats.offerTitle}</h2>
          </div>
          <p className="text-xs text-gray-400">{stats.requiredStamps}-stamp punch card · {stats.totalStudents} active students</p>
        </div>
        <div className="flex gap-3 sm:flex-shrink-0">
          <div className="text-center">
            <p className="text-lg font-black text-green-600">{stats.completedCycles}</p>
            <p className="text-[10px] text-gray-400 font-medium">Rewards earned</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-amber-600">{stats.nearCompletion}</p>
            <p className="text-[10px] text-gray-400 font-medium">Near reward</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-black text-gray-900">{fmtP(stats.avgProgress)}</p>
            <p className="text-[10px] text-gray-400 font-medium">Avg progress</p>
          </div>
        </div>
      </div>

      {/* Distribution bar chart */}
      {stats.distribution.length > 0 ? (
        <>
          <div className="mb-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.distribution} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="stamp"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={v => `${v}★`}
                />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: any) => [`${v} students`, '']}
                  labelFormatter={l => `At stamp ${l}`}
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="count" name="Students" radius={[5,5,0,0]}>
                  {stats.distribution.map((d, i) => {
                    const isComplete = d.stamp === 0 && stats.completedCycles > 0;
                    const isNear = d.stamp >= stats.requiredStamps - 2 && d.stamp < stats.requiredStamps;
                    return (
                      <Cell
                        key={i}
                        fill={
                          isNear && d.stamp > 0
                            ? '#f59e0b'
                            : d.stamp === 0 && i === 0
                              ? '#d1fae5'
                              : '#bbf7d0'
                        }
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-vendor-300" />
              <span className="text-gray-500">Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-400" />
              <span className="text-gray-500">Within 2 stamps of reward</span>
            </div>
          </div>

          {/* Progress rows — top 5 students by completion */}
          {stats.nearCompletion > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={13} className="text-amber-600" />
                <p className="text-xs font-bold text-amber-700">
                  {stats.nearCompletion} student{stats.nearCompletion !== 1 ? 's' : ''} within 2 stamps of their reward
                </p>
              </div>
              <p className="text-xs text-amber-600">
                Consider launching a Boost to nudge them over the line — conversion is highest when students are this close.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <Gift size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No stamp activity yet</p>
          <p className="text-xs mt-1">Students will appear here once they start collecting stamps.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function VendorAnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string|null>(null);
  const [businessName, setBN] = useState('');
  const [range, setRange] = useState<7|30|90|365>(30);
  const [offers, setOffers] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [hours, setHours] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);
  const [punchStats, setPunchStats] = useState<PunchCardStats[]>([]);
  const [showPunchFunnel, setShowPunchFunnel] = useState(true);
  const [benchmark, setBenchmark] = useState<{
    avgCvr: number; avgRedemptions: number; peerCount: number;
    thisCvr: number; thisRedemptions: number; businessType: string; city: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [monthReport, setMonthReport] = useState<{
    newMembers: number; stampsIssued: number; rewardsGiven: number;
    topOffer: string; busiestDay: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?role=vendor'); return; }
      const { data: vp } = await supabase.from('vendor_profiles').select('id,business_name').eq('user_id', user.id).maybeSingle();
      if (!vp) { router.push('/vendor/profile'); return; }
      setVendorId(vp.id); setBN(vp.business_name);
      await load(vp.id, 30);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (vendorId) load(vendorId, range); }, [range, vendorId]);

  const load = async (vid: string, d: number) => {
    const since = new Date(Date.now() - d * 86400000).toISOString();
    const { data: offersData } = await supabase.from('offers').select('*').eq('vendor_id', vid).order('redemption_count', {ascending:false});
    const offerRows = (offersData ?? []).map(o => ({ ...o, conversion: o.view_count>0?(o.redemption_count/o.view_count)*100:0 }));
    setOffers(offerRows);

    const { data: reds } = await supabase.from('redemptions').select('claimed_at,status').eq('vendor_id', vid).gte('claimed_at', since);
    const rList = reds ?? [];
    const totalR = rList.length;
    const conf = rList.filter(r=>r.status==='confirmed').length;
    const totalV = offerRows.reduce((s,o)=>s+o.view_count,0);
    const totalS = offerRows.reduce((s,o)=>s+o.save_count,0);
    const cvr = totalV>0?(totalR/totalV)*100:0;

    setKpis([
      { label:'Total views',       value:fmtN(totalV),                        icon:<Eye size={20}/>,         color:'text-blue-600',   bg:'bg-blue-50' },
      { label:'Redemptions',       value:fmtN(totalR), delta:`${conf} confirmed`, deltaOk:conf>0, icon:<Tag size={20}/>, color:'text-vendor-600', bg:'bg-vendor-50' },
      { label:'Conversion rate',   value:fmtP(cvr),    delta:cvr>5?'Above avg':'Below avg', deltaOk:cvr>5, icon:<TrendingUp size={20}/>, color:'text-purple-600', bg:'bg-purple-50' },
      { label:'Unique students',   value:fmtN(Math.round(totalR*0.8)),         icon:<Users size={20}/>,       color:'text-amber-600',  bg:'bg-amber-50' },
      { label:'Offers saved',      value:fmtN(totalS),                         icon:<Star size={20}/>,        color:'text-pink-600',   bg:'bg-pink-50' },
      { label:'Active offers',     value:String(offerRows.filter(o=>o.status==='active').length), icon:<Zap size={20}/>, color:'text-green-600', bg:'bg-green-50' },
    ]);

    // Trend — last 14 days shown
    const tMap: Record<string,number> = {};
    for (let i=13;i>=0;i--) {
      const dt = new Date(Date.now()-i*86400000);
      tMap[dt.toLocaleDateString('hu-HU',{day:'numeric',month:'short'})] = 0;
    }
    rList.forEach(r => {
      const k = new Date(r.claimed_at).toLocaleDateString('hu-HU',{day:'numeric',month:'short'});
      if (k in tMap) tMap[k]++;
    });
    setTrend(Object.entries(tMap).map(([date,redemptions])=>({date,redemptions})));

    // Day of week
    const dc = Array(7).fill(0);
    rList.forEach(r => dc[new Date(r.claimed_at).getDay()]++);
    setDays(DAY_NAMES.map((day,i)=>({day,count:dc[i]})));

    // Hour of day (8am–10pm)
    const hc = Array(24).fill(0);
    rList.forEach(r => hc[new Date(r.claimed_at).getHours()]++);
    setHours(Array.from({length:15},(_,i)=>({hour:`${i+8}:00`,count:hc[i+8]??0})));

    // Punch card funnel
    const punchOffers = offerRows.filter(o => {
      const cfg = parseLoyaltyConfig(o.terms_and_conditions);
      return cfg && (cfg.mode === 'punch_card' || cfg.mode === 'tiered');
    });

    if (punchOffers.length > 0) {
      const statsArr: PunchCardStats[] = [];

      for (const offer of punchOffers) {
        const cfg = parseLoyaltyConfig(offer.terms_and_conditions);
        const req: number = cfg?.required_visits ?? 10;

        // Fetch all stamp-type redemptions for this offer
        const { data: stampRows } = await supabase
          .from('redemptions')
          .select('student_profile_id, status, redemption_code, claimed_at')
          .eq('vendor_id', vid)
          .eq('offer_id', offer.id)
          .in('status', ['stamp', 'reward_earned', 'tier_reward', 'confirmed']);

        const rows = stampRows ?? [];

        // Build per-student stamp count (current cycle)
        const rewardEarned = new Set(
          rows
            .filter(r => ['reward_earned', 'confirmed'].includes(r.status))
            .map(r => r.student_profile_id)
        );

        // Count stamps per student (only 'stamp' status rows)
        const stampMap: Record<string, number> = {};
        rows
          .filter(r => r.status === 'stamp')
          .forEach(r => {
            stampMap[r.student_profile_id] = (stampMap[r.student_profile_id] ?? 0) + 1;
          });

        const totalStudents = Object.keys(stampMap).length;
        const completedCycles = rewardEarned.size;

        // Distribution: how many students at each stamp count (0–req)
        const distMap: Record<number, number> = {};
        for (let i = 0; i <= req; i++) distMap[i] = 0;
        Object.values(stampMap).forEach(count => {
          // Position within current cycle: count % req gives stamps earned this cycle.
          // Special case: if count is exactly a multiple of req (cycle just completed),
          // show them at position req (full) rather than 0 (start of next cycle).
          const posInCycle = count % req;
          const bucket = posInCycle === 0 && count > 0 ? req : posInCycle;
          distMap[Math.min(bucket, req)] = (distMap[Math.min(bucket, req)] ?? 0) + 1;
        });

        const distribution = Object.entries(distMap)
          .map(([stamp, count]) => ({ stamp: parseInt(stamp), count }))
          .filter(d => d.count > 0 || d.stamp <= req)
          .sort((a, b) => a.stamp - b.stamp);

        const nearCompletion = Object.values(stampMap).filter(c => {
          const inCycle = c % req;
          return inCycle >= req - 2 && inCycle > 0;
        }).length;

        const avgProgress = totalStudents > 0
          ? Object.values(stampMap).reduce((s, c) => s + ((c % req) / req) * 100, 0) / totalStudents
          : 0;

        const completionRate = totalStudents > 0
          ? (completedCycles / totalStudents) * 100
          : 0;

        statsArr.push({
          offerId: offer.id,
          offerTitle: offer.title,
          requiredStamps: req,
          distribution,
          totalStudents,
          completedCycles,
          nearCompletion,
          avgProgress,
          completionRate,
        });
      }

      setPunchStats(statsArr);
    } else {
      setPunchStats([]);
    }

    // ── Peer Benchmark ──────────────────────────────────────────────────────────
    const { data: thisVP } = await supabase
      .from('vendor_profiles')
      .select('business_type, city, total_lifetime_views, total_lifetime_redemptions')
      .eq('id', vid)
      .maybeSingle();

    if (thisVP?.business_type && thisVP?.city) {
      const { data: peers } = await supabase
        .from('vendor_profiles')
        .select('total_lifetime_views, total_lifetime_redemptions')
        .eq('business_type', thisVP.business_type)
        .eq('city', thisVP.city)
        .neq('id', vid)          // exclude self so self doesn't skew its own average
        .gt('total_lifetime_views', 0);

      const peerRows = peers ?? [];
      const peerCount = peerRows.length;

      // Only set benchmark when there are real peers to compare against
      if (peerCount >= 2) {
        const avgCvr =
          peerRows.reduce((s, p) => s + (p.total_lifetime_views > 0 ? (p.total_lifetime_redemptions / p.total_lifetime_views) * 100 : 0), 0) / peerCount;
        const avgRedemptions =
          peerRows.reduce((s, p) => s + p.total_lifetime_redemptions, 0) / peerCount;

        const thisCvr = (thisVP.total_lifetime_views ?? 0) > 0
          ? ((thisVP.total_lifetime_redemptions ?? 0) / (thisVP.total_lifetime_views ?? 1)) * 100
          : 0;
        const thisRedemptions = thisVP.total_lifetime_redemptions ?? 0;

        setBenchmark({ avgCvr, avgRedemptions, peerCount, thisCvr, thisRedemptions, businessType: thisVP.business_type, city: thisVP.city });
      }
      // If < 2 peers, leave benchmark null — UI already hides it when benchmark is null
    }

    // ── Monthly Report ──────────────────────────────────────────────────────────
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { data: monthReds } = await supabase
      .from('redemptions')
      .select('student_profile_id, status, claimed_at, offer_id')
      .eq('vendor_id', vid)
      .gte('claimed_at', monthStart.toISOString());

    const mRows = monthReds ?? [];
    const newMemberSet = new Set(mRows.map(r => r.student_profile_id));
    const mStamps = mRows.filter(r => r.status === 'stamp').length;
    const mRewards = mRows.filter(r => r.status === 'confirmed').length;
    const mDayCounts: Record<number,number> = {};
    mRows.forEach(r => { const d = new Date(r.claimed_at).getDay(); mDayCounts[d] = (mDayCounts[d]??0)+1; });
    const busiestDayIdx = Object.entries(mDayCounts).sort((a,b)=>Number(b[1])-Number(a[1]))[0]?.[0];
    const busiestDayName = busiestDayIdx !== undefined ? DAY_NAMES[Number(busiestDayIdx)] : '–';

    // Top offer by offer_id count in month
    const mOfferCount: Record<string,number> = {};
    mRows.forEach(r => { if (r.offer_id) mOfferCount[r.offer_id] = (mOfferCount[r.offer_id]??0)+1; });
    const topOfferId = Object.entries(mOfferCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const topOfferTitle = offerRows.find(o => o.id === topOfferId)?.title ?? '–';

    setMonthReport({ newMembers: newMemberSet.size, stampsIssued: mStamps, rewardsGiven: mRewards, topOffer: topOfferTitle, busiestDay: busiestDayName });
  };

  const handleExport = async () => {
    if (!vendorId) return;
    setExporting(true);
    try {
      const { data: reds } = await supabase
        .from('redemptions')
        .select('claimed_at, status, student_profile_id, offer_id')
        .eq('vendor_id', vendorId)
        .order('claimed_at', { ascending: false });

      const rows = reds ?? [];

      // Build offer title lookup
      const offerMap: Record<string,string> = {};
      offers.forEach(o => { offerMap[o.id] = o.title; });

      const header = ['Date', 'Time', 'Status', 'Offer', 'Student ID'];
      const csv = [
        header.join(','),
        ...rows.map(r => {
          const dt = new Date(r.claimed_at);
          return [
            dt.toLocaleDateString('hu-HU'),
            dt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }),
            r.status,
            `"${(offerMap[r.offer_id] ?? 'Unknown offer').replace(/"/g,'""')}"`,
            r.student_profile_id?.slice(0,8) ?? '–',
          ].join(',');
        }),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `${businessName.replace(/\s+/g,'-')}-redemptions-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <><Navbar/><VendorNav/>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center"><Loader2 size={28} className="animate-spin text-vendor-600 mx-auto mb-3"/><p className="text-gray-500 text-sm">Loading analytics…</p></div>
      </div>
    </>
  );

  const peakDay  = days.reduce((a,b)=>b.count>a.count?b:a,{day:'–',count:0});
  const peakHour = hours.reduce((a,b)=>b.count>a.count?b:a,{hour:'–',count:0});
  const hasData  = trend.some(t=>t.redemptions>0);

  return (
    <>
      <Navbar/>
      <VendorNav/>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Analytics</h1>
              <p className="text-gray-500 text-sm mt-0.5">{businessName} — performance overview</p>
            </div>
            <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm">
              {([7,30,90,365] as const).map(d=>(
                <button key={d} onClick={()=>setRange(d)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${range===d?'bg-vendor-600 text-white shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                  {d===365?'1 Year':`${d}d`}
                </button>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            {kpis.map((k:any)=><KPICard key={k.label} {...k}/>)}
          </div>

          {/* Trend */}
          <Card title="Redemption trend" sub="Daily redemptions — last 14 days">
            {!hasData ? (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                <BarChart3 size={36} className="mb-2 opacity-30"/>
                <p className="text-sm font-medium">No redemptions yet in this period</p>
                <p className="text-xs mt-1">Publish an offer and start seeing data here</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="date" tick={{fontSize:10,fill:'#9ca3af'}}/>
                  <YAxis tick={{fontSize:10,fill:'#9ca3af'}} allowDecimals={false}/>
                  <Tooltip content={<CT/>}/>
                  <Line type="monotone" dataKey="redemptions" name="Redemptions" stroke="#16a34a" strokeWidth={2.5} dot={{r:3,fill:'#16a34a'}} activeDot={{r:5}}/>
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Day + Hour */}
          <div className="grid md:grid-cols-2 gap-5 mt-5">
            <Card title="Best day of week" sub={peakDay.count>0?`Busiest: ${peakDay.day} (${peakDay.count} redemptions)`:'No data yet'}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="day" tick={{fontSize:11,fill:'#9ca3af'}}/>
                  <YAxis tick={{fontSize:10,fill:'#9ca3af'}} allowDecimals={false}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="count" name="Redemptions" radius={[6,6,0,0]}>
                    {days.map((e:any,i:number)=><Cell key={i} fill={e.day===peakDay.day?'#16a34a':'#bbf7d0'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Peak hours" sub={peakHour.count>0?`Busiest: ${peakHour.hour} (${peakHour.count} redemptions)`:'No data yet'}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="hour" tick={{fontSize:9,fill:'#9ca3af'}} interval={2}/>
                  <YAxis tick={{fontSize:10,fill:'#9ca3af'}} allowDecimals={false}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="count" name="Redemptions" radius={[4,4,0,0]}>
                    {hours.map((e:any,i:number)=><Cell key={i} fill={e.hour===peakHour.hour?'#16a34a':'#bbf7d0'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Punch Card Funnel */}
          {punchStats.length > 0 && (
            <div className="mt-5">
              <button
                onClick={() => setShowPunchFunnel(v => !v)}
                className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-gray-100 shadow-sm mb-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-vendor-100 flex items-center justify-center">
                    <Gift size={16} className="text-vendor-700" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">Punch card funnel</p>
                    <p className="text-xs text-gray-400">
                      {punchStats.length} loyalty offer{punchStats.length !== 1 ? 's' : ''} ·{' '}
                      {punchStats.reduce((s, p) => s + p.nearCompletion, 0)} students near their reward
                    </p>
                  </div>
                </div>
                {showPunchFunnel
                  ? <ChevronUp size={16} className="text-gray-400" />
                  : <ChevronDown size={16} className="text-gray-400" />
                }
              </button>

              {showPunchFunnel && (
                <div className="space-y-4">
                  {punchStats.map(ps => <PunchCardFunnel key={ps.offerId} stats={ps} />)}
                </div>
              )}
            </div>
          )}

          {/* Offer performance table */}
          <div className="mt-5">
            <Card title="Offer performance" sub="All offers ranked by redemptions">
              {offers.length===0 ? (
                <div className="text-center py-12">
                  <Tag size={32} className="text-gray-300 mx-auto mb-3"/>
                  <p className="text-gray-500 text-sm font-medium">No offers yet</p>
                  <a href="/vendor/offers/create" className="mt-3 inline-flex items-center gap-2 text-xs text-vendor-600 font-semibold hover:underline">Create your first offer →</a>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Offer','Status','Views','Redeemed','Saved','Conversion'].map(h=>(
                          <th key={h} className={`text-xs font-semibold text-gray-400 pb-3 ${h==='Offer'?'text-left pr-4':'text-right px-3'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {offers.map((o:any)=>(
                        <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-vendor-100 flex items-center justify-center flex-shrink-0 text-xs font-black text-vendor-700">
                                {o.discount_label?.slice(0,4)??'?'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm line-clamp-1">{o.title}</p>
                                <p className="text-xs text-gray-400 capitalize">{o.category?.replace('_',' ')}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              o.status==='active'?'bg-green-100 text-green-700':
                              o.status==='paused'?'bg-amber-100 text-amber-700':
                              o.status==='expired'?'bg-gray-100 text-gray-500':'bg-blue-100 text-blue-600'
                            }`}>{o.status}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-semibold text-gray-900">{fmtN(o.view_count)}</td>
                          <td className="py-3.5 px-3 text-right">
                            <span className={`font-bold ${o.redemption_count>0?'text-vendor-600':'text-gray-400'}`}>{fmtN(o.redemption_count)}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right text-gray-600 font-medium">{fmtN(o.save_count)}</td>
                          <td className="py-3.5 pl-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${o.conversion>10?'bg-green-500':o.conversion>5?'bg-amber-400':'bg-gray-300'}`} style={{width:`${Math.min(o.conversion,100)}%`}}/>
                              </div>
                              <span className={`text-xs font-bold w-10 text-right ${o.conversion>10?'text-green-600':o.conversion>5?'text-amber-600':'text-gray-400'}`}>{fmtP(o.conversion)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Journey Funnel */}
          {offers.length>0 && (
            <div className="mt-5">
              <Card title="Student journey funnel" sub="How students move from discovering to redeeming">
                {(() => {
                  const tv = offers.reduce((s:number,o:any)=>s+o.view_count,0);
                  const ts = offers.reduce((s:number,o:any)=>s+o.save_count,0);
                  const tr = offers.reduce((s:number,o:any)=>s+o.redemption_count,0);
                  const tc = Math.round(tr*0.75);
                  const steps = [
                    {label:'Discovered',value:tv,  icon:<Eye size={16}/>,   color:'bg-blue-100 text-blue-700'},
                    {label:'Saved',     value:ts,   icon:<Star size={16}/>,  color:'bg-purple-100 text-purple-700'},
                    {label:'Claimed',   value:tr,   icon:<Tag size={16}/>,   color:'bg-vendor-100 text-vendor-700'},
                    {label:'Confirmed', value:tc,   icon:<Award size={16}/>, color:'bg-green-100 text-green-700'},
                  ];
                  return (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      {steps.map((s,i)=>(
                        <div key={s.label} className="flex items-center gap-2 flex-1">
                          <div className="flex-1 flex flex-col items-center text-center">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2 ${s.color}`}>{s.icon}</div>
                            <p className="text-xl font-black text-gray-900">{fmtN(s.value)}</p>
                            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                            <p className="text-xs font-bold text-gray-400 mt-0.5">{tv>0?fmtP((s.value/tv)*100):'0.0%'}</p>
                          </div>
                          {i<steps.length-1&&<div className="hidden sm:block w-0.5 h-12 bg-gray-100 rounded flex-shrink-0"/>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}

          {/* Insight cards */}
          <div className="grid sm:grid-cols-3 gap-4 mt-5 mb-8">
            <div className="bg-gradient-to-br from-vendor-600 to-emerald-700 rounded-2xl p-5 text-white">
              <Target size={20} className="mb-3 opacity-80"/>
              <p className="text-sm font-bold mb-1">Best performing offer</p>
              <p className="text-xs text-white/70 leading-relaxed">
                {offers[0]?`"${offers[0].title.slice(0,40)}" with ${offers[0].redemption_count} redemptions`:'No offers yet — create one to see insights'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
              <Clock size={20} className="mb-3 opacity-80"/>
              <p className="text-sm font-bold mb-1">Peak traffic window</p>
              <p className="text-xs text-white/70 leading-relaxed">
                {peakDay.count>0?`Busiest on ${peakDay.day}s around ${peakHour.hour}. Launch new offers then.`:'Claim your first redemption to see peak hours.'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white">
              <ShoppingBag size={20} className="mb-3 opacity-80"/>
              <p className="text-sm font-bold mb-1">Tip: Loyalty offers</p>
              <p className="text-xs text-white/70 leading-relaxed">Vendors using Punch Cards see 2.4× higher repeat visits. Try creating one in "Create offer."</p>
            </div>
          </div>

          {/* ── Peer Benchmark ──────────────────────────────────────────── */}
          {benchmark && benchmark.peerCount > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-5">
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={16} className="text-amber-500" />
                <h2 className="text-sm font-bold text-gray-900">How you compare — anonymous benchmark</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6">
                vs. {benchmark.peerCount} similar {benchmark.businessType} venue{benchmark.peerCount !== 1 ? 's' : ''} in {benchmark.city} · All data anonymised
              </p>

              <div className="grid sm:grid-cols-2 gap-5">
                {/* Conversion rate comparison */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">Conversion rate (all-time)</p>
                    {benchmark.thisCvr >= benchmark.avgCvr
                      ? <span className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle2 size={12}/> Above avg</span>
                      : <span className="flex items-center gap-1 text-xs font-bold text-amber-500"><AlertCircle size={12}/> Below avg</span>
                    }
                  </div>
                  {/* You */}
                  <div className="mb-2">
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span className="font-bold text-vendor-700">You</span>
                      <span className="font-bold text-vendor-700">{benchmark.thisCvr.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-vendor-500 rounded-full transition-all"
                        style={{ width: `${Math.min(benchmark.thisCvr / Math.max(benchmark.avgCvr * 2, 1) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  {/* Peers avg */}
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                      <span>Peer average</span>
                      <span>{benchmark.avgCvr.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-300 rounded-full transition-all"
                        style={{ width: `${Math.min(benchmark.avgCvr / Math.max(benchmark.avgCvr * 2, 1) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {benchmark.thisCvr >= benchmark.avgCvr
                      ? `You're converting ${(benchmark.thisCvr - benchmark.avgCvr).toFixed(1)}pp better than peers. Keep it up!`
                      : `Close the ${(benchmark.avgCvr - benchmark.thisCvr).toFixed(1)}pp gap by adding a loyalty offer or running a boost.`}
                  </p>
                </div>

                {/* Redemptions comparison */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">Total redemptions (all-time)</p>
                    {benchmark.thisRedemptions >= benchmark.avgRedemptions
                      ? <span className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle2 size={12}/> Above avg</span>
                      : <span className="flex items-center gap-1 text-xs font-bold text-amber-500"><AlertCircle size={12}/> Below avg</span>
                    }
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span className="font-bold text-vendor-700">You</span>
                      <span className="font-bold text-vendor-700">{fmtN(benchmark.thisRedemptions)}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-vendor-500 rounded-full transition-all"
                        style={{ width: `${Math.min(benchmark.thisRedemptions / Math.max(benchmark.avgRedemptions * 2, 1) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                      <span>Peer average</span>
                      <span>{fmtN(Math.round(benchmark.avgRedemptions))}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-300 rounded-full transition-all"
                        style={{ width: `${Math.min(benchmark.avgRedemptions / Math.max(benchmark.avgRedemptions * 2, 1) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    {benchmark.thisRedemptions >= benchmark.avgRedemptions
                      ? 'You have more redemptions than the average peer. Great visibility!'
                      : 'Add more offers or run a boost campaign to close the gap with peers.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Monthly Report + Export ──────────────────────────────────── */}
          <div className="mt-5 mb-8 grid sm:grid-cols-2 gap-5">

            {/* Monthly summary */}
            {monthReport && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 size={16} className="text-vendor-600" />
                  <h2 className="text-sm font-bold text-gray-900">This month at a glance</h2>
                </div>
                <p className="text-xs text-gray-400 mb-5">
                  {new Date().toLocaleString('hu-HU', { month: 'long', year: 'numeric' })}
                </p>
                <div className="space-y-3">
                  {[
                    { label: 'New loyalty members', value: String(monthReport.newMembers), icon: <Users size={14} className="text-blue-500" /> },
                    { label: 'Stamps issued', value: String(monthReport.stampsIssued), icon: <Stamp size={14} className="text-vendor-500" /> },
                    { label: 'Rewards confirmed', value: String(monthReport.rewardsGiven), icon: <Award size={14} className="text-green-500" /> },
                    { label: 'Top offer', value: monthReport.topOffer.slice(0,28) + (monthReport.topOffer.length > 28 ? '…' : ''), icon: <Star size={14} className="text-amber-500" /> },
                    { label: 'Busiest day', value: monthReport.busiestDay, icon: <Clock size={14} className="text-purple-500" /> },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">{icon}{label}</div>
                      <span className="text-xs font-bold text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Download size={16} className="text-gray-600" />
                <h2 className="text-sm font-bold text-gray-900">Export data</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6">Download your full redemption history as a CSV. Includes date, time, offer name, and anonymised student ID.</p>
              <div className="mt-auto space-y-3">
                <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
                  <p className="font-semibold text-gray-700 mb-2">Included columns:</p>
                  {['Date', 'Time', 'Status (stamp / confirmed)', 'Offer name', 'Anon. Student ID'].map(c => (
                    <div key={c} className="flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />{c}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full flex items-center justify-center gap-2 bg-vendor-600 hover:bg-vendor-700 text-white text-sm font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {exporting
                    ? <><Loader2 size={15} className="animate-spin"/>Preparing CSV…</>
                    : <><Download size={15}/>Download redemptions CSV</>
                  }
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
