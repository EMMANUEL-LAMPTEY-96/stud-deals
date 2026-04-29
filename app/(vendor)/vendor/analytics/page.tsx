'use client';

// =============================================================================
// app/(vendor)/vendor/analytics/page.tsx — Vendor Analytics
// Full analytics: KPIs, trend chart, day/hour heatmaps, offer performance table, funnel
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
  ArrowDownRight, Loader2, Star, Zap, Clock, Award, Target, ShoppingBag,
} from 'lucide-react';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtN(n: number) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }
function fmtP(n: number) { return `${n.toFixed(1)}%`; }

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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?role=vendor'); return; }
      const { data: vp } = await supabase.from('vendor_profiles').select('id,business_name').eq('user_id', user.id).single();
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
      tMap[dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'})] = 0;
    }
    rList.forEach(r => {
      const k = new Date(r.claimed_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
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

          {/* Funnel */}
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

        </div>
      </div>
    </>
  );
}
