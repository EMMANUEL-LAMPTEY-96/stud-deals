'use client';

// =============================================================================
// app/(vendor)/vendor/boost/page.tsx — Flash Campaign / Boost Tool
//
// Lets vendors instantly launch time-limited promotions:
//   - Pre-built templates: Flash Sale, Double Stamps, Free Item, Bonus Stamps
//   - Duration selector: 2h / 4h / Today / 48h / 1 week
//   - Custom discount / reward label
//   - Live active-boost countdown cards
//   - Boost history with performance metrics
//   - "Audience" selector: all followers / loyal (5+ stamps) / nearby students
//
// Boosts are stored as special offers in the `offers` table with:
//   - category = 'special_offer' (existing value)
//   - terms_and_conditions prefix: [[BOOST:{...}]]
//   - status = 'active', expires_at = now + duration
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Zap, Clock, Tag, Gift, Star, Users, TrendingUp, CheckCircle,
  AlertCircle, Loader2, X, ChevronDown, ChevronUp, Flame,
  ArrowRight, Eye, RefreshCw, PlusCircle, Megaphone, Award,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoostConfig {
  template: string;
  discount_label: string;
  custom_title: string;
  duration_hours: number;
  audience: string;
  created_at: string;
}

interface ActiveBoost {
  id: string;
  title: string;
  discount_label: string;
  expires_at: string;
  view_count: number;
  redemption_count: number;
  config: BoostConfig | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBoostConfig(terms: string | null): BoostConfig | null {
  if (!terms) return null;
  const m = terms.match(/^\[\[BOOST:({.*?})\]\]/s);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function msToCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h/24)}d ${h%24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function pct(a: number, b: number) {
  if (!b) return '0%';
  return `${((a / b) * 100).toFixed(1)}%`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'flash_sale',
    label: 'Flash Sale',
    icon: <Flame size={22} />,
    color: 'from-red-500 to-orange-500',
    bg: 'bg-red-50 border-red-200',
    textColor: 'text-red-700',
    description: 'Limited-time discount — drives immediate footfall.',
    defaultTitle: '⚡ Flash Sale — ',
    defaultDiscount: '20% OFF',
    hint: 'e.g. 20% OFF, 2-for-1, Half Price',
  },
  {
    id: 'double_stamps',
    label: 'Double Stamps',
    icon: <Star size={22} />,
    color: 'from-amber-500 to-yellow-400',
    bg: 'bg-amber-50 border-amber-200',
    textColor: 'text-amber-700',
    description: 'Double loyalty points — boosts repeat visits.',
    defaultTitle: '⭐ Double Stamps Today — ',
    defaultDiscount: '2× STAMPS',
    hint: 'Label shown on the offer card',
  },
  {
    id: 'free_item',
    label: 'Free Item',
    icon: <Gift size={22} />,
    color: 'from-green-500 to-emerald-500',
    bg: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
    description: 'Gift with purchase — great for new menu launches.',
    defaultTitle: '🎁 Free Item — ',
    defaultDiscount: 'FREE',
    hint: 'e.g. Free Coffee, Free Muffin',
  },
  {
    id: 'bonus_stamps',
    label: 'Bonus Stamps',
    icon: <Award size={22} />,
    color: 'from-purple-500 to-violet-500',
    bg: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-700',
    description: 'Extra stamps on any purchase — accelerates loyalty.',
    defaultTitle: '🏅 Bonus Stamps — ',
    defaultDiscount: '+3 STAMPS',
    hint: 'e.g. +2 STAMPS, +3 STAMPS',
  },
];

const DURATIONS = [
  { label: '2 hours',  hours: 2 },
  { label: '4 hours',  hours: 4 },
  { label: 'Today',    hours: 12 },
  { label: '48 hours', hours: 48 },
  { label: '1 week',   hours: 168 },
];

const AUDIENCES = [
  { id: 'all',    label: 'All students',       icon: <Users size={14}/>,      sub: 'Anyone who discovers this offer' },
  { id: 'loyal',  label: 'Loyal customers',    icon: <Star size={14}/>,       sub: '5+ stamps at your business' },
  { id: 'saved',  label: 'Students who saved', icon: <Tag size={14}/>,        sub: 'Students who saved your previous offers' },
];

// ── Active Boost Card ──────────────────────────────────────────────────────────

