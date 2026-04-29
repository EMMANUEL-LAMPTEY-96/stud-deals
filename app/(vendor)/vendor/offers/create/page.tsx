'use client';

// =============================================================================
// app/(vendor)/vendor/offers/create/page.tsx — Create Offer
//
// Offer type selector at the top chooses the whole form shape:
//   1. Standard Discount  — % off, fixed £ off, BOGO, free item
//   2. Punch Card          — buy N visits, get 1 free (loyalty stamp card)
//   3. First Visit Bonus  — one-time welcome discount for new students
//   4. Milestone Reward   — earn a reward after spending £X in total
//
// Loyalty config is serialised into terms_and_conditions with a hidden JSON
// prefix so it can be read back by the vendor dashboard.
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  ArrowLeft, Tag, Eye, CheckCircle, AlertCircle, Loader2,
  Calendar, Users, FileText, Percent, DollarSign, Gift, Coffee,
  Clock, Repeat, Star, Sparkles, Trophy, Stamp, ShoppingCart,
  Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { DiscountType, OfferCategory } from '@/lib/types/database.types';

// ── Types ─────────────────────────────────────────────────────────────────────

type OfferMode = 'standard' | 'punch_card' | 'first_visit' | 'milestone';

interface LoyaltyConfig {
  mode: OfferMode;
  required_visits?: number;
  reward_type?: 'free_item' | 'percentage' | 'fixed_amount';
  reward_value?: number;
  reward_label?: string;
  spend_threshold?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OFFER_MODES: {
  value: OfferMode;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
  badge?: string;
}[] = [
  {
    value:   'standard',
    label:   'Standard Discount',
    tagline: 'One-off % off, fixed £, BOGO or free item',
    icon:    <Percent size={22} />,
    color:   'text-brand-600',
    border:  'border-brand-400',
    bg:      'bg-brand-50',
  },
  {
    value:   'punch_card',
    label:   'Punch Card',
    tagline: 'Buy N times → earn a reward automatically',
    icon:    <Stamp size={22} />,
    color:   'text-orange-600',
    border:  'border-orange-400',
    bg:      'bg-orange-50',
    badge:   'Loyalty',
  },
  {
    value:   'first_visit',
    label:   'First-Visit Bonus',
    tagline: 'Special welcome deal for new students only',
    icon:    <Sparkles size={22} />,
    color:   'text-purple-600',
    border:  'border-purple-400',
    bg:      'bg-purple-50',
    badge:   'Acquisition',
  },
  {
    value:   'milestone',
    label:   'Spend Milestone',
    tagline: 'Spend £X in total → unlock a big reward',
    icon:    <Trophy size={22} />,
    color:   'text-amber-600',
    border:  'border-amber-400',
    bg:      'bg-amber-50',
    badge:   'VIP',
  },
];

const STANDARD_DISCOUNT_TYPES: { value: DiscountType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'percentage',  label: '% Off',      icon: <Percent size={15} />,    desc: 'e.g. 20% off the total bill' },
  { value: 'fixed_amount',label: 'Fixed £',     icon: <DollarSign size={15} />, desc: 'e.g. £2 off any purchase' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y', icon: <Gift size={15} />,       desc: 'e.g. Buy 1 get 1 free' },
  { value: 'free_item',   label: 'Free Item',   icon: <Coffee size={15} />,     desc: 'e.g. Free cookie with any drink' },
];

const REWARD_TYPES = [
  { value: 'free_item' as const,   label: 'Free item',        icon: <Gift size={14} /> },
  { value: 'percentage' as const,  label: '% off next visit', icon: <Percent size={14} /> },
  { value: 'fixed_amount' as const,label: 'Fixed £ off',      icon: <DollarSign size={14} /> },
];

const CATEGORIES: { value: OfferCategory; label: string; emoji: string }[] = [
  { value: 'food_drink',       label: 'Food & Drink',    emoji: '🍕' },
  { value: 'groceries',        label: 'Groceries',       emoji: '🛒' },
  { value: 'tech',             label: 'Tech',            emoji: '💻' },
  { value: 'fashion',          label: 'Fashion',         emoji: '👗' },
  { value: 'health_beauty',    label: 'Health & Beauty', emoji: '💆' },
  { value: 'entertainment',    label: 'Entertainment',   emoji: '🎬' },
  { value: 'transport',        label: 'Transport',       emoji: '🚗' },
  { value: 'books_stationery', label: 'Books',           emoji: '📚' },
  { value: 'fitness',          label: 'Fitness',         emoji: '🏋️' },
  { value: 'other',            label: 'Other',           emoji: '🏷️' },
];

const INPUT_CLS = 'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-vendor-500 focus:ring-2 focus:ring-vendor-100 transition-colors placeholder:text-gray-300 text-gray-900';

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon, children, open = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; open?: boolean;
}) {
  const [expanded, setExpanded] = useState(open);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">{icon}</div>
          <span className="text-sm font-bold text-gray-900">{title}</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {expanded && <div className="px-5 pb-5 space-y-4 border-t border-gray-50">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children, required }: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5 pt-4">
      <label className="block text-sm font-semibold text-gray-700">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 leading-relaxed">{hint}</p>}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3 text-xs text-blue-700">
      <Info size={13} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

// ── Live preview card ─────────────────────────────────────────────────────────

function OfferPreview({
  mode, title, discountLabel, category, description, expiresAt, businessName,
  loyaltyConfig,
}: {
  mode: OfferMode; title: string; discountLabel: string; category: OfferCategory;
  description: string; expiresAt: string; businessName: string;
  loyaltyConfig: LoyaltyConfig;
}) {
  const cat = CATEGORIES.find(c => c.value === category);
  const expLabel = expiresAt
    ? `Expires ${new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : 'No expiry';

  const modeConfig = OFFER_MODES.find(m => m.value === mode)!;
  const reqVisits = loyaltyConfig.required_visits ?? 5;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className={`h-1.5 ${
        mode === 'standard'   ? 'bg-gradient-to-r from-brand-500 to-brand-400' :
        mode === 'punch_card' ? 'bg-gradient-to-r from-orange-500 to-amber-400' :
        mode === 'first_visit'? 'bg-gradient-to-r from-purple-500 to-brand-400' :
                                'bg-gradient-to-r from-amber-500 to-yellow-400'
      }`} />
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black text-center leading-tight px-1 ${modeConfig.bg} ${modeConfig.color}`}>
            {discountLabel || modeConfig.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {mode !== 'standard' && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${modeConfig.bg} ${modeConfig.color}`}>
                  {modeConfig.badge ?? modeConfig.label}
                </span>
              )}
            </div>
            <p className="font-bold text-gray-900 text-sm leading-tight">
              {title || 'Your offer title'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{businessName || 'Your Business'}</p>
          </div>
        </div>

        {/* Punch card stamps */}
        {mode === 'punch_card' && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1.5">
              Buy {reqVisits}, get {loyaltyConfig.reward_label ?? 'reward'} free
            </p>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: Math.min(reqVisits, 10) }).map((_, i) => (
                <div key={i} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] ${
                  i < 3 ? 'bg-orange-500 border-orange-500 text-white' : 'border-orange-200 text-orange-200'
                }`}>
                  {i < 3 ? '✓' : '•'}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">3/{reqVisits} stamps — {reqVisits - 3} more to go</p>
          </div>
        )}

        {/* Milestone progress */}
        {mode === 'milestone' && loyaltyConfig.spend_threshold && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Spend progress</span>
              <span className="text-xs font-bold text-amber-600">£24 / £{loyaltyConfig.spend_threshold}</span>
            </div>
            <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full transition-all"
                style={{ width: `${Math.min((24 / loyaltyConfig.spend_threshold) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {description && (
          <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
          <span>{cat?.emoji ?? '🏷️'} {cat?.label ?? 'Category'}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{expLabel}</span>
        </div>

        <div className={`w-full py-2.5 rounded-xl text-white text-xs font-bold text-center ${
          mode === 'punch_card' ? 'bg-orange-500' :
          mode === 'first_visit' ? 'bg-purple-600' :
          mode === 'milestone' ? 'bg-amber-500' : 'bg-vendor-600'
        }`}>
          {mode === 'punch_card' ? 'Stamp my card' :
           mode === 'first_visit' ? 'Claim welcome deal' :
           mode === 'milestone' ? 'Track my progress' : 'Get Voucher'}
        </div>
      </div>
      <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">Student card preview</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CreateOfferPage() {
  const router  = useRouter();
  const supabase = createClient();

  // Shared state
  const [mode, setMode]                 = useState<OfferMode>('standard');
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [category, setCategory]         = useState<OfferCategory>('food_drink');
  const [startsAt, setStartsAt]         = useState(new Date().toISOString().slice(0, 16));
  const [expiresAt, setExpiresAt]       = useState('');
  const [noExpiry, setNoExpiry]         = useState(false);
  const [maxTotal, setMaxTotal]         = useState('');
  const [terms, setTerms]               = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [vendorId, setVendorId]         = useState<string | null>(null);

  // Standard discount
  const [discountType, setDiscountType]   = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('');

  // Punch card
  const [pcVisits, setPcVisits]           = useState('5');
  const [pcRewardType, setPcRewardType]   = useState<LoyaltyConfig['reward_type']>('free_item');
  const [pcRewardValue, setPcRewardValue] = useState('');
  const [pcRewardLabel, setPcRewardLabel] = useState('');

  // First visit
  const [fvType, setFvType]   = useState<DiscountType>('percentage');
  const [fvValue, setFvValue] = useState('');

  // Milestone
  const [msThreshold, setMsThreshold]     = useState('');
  const [msRewardType, setMsRewardType]   = useState<LoyaltyConfig['reward_type']>('percentage');
  const [msRewardValue, setMsRewardValue] = useState('');
  const [msRewardLabel, setMsRewardLabel] = useState('');

  const [loading, setLoading]           = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?role=vendor'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles').select('id, business_name').eq('user_id', user.id).single();
      if (vp) { setVendorId(vp.id); setBusinessName(vp.business_name); }
      setLoading(false);
    })();
  }, []);

  // ── Auto-generate discount label ──────────────────────────────────────────
  const autoDiscountLabel = (): string => {
    if (mode === 'standard') {
      const v = parseFloat(discountValue);
      if (!v) return '';
      if (discountType === 'percentage') return `${v}% OFF`;
      if (discountType === 'fixed_amount') return `£${v} OFF`;
      if (discountType === 'buy_x_get_y') return 'BOGO';
      if (discountType === 'free_item') return 'FREE';
    }
    if (mode === 'punch_card') return `${pcVisits}× STAMP`;
    if (mode === 'first_visit') {
      const v = parseFloat(fvValue);
      if (!v) return 'WELCOME';
      if (fvType === 'percentage') return `${v}% OFF`;
      if (fvType === 'fixed_amount') return `£${v} OFF`;
      return 'FREE';
    }
    if (mode === 'milestone') {
      const t = parseFloat(msThreshold);
      if (!t) return 'MILESTONE';
      return `£${t} GOAL`;
    }
    return '';
  };

  // ── Build loyalty config payload ──────────────────────────────────────────
  const buildPayload = (status: 'draft' | 'active') => {
    const lc: LoyaltyConfig = { mode };
    let dbDiscountType: DiscountType = discountType;
    let dbDiscountValue: number | null = null;
    let dbMaxPerStudent = 1;
    let dbMinPurchase: number | null = null;

    if (mode === 'standard') {
      dbDiscountType  = discountType;
      dbDiscountValue = discountValue ? parseFloat(discountValue) : null;
      dbMaxPerStudent = 50; // unlimited-ish for standard
    }

    if (mode === 'punch_card') {
      dbDiscountType  = 'buy_x_get_y';
      dbDiscountValue = null;
      dbMaxPerStudent = 999;
      lc.required_visits = parseInt(pcVisits) || 5;
      lc.reward_type     = pcRewardType;
      lc.reward_value    = pcRewardValue ? parseFloat(pcRewardValue) : undefined;
      lc.reward_label    = pcRewardLabel || undefined;
    }

    if (mode === 'first_visit') {
      dbDiscountType  = fvType;
      dbDiscountValue = fvValue ? parseFloat(fvValue) : null;
      dbMaxPerStudent = 1; // exactly one use per student
    }

    if (mode === 'milestone') {
      dbDiscountType  = msRewardType ?? 'percentage';
      dbDiscountValue = msRewardValue ? parseFloat(msRewardValue) : null;
      dbMaxPerStudent = 1;
      dbMinPurchase   = msThreshold ? parseFloat(msThreshold) : null;
      lc.spend_threshold = dbMinPurchase ?? undefined;
      lc.reward_type     = msRewardType;
      lc.reward_value    = msRewardValue ? parseFloat(msRewardValue) : undefined;
      lc.reward_label    = msRewardLabel || undefined;
    }

    // Embed loyalty config as JSON prefix in terms_and_conditions
    const loyaltyPrefix = mode !== 'standard'
      ? `[[LOYALTY:${JSON.stringify(lc)}]]\n`
      : '';
    const fullTerms = loyaltyPrefix + (terms.trim() || '');

    const lbl = discountLabel || autoDiscountLabel();

    return {
      vendor_id:             vendorId!,
      title:                 title.trim(),
      description:           description.trim() || null,
      discount_type:         dbDiscountType,
      discount_value:        dbDiscountValue,
      discount_label:        lbl.toUpperCase() || 'DEAL',
      category,
      status,
      starts_at:             new Date(startsAt).toISOString(),
      expires_at:            noExpiry || !expiresAt ? null : new Date(expiresAt).toISOString(),
      max_uses_per_student:  dbMaxPerStudent,
      max_total_redemptions: maxTotal ? parseInt(maxTotal) : null,
      min_purchase_amount:   dbMinPurchase,
      terms_and_conditions:  fullTerms || null,
      tags:                  [mode],
      view_count:            0,
      redemption_count:      0,
      save_count:            0,
    };
  };

  const handleSubmit = async (status: 'draft' | 'active') => {
    if (!vendorId) return;
    if (!title.trim()) { setError('Offer title is required.'); return; }
    setError('');
    setSubmitLoading(true);

    const payload = buildPayload(status);
    const { error: err } = await supabase.from('offers').insert(payload as never);
    setSubmitLoading(false);

    if (err) { setError(err.message); return; }
    router.push('/vendor/offers?created=1');
  };

  const lbl = discountLabel || autoDiscountLabel();
  const currentMode = OFFER_MODES.find(m => m.value === mode)!;

  if (loading) {
    return (
      <><Navbar /><VendorNav />
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <Link href="/vendor/offers" className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Create offer</h1>
              <p className="text-gray-500 text-sm">Choose your offer type then fill in the details</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── OFFER TYPE SELECTOR ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
            <h2 className="text-sm font-bold text-gray-900 mb-1">What type of offer is this?</h2>
            <p className="text-xs text-gray-400 mb-4">Choose the offer structure that best fits your promotion</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {OFFER_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => { setMode(m.value); setDiscountLabel(''); }}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                    mode === m.value ? `${m.border} ${m.bg}` : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {m.badge && (
                    <span className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${m.bg} ${m.color}`}>
                      {m.badge}
                    </span>
                  )}
                  <div className={`${mode === m.value ? m.color : 'text-gray-400'} transition-colors`}>
                    {m.icon}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${mode === m.value ? 'text-gray-900' : 'text-gray-600'}`}>
                      {m.label}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{m.tagline}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">

            {/* ── FORM ────────────────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Basics */}
              <Section title="Offer basics" icon={<Tag size={14} />}>
                <Field label="Offer title" required hint="Clear and enticing — students decide in 2 seconds">
                  <input type="text" className={INPUT_CLS} placeholder={
                    mode === 'punch_card'  ? 'Buy 5 coffees, get your 6th free' :
                    mode === 'first_visit' ? 'Welcome bonus — 25% off your first visit' :
                    mode === 'milestone'   ? 'Spend £50 and earn a £10 reward' :
                    '30% off all meals for students'
                  } value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
                  <p className="text-xs text-gray-400 text-right">{title.length}/100</p>
                </Field>
                <Field label="Description" hint="Optional — extra context about how the offer works">
                  <textarea className={`${INPUT_CLS} resize-none h-20`}
                    placeholder="Show your student ID at the counter. Valid Mon–Fri only."
                    value={description} onChange={e => setDescription(e.target.value)} maxLength={300} />
                </Field>
              </Section>

              {/* ── STANDARD DISCOUNT ── */}
              {mode === 'standard' && (
                <Section title="Discount details" icon={<Percent size={14} />}>
                  <Field label="Discount type" required>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {STANDARD_DISCOUNT_TYPES.map(dt => (
                        <button key={dt.value} type="button" onClick={() => setDiscountType(dt.value)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                            discountType === dt.value ? 'border-vendor-500 bg-vendor-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`mt-0.5 ${discountType === dt.value ? 'text-vendor-600' : 'text-gray-400'}`}>{dt.icon}</div>
                          <div>
                            <p className={`text-sm font-bold ${discountType === dt.value ? 'text-vendor-900' : 'text-gray-700'}`}>{dt.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{dt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Field>
                  {(discountType === 'percentage' || discountType === 'fixed_amount') && (
                    <Field label={discountType === 'percentage' ? 'Percentage off' : 'Amount off (£)'}>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm pointer-events-none">
                          {discountType === 'percentage' ? '%' : '£'}
                        </span>
                        <input type="number" className={`${INPUT_CLS} pl-8`}
                          placeholder={discountType === 'percentage' ? '20' : '2.50'}
                          value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                          min={0} step={discountType === 'fixed_amount' ? 0.01 : 1} />
                      </div>
                    </Field>
                  )}
                  <Field label="Badge label" required hint="Short label on the offer card — max 10 chars">
                    <input type="text" className={INPUT_CLS}
                      placeholder="e.g. 20% OFF or BOGO or FREE"
                      value={discountLabel} onChange={e => setDiscountLabel(e.target.value.toUpperCase())} maxLength={10} />
                  </Field>
                </Section>
              )}

              {/* ── PUNCH CARD ── */}
              {mode === 'punch_card' && (
                <Section title="Punch card settings" icon={<Stamp size={14} />}>
                  <InfoBox>
                    Students collect a stamp every time they redeem this offer. After reaching your target visits, they automatically unlock the reward.
                  </InfoBox>
                  <Field label="Visits required for reward" hint="e.g. 5 means buy 5 times, get 1 reward">
                    <div className="flex items-center gap-3">
                      <input type="number" className={`${INPUT_CLS} w-28`}
                        value={pcVisits} onChange={e => setPcVisits(e.target.value)} min={2} max={20} />
                      <span className="text-sm text-gray-500">visits to earn the reward</span>
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[3, 5, 7, 10].map(n => (
                        <button key={n} type="button" onClick={() => setPcVisits(String(n))}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            pcVisits === String(n) ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-50'
                          }`}
                        >Buy {n} get 1</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Reward type" required>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {REWARD_TYPES.map(rt => (
                        <button key={rt.value} type="button" onClick={() => setPcRewardType(rt.value)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                            pcRewardType === rt.value ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={pcRewardType === rt.value ? 'text-orange-600' : 'text-gray-400'}>{rt.icon}</div>
                          <p className={`text-xs font-bold ${pcRewardType === rt.value ? 'text-orange-900' : 'text-gray-600'}`}>{rt.label}</p>
                        </button>
                      ))}
                    </div>
                  </Field>
                  {pcRewardType !== 'free_item' && (
                    <Field label={pcRewardType === 'percentage' ? 'Reward % off' : 'Reward £ off'}>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">
                          {pcRewardType === 'percentage' ? '%' : '£'}
                        </span>
                        <input type="number" className={`${INPUT_CLS} pl-8`} placeholder="10"
                          value={pcRewardValue} onChange={e => setPcRewardValue(e.target.value)} min={0} />
                      </div>
                    </Field>
                  )}
                  <Field label="Reward description" hint="What the student actually gets — e.g. 'Free latte of your choice'">
                    <input type="text" className={INPUT_CLS}
                      placeholder="Free latte of your choice"
                      value={pcRewardLabel} onChange={e => setPcRewardLabel(e.target.value)} maxLength={60} />
                  </Field>
                </Section>
              )}

              {/* ── FIRST VISIT ── */}
              {mode === 'first_visit' && (
                <Section title="First-visit discount" icon={<Sparkles size={14} />}>
                  <InfoBox>
                    Each student can only claim this offer once — perfect as a welcome deal to get new customers through the door.
                  </InfoBox>
                  <Field label="Welcome discount type" required>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {STANDARD_DISCOUNT_TYPES.map(dt => (
                        <button key={dt.value} type="button" onClick={() => setFvType(dt.value)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                            fvType === dt.value ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`mt-0.5 ${fvType === dt.value ? 'text-purple-600' : 'text-gray-400'}`}>{dt.icon}</div>
                          <div>
                            <p className={`text-sm font-bold ${fvType === dt.value ? 'text-purple-900' : 'text-gray-700'}`}>{dt.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{dt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Field>
                  {(fvType === 'percentage' || fvType === 'fixed_amount') && (
                    <Field label={fvType === 'percentage' ? 'Discount %' : 'Discount £'}>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">
                          {fvType === 'percentage' ? '%' : '£'}
                        </span>
                        <input type="number" className={`${INPUT_CLS} pl-8`} placeholder="25"
                          value={fvValue} onChange={e => setFvValue(e.target.value)} min={0} />
                      </div>
                    </Field>
                  )}
                  <Field label="Badge label" hint="Short badge shown on the card">
                    <input type="text" className={INPUT_CLS} placeholder="WELCOME"
                      value={discountLabel} onChange={e => setDiscountLabel(e.target.value.toUpperCase())} maxLength={10} />
                  </Field>
                </Section>
              )}

              {/* ── MILESTONE ── */}
              {mode === 'milestone' && (
                <Section title="Milestone settings" icon={<Trophy size={14} />}>
                  <InfoBox>
                    Students track their cumulative spend at your business. Once they hit the target, they unlock the reward. Great for building loyal regulars.
                  </InfoBox>
                  <Field label="Spend target (£)" required hint="Students need to spend this much in total to earn the reward">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">£</span>
                      <input type="number" className={`${INPUT_CLS} pl-8`} placeholder="50"
                        value={msThreshold} onChange={e => setMsThreshold(e.target.value)} min={1} />
                    </div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[20, 30, 50, 100].map(n => (
                        <button key={n} type="button" onClick={() => setMsThreshold(String(n))}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            msThreshold === String(n) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-amber-50'
                          }`}
                        >£{n}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Reward type" required>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {REWARD_TYPES.map(rt => (
                        <button key={rt.value} type="button" onClick={() => setMsRewardType(rt.value)}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                            msRewardType === rt.value ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={msRewardType === rt.value ? 'text-amber-600' : 'text-gray-400'}>{rt.icon}</div>
                          <p className={`text-xs font-bold ${msRewardType === rt.value ? 'text-amber-900' : 'text-gray-600'}`}>{rt.label}</p>
                        </button>
                      ))}
                    </div>
                  </Field>
                  {msRewardType !== 'free_item' && (
                    <Field label={msRewardType === 'percentage' ? 'Reward % off' : 'Reward £ off'}>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">
                          {msRewardType === 'percentage' ? '%' : '£'}
                        </span>
                        <input type="number" className={`${INPUT_CLS} pl-8`} placeholder="10"
                          value={msRewardValue} onChange={e => setMsRewardValue(e.target.value)} min={0} />
                      </div>
                    </Field>
                  )}
                  <Field label="Reward description" hint="What the student actually gets">
                    <input type="text" className={INPUT_CLS}
                      placeholder="£10 voucher for your next visit"
                      value={msRewardLabel} onChange={e => setMsRewardLabel(e.target.value)} maxLength={60} />
                  </Field>
                </Section>
              )}

              {/* Category */}
              <Section title="Category" icon={<Tag size={14} />}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {CATEGORIES.map(cat => (
                    <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        category === cat.value ? 'border-vendor-500 bg-vendor-50 text-vendor-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Schedule */}
              <Section title="Schedule" icon={<Calendar size={14} />} open={false}>
                <Field label="Start date & time" required>
                  <input type="datetime-local" className={INPUT_CLS}
                    value={startsAt} onChange={e => setStartsAt(e.target.value)} />
                </Field>
                <div className="space-y-1.5 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">End date & time</label>
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300 text-vendor-600"
                        checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)} />
                      No expiry date
                    </label>
                  </div>
                  {!noExpiry
                    ? <input type="datetime-local" className={INPUT_CLS} value={expiresAt}
                        onChange={e => setExpiresAt(e.target.value)} min={startsAt} />
                    : <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                        Runs indefinitely until you manually pause or end it.
                      </p>
                  }
                </div>
              </Section>

              {/* Limits */}
              <Section title="Redemption limits" icon={<Users size={14} />} open={false}>
                <Field label="Max total redemptions" hint="Leave blank for unlimited — good for ongoing offers">
                  <input type="number" className={INPUT_CLS} placeholder="Unlimited"
                    value={maxTotal} onChange={e => setMaxTotal(e.target.value)} min={1} />
                </Field>
                {mode !== 'standard' && (
                  <p className="text-xs text-blue-600 bg-blue-50 rounded-xl px-3 py-2.5 border border-blue-100">
                    Per-student usage is handled automatically by the {currentMode.label} logic above.
                  </p>
                )}
              </Section>

              {/* Terms */}
              <Section title="Terms & conditions" icon={<FileText size={14} />} open={false}>
                <Field label="Terms" hint="What students need to know before claiming. Keep it short.">
                  <textarea className={`${INPUT_CLS} resize-none h-24`}
                    placeholder="Valid Mon–Fri only. Cannot be combined with other offers. Show student ID."
                    value={terms} onChange={e => setTerms(e.target.value)} maxLength={500} />
                  <p className="text-xs text-gray-400 text-right">{terms.length}/500</p>
                </Field>
              </Section>

              {/* Submit */}
              <div className="flex flex-col sm:flex-row gap-3 pb-8">
                <button
                  type="button"
                  onClick={() => handleSubmit('draft')}
                  disabled={submitLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {submitLoading && <Loader2 size={14} className="animate-spin" />}
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('active')}
                  disabled={submitLoading || !title.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-vendor-600 text-white font-bold text-sm hover:bg-vendor-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {submitLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Publish now
                </button>
              </div>
            </div>

            {/* ── LIVE PREVIEW ──────────────────────────────────────────── */}
            <div className="hidden lg:block sticky top-28">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Eye size={13} />
                Student card preview
              </p>
              <OfferPreview
                mode={mode}
                title={title}
                discountLabel={lbl}
                category={category}
                description={description}
                expiresAt={expiresAt}
                businessName={businessName}
                loyaltyConfig={{
                  mode,
                  required_visits: parseInt(pcVisits) || 5,
                  spend_threshold: msThreshold ? parseFloat(msThreshold) : undefined,
                  reward_label: pcRewardLabel || msRewardLabel || undefined,
                }}
              />
              {/* Mode info badge */}
              <div className={`mt-4 flex items-center gap-2 p-3 rounded-xl ${currentMode.bg}`}>
                <div className={currentMode.color}>{currentMode.icon}</div>
                <div>
                  <p className={`text-xs font-bold ${currentMode.color}`}>{currentMode.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{currentMode.tagline}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