function ActiveBoostCard({ boost, onEnd }: { boost: ActiveBoost; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const msLeft = new Date(boost.expires_at).getTime() - now;
  const tmpl = TEMPLATES.find(t => t.id === boost.config?.template) ?? TEMPLATES[0];
  const cvr = boost.view_count > 0 ? ((boost.redemption_count / boost.view_count) * 100).toFixed(1) : '0.0';

  return (
    <div className={`rounded-2xl border-2 p-5 ${tmpl.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tmpl.color} flex items-center justify-center text-white flex-shrink-0`}>
            {tmpl.icon}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 line-clamp-1">{boost.title}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tmpl.bg} ${tmpl.textColor} border`}>
              {boost.discount_label}
            </span>
          </div>
        </div>
        <button
          onClick={onEnd}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/60 text-gray-400 hover:text-gray-700 transition-colors"
          title="End boost early"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center">
          <p className="text-lg font-black text-gray-900">{boost.view_count}</p>
          <p className="text-[10px] text-gray-500 font-medium">Views</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-gray-900">{boost.redemption_count}</p>
          <p className="text-[10px] text-gray-500 font-medium">Redeemed</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-gray-900">{cvr}%</p>
          <p className="text-[10px] text-gray-500 font-medium">CVR</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Clock size={12} className={msLeft < 3600000 ? 'text-red-500' : 'text-gray-400'} />
        <p className={`text-xs font-bold ${msLeft < 3600000 ? 'text-red-600' : 'text-gray-500'}`}>
          {msLeft > 0 ? `${msToCountdown(msLeft)} remaining` : 'Just expired'}
        </p>
      </div>
    </div>
  );
}

// ── History Row ────────────────────────────────────────────────────────────────

function HistoryRow({ boost }: { boost: ActiveBoost }) {
  const tmpl = TEMPLATES.find(t => t.id === boost.config?.template) ?? TEMPLATES[0];
  const cvr = boost.view_count > 0 ? ((boost.redemption_count / boost.view_count) * 100).toFixed(1) : '0.0';
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-gray-50 last:border-0">
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tmpl.color} flex items-center justify-center text-white flex-shrink-0`}>
        <span className="scale-75">{tmpl.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 line-clamp-1">{boost.title}</p>
        <p className="text-xs text-gray-400">
          {new Date(boost.expires_at).toLocaleDateString('hu-HU', { day:'numeric', month:'short', year:'numeric' })}
        </p>
      </div>
      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-gray-900">{boost.view_count}</p>
          <p className="text-[10px] text-gray-400">Views</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-gray-900">{boost.redemption_count}</p>
          <p className="text-[10px] text-gray-400">Redeems</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${parseFloat(cvr) > 10 ? 'text-green-600' : parseFloat(cvr) > 5 ? 'text-amber-600' : 'text-gray-400'}`}>
            {cvr}%
          </p>
          <p className="text-[10px] text-gray-400">CVR</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BoostPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [businessName, setBN] = useState('');
  const [activeBoosts, setActiveBoosts] = useState<ActiveBoost[]>([]);
  const [historyBoosts, setHistoryBoosts] = useState<ActiveBoost[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<string>('flash_sale');
  const [discountLabel, setDiscountLabel] = useState('20% OFF');
  const [customTitle, setCustomTitle] = useState('');
  const [durationHours, setDurationHours] = useState(4);
  const [audience, setAudience] = useState('all');

  const tmpl = TEMPLATES.find(t => t.id === selectedTemplate)!;

  // ── Load ──

  const load = useCallback(async (vid: string) => {
    const { data: boostOffers } = await supabase
      .from('offers')
      .select('id, title, discount_label, expires_at, view_count, redemption_count, terms_and_conditions')
      .eq('vendor_id', vid)
      .like('terms_and_conditions', '[[BOOST:%')
      .order('created_at', { ascending: false })
      .limit(50);

    const now = new Date().toISOString();
    const items: ActiveBoost[] = (boostOffers ?? []).map(o => ({
      id: o.id,
      title: o.title,
      discount_label: o.discount_label ?? '',
      expires_at: o.expires_at ?? '',
      view_count: o.view_count ?? 0,
      redemption_count: o.redemption_count ?? 0,
      config: parseBoostConfig(o.terms_and_conditions),
    }));

    setActiveBoosts(items.filter(b => b.expires_at > now));
    setHistoryBoosts(items.filter(b => b.expires_at <= now));
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?role=vendor'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles').select('id, business_name').eq('user_id', user.id).single();
      if (!vp) { router.push('/vendor/profile'); return; }
      setVendorId(vp.id);
      setBN(vp.business_name);
      await load(vp.id);
      setLoading(false);
    })();
  }, []);

  // Auto-update countdown every minute
  useEffect(() => {
    const t = setInterval(() => {
      if (vendorId) load(vendorId);
    }, 60_000);
    return () => clearInterval(t);
  }, [vendorId, load]);

  // When template changes, update default label
  useEffect(() => {
    setDiscountLabel(tmpl.defaultDiscount);
    setCustomTitle('');
  }, [selectedTemplate]);

  // ── Launch ──

  const handleLaunch = async () => {
    if (!vendorId) return;
    setLaunching(true);
    try {
      const expiresAt = new Date(Date.now() + durationHours * 3600000).toISOString();
      const title = customTitle.trim()
        ? customTitle.trim()
        : `${tmpl.defaultTitle}${businessName}`;

      const boostConfig: BoostConfig = {
        template: selectedTemplate,
        discount_label: discountLabel,
        custom_title: title,
        duration_hours: durationHours,
        audience,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('offers').insert({
        vendor_id: vendorId,
        title,
        discount_label: discountLabel,
        description: `Limited-time boost: ${discountLabel}. Active for ${DURATIONS.find(d => d.hours === durationHours)?.label ?? durationHours + 'h'}.`,
        category: 'special_offer',
        offer_type: 'standard',
        status: 'active',
        expires_at: expiresAt,
        terms_and_conditions: `[[BOOST:${JSON.stringify(boostConfig)}]]`,
        is_student_exclusive: true,
        view_count: 0,
        redemption_count: 0,
        save_count: 0,
      });

      if (error) throw error;

      await load(vendorId);
      setToast({ type: 'ok', msg: `🚀 Boost launched! Active for ${DURATIONS.find(d=>d.hours===durationHours)?.label}.` });
      setTimeout(() => setToast(null), 4000);
    } catch (e: any) {
      setToast({ type: 'err', msg: e.message ?? 'Failed to launch boost.' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLaunching(false);
    }
  };

  // ── End boost early ──

  const handleEndBoost = async (boostId: string) => {
    if (!confirm('End this boost early? It will immediately stop showing to students.')) return;
    await supabase.from('offers').update({ status: 'paused', expires_at: new Date().toISOString() }).eq('id', boostId);
    if (vendorId) await load(vendorId);
    setToast({ type: 'ok', msg: 'Boost ended.' });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Stats ──

  const totalRedeems = historyBoosts.reduce((s, b) => s + b.redemption_count, 0);
  const avgCvr = historyBoosts.length > 0
    ? (historyBoosts.reduce((s, b) => s + (b.view_count > 0 ? b.redemption_count / b.view_count : 0), 0) / historyBoosts.length * 100).toFixed(1)
    : '0.0';

  if (loading) return (
    <><Navbar /><VendorNav />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={28} className="animate-spin text-vendor-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading boost tool…</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <VendorNav />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${
          toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Zap size={16} className="text-white" />
                </div>
                <h1 className="text-2xl font-black text-gray-900">Boost</h1>
              </div>
              <p className="text-gray-500 text-sm">Launch flash campaigns in seconds — drive footfall today.</p>
            </div>
            <button
              onClick={() => vendorId && load(vendorId)}
              className="self-start flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white transition-colors shadow-sm"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-3 gap-4 mb-7">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-2xl font-black text-orange-600">{activeBoosts.length}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">Active Boosts</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-2xl font-black text-gray-900">{historyBoosts.length}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">Boosts Run</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-2xl font-black text-vendor-600">{totalRedeems}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">Total Redeems</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── LEFT — Builder ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Template picker */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-900 mb-4">1. Choose a template</h2>
                <div className="grid grid-cols-2 gap-3">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        selectedTemplate === t.id
                          ? `${t.bg} border-current ${t.textColor} shadow-sm`
                          : 'border-gray-100 hover:border-gray-200 text-gray-600'
                      }`}
                    >
                      {selectedTemplate === t.id && (
                        <CheckCircle size={14} className={`absolute top-3 right-3 ${t.textColor}`} />
                      )}
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center text-white mb-2`}>
                        <span className="scale-75">{t.icon}</span>
                      </div>
                      <p className="text-sm font-bold">{t.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customise */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h2 className="text-sm font-bold text-gray-900">2. Customise your offer</h2>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Offer label <span className="font-normal text-gray-400">(shown on the offer card)</span>
                  </label>
                  <input
                    type="text"
                    value={discountLabel}
                    onChange={e => setDiscountLabel(e.target.value)}
                    placeholder={tmpl.hint}
                    maxLength={20}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-vendor-400 focus:ring-2 focus:ring-vendor-100 transition-colors"
                  />
                  <p className="text-xs text-gray-400 mt-1">{tmpl.hint}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Offer title <span className="font-normal text-gray-400">(optional — auto-generated if empty)</span>
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    placeholder={`${tmpl.defaultTitle}${businessName}`}
                    maxLength={80}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-vendor-400 focus:ring-2 focus:ring-vendor-100 transition-colors"
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-900 mb-4">3. Set duration</h2>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map(d => (
                    <button
                      key={d.hours}
                      onClick={() => setDurationHours(d.hours)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                        durationHours === d.hours
                          ? 'bg-vendor-600 text-white border-vendor-600 shadow-sm'
                          : 'border-gray-200 text-gray-600 hover:border-vendor-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Boost expires: <span className="font-semibold text-gray-600">
                    {new Date(Date.now() + durationHours * 3600000).toLocaleString('hu-HU', {
                      weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                    })}
                  </span>
                </p>
              </div>

              {/* Audience */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-900 mb-4">4. Target audience</h2>
                <div className="space-y-2">
                  {AUDIENCES.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setAudience(a.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        audience === a.id
                          ? 'border-vendor-400 bg-vendor-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        audience === a.id ? 'bg-vendor-100 text-vendor-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.icon}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${audience === a.id ? 'text-vendor-700' : 'text-gray-700'}`}>
                          {a.label}
                        </p>
                        <p className="text-xs text-gray-400">{a.sub}</p>
                      </div>
                      {audience === a.id && <CheckCircle size={16} className="text-vendor-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* ── RIGHT — Preview + Active ── */}
            <div className="space-y-5">

              {/* Live Preview */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-20">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Preview</h2>

                <div className={`rounded-2xl border-2 p-4 ${tmpl.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`px-2 py-0.5 rounded-full bg-gradient-to-r ${tmpl.color} text-white text-[10px] font-black uppercase tracking-wide`}>
                      {tmpl.label}
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-white/70 text-gray-500 text-[10px] font-semibold">
                      {DURATIONS.find(d => d.hours === durationHours)?.label}
                    </div>
                  </div>

                  <p className="text-sm font-bold text-gray-900 mb-1">
                    {customTitle.trim() || `${tmpl.defaultTitle}${businessName}`}
                  </p>

                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r ${tmpl.color} text-white mt-2`}>
                    <Zap size={14} />
                    <span className="text-sm font-black">{discountLabel || tmpl.defaultDiscount}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-3">
                    <Clock size={11} className="text-gray-400" />
                    <p className="text-xs text-gray-500">
                      Expires {new Date(Date.now() + durationHours * 3600000).toLocaleString('hu-HU', {
                        hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                      })}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLaunch}
                  disabled={launching || !discountLabel.trim()}
                  className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                    launching || !discountLabel.trim()
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-md hover:shadow-lg'
                  }`}
                >
                  {launching ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  {launching ? 'Launching…' : 'Launch Boost Now'}
                </button>

                <p className="text-[10px] text-gray-400 text-center mt-2">
                  Visible to students immediately after launch
                </p>
              </div>

              {/* Active Boosts */}
              {activeBoosts.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                    Active now ({activeBoosts.length})
                  </h2>
                  <div className="space-y-3">
                    {activeBoosts.map(b => (
                      <ActiveBoostCard
                        key={b.id}
                        boost={b}
                        onEnd={() => handleEndBoost(b.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="bg-gradient-to-br from-vendor-600 to-emerald-700 rounded-2xl p-5 text-white">
                <Megaphone size={18} className="mb-3 opacity-80" />
                <p className="text-sm font-bold mb-2">Pro tips</p>
                <ul className="space-y-2 text-xs text-white/80">
                  <li className="flex items-start gap-1.5">
                    <ArrowRight size={10} className="mt-0.5 flex-shrink-0" />
                    Launch Flash Sales on Tuesday–Thursday for highest student engagement.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <ArrowRight size={10} className="mt-0.5 flex-shrink-0" />
                    Double Stamps boosts repeat visits by up to 3× vs standard offers.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <ArrowRight size={10} className="mt-0.5 flex-shrink-0" />
                    Short 2–4 hour windows create urgency and drive same-day footfall.
                  </li>
                </ul>
              </div>
            </div>

          </div>

          {/* ── Boost History ── */}
          {historyBoosts.length > 0 && (
            <div className="mt-7 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900">Boost history</h2>
                  <span className="text-xs text-gray-400">({historyBoosts.length} past boosts — avg CVR {avgCvr}%)</span>
                </div>
                {showHistory ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {showHistory && (
                <div className="px-5 pb-5">
                  <div className="divide-y divide-gray-50">
                    {historyBoosts.slice(0, 20).map(b => <HistoryRow key={b.id} boost={b} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {activeBoosts.length === 0 && historyBoosts.length === 0 && (
            <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Zap size={24} className="text-amber-600" />
              </div>
              <p className="text-sm font-bold text-gray-700 mb-1">No boosts yet</p>
              <p className="text-xs text-gray-400">Launch your first boost above to drive immediate footfall.</p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
