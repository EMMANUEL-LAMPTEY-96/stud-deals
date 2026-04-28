'use client';

// =============================================================================
// app/(vendor)/vendor/offers/create/page.tsx — Create Offer
//
// Full offer creation form with a live preview panel.
// Layout: left 60% = form, right 40% = sticky preview card (desktop)
//
// Form sections:
//   1. Basics      — title, description
//   2. Discount    — type (%, fixed, bogo, free), value, display label
//   3. Category    — category picker
//   4. Schedule    — starts_at, expires_at (or no-expiry toggle)
//   5. Limits      — max_uses_per_student, max_total_redemptions
//   6. Terms       — terms_and_conditions textarea
//
// Actions: Save as Draft | Publish Now
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  ArrowLeft, Tag, Eye, CheckCircle, AlertCircle,
  Loader2, Calendar, Users, FileText, Percent,
  DollarSign, Gift, Coffee, MapPin, Clock,
} from 'lucide-react';
import type { DiscountType, OfferCategory } from '@/lib/types/database.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCOUNT_TYPES: { value: DiscountType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'percentage',  label: '% Off',       icon: <Percent size={16} />,    desc: 'e.g. 20% off the total bill' },
  { value: 'fixed_amount',label: 'Fixed £',      icon: <DollarSign size={16} />, desc: 'e.g. £2 off any purchase' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y',  icon: <Gift size={16} />,       desc: 'e.g. Buy 1 Get 1 Free' },
  { value: 'free_item',   label: 'Free Item',    icon: <Coffee size={16} />,     desc: 'e.g. Free cookie with any drink' },
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

// ── Preview card ──────────────────────────────────────────────────────────────
function OfferPreview({
  title, discountLabel, category, description, expiresAt, businessName,
}: {
  title: string; discountLabel: string; category: OfferCategory;
  description: string; expiresAt: string; businessName: string;
}) {
  const cat = CATEGORIES.find((c) => c.value === category);
  const expLabel = expiresAt
    ? `Expires ${new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : 'No expiry';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Top accent */}
      <div className="h-1.5 bg-gradient-to-r from-brand-500 to-brand-400" />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 text-brand-700 text-xs font-black text-center leading-tight px-1">
            {discountLabel || '?'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight">
              {title || 'Your offer title will appear here'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{businessName || 'Your Business'}</p>
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span>{cat?.emoji ?? '🏷️'}</span>
            {cat?.label ?? 'Category'}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {expLabel}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-4 w-full py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold text-center">
          Get Voucher
        </div>
      </div>
      <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">This is how students will see your offer</p>
      </div>
    </div>
  );
}

// ── Form section wrapper ──────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
          {icon}
        </div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const INPUT_CLS = 'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors placeholder:text-gray-300';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CreateOfferPage() {
  const router = useRouter();
  const supabase = createClient();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [category, setCategory] = useState<OfferCategory>('food_drink');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [expiresAt, setExpiresAt] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [maxPerStudent, setMaxPerStudent] = useState('1');
  const [maxTotal, setMaxTotal] = useState('');
  const [terms, setTerms] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch vendor profile on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles').select('id, business_name').eq('user_id', user.id).single();
      if (vp) { setVendorId(vp.id); setBusinessName(vp.business_name); }
      setLoading(false);
    })();
  }, []);

  // Auto-generate discount label
  const autoLabel = () => {
    if (discountLabel) return;
    const v = parseFloat(discountValue);
    if (!v) return;
    if (discountType === 'percentage') setDiscountLabel(`${v}% OFF`);
    else if (discountType === 'fixed_amount') setDiscountLabel(`£${v} OFF`);
    else if (discountType === 'buy_x_get_y') setDiscountLabel('BOGO');
    else if (discountType === 'free_item') setDiscountLabel('FREE');
  };

  // Submit
  const handleSubmit = async (status: 'draft' | 'active') => {
    if (!vendorId) return;
    if (!title.trim()) { setError('Offer title is required.'); return; }
    if (!discountLabel.trim()) { setError('Discount label is required.'); return; }
    setError('');
    setSubmitLoading(true);

    const { error: insertError } = await supabase.from('offers').insert({
      vendor_id: vendorId,
      title: title.trim(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: discountValue ? parseFloat(discountValue) : null,
      discount_label: discountLabel.trim().toUpperCase(),
      category,
      status,
      starts_at: new Date(startsAt).toISOString(),
      expires_at: noExpiry || !expiresAt ? null : new Date(expiresAt).toISOString(),
      max_uses_per_student: parseInt(maxPerStudent) || 1,
      max_total_redemptions: maxTotal ? parseInt(maxTotal) : null,
      terms_and_conditions: terms.trim() || null,
      view_count: 0,
      redemption_count: 0,
      save_count: 0,
    });

    setSubmitLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push('/vendor/offers?created=1');
  };

  return (
    <>
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <Link href="/vendor/offers" className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
              <ArrowLeft size={15} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Create offer</h1>
              <p className="text-gray-500 text-sm">Build a deal that students will love</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5 animate-fade-in">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">

            {/* ── LEFT: FORM ──────────────────────────────────────────── */}
            <div className="space-y-5">

              {/* 1. Basics */}
              <Section title="The basics" icon={<Tag size={14} />}>
                <div className="space-y-4">
                  <Field label="Offer title" required hint="Keep it clear and enticing — 'Get 20% off your entire order'">
                    <input
                      type="text"
                      className={INPUT_CLS}
                      placeholder="e.g. 30% off all meals for students"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-400 text-right">{title.length}/100</p>
                  </Field>
                  <Field label="Description" hint="Optional extra detail about the offer">
                    <textarea
                      className={`${INPUT_CLS} resize-none h-24`}
                      placeholder="Show your student ID at the counter. Valid on dine-in and takeaway."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={300}
                    />
                  </Field>
                </div>
              </Section>

              {/* 2. Discount */}
              <Section title="Discount details" icon={<Percent size={14} />}>
                <div className="space-y-4">
                  {/* Type selector */}
                  <Field label="Discount type" required>
                    <div className="grid grid-cols-2 gap-2">
                      {DISCOUNT_TYPES.map((dt) => (
                        <button
                          key={dt.value}
                          type="button"
                          onClick={() => setDiscountType(dt.value)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                            discountType === dt.value
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`mt-0.5 flex-shrink-0 ${discountType === dt.value ? 'text-brand-600' : 'text-gray-400'}`}>
                            {dt.icon}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${discountType === dt.value ? 'text-brand-900' : 'text-gray-700'}`}>
                              {dt.label}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{dt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Field>

                  {/* Value */}
                  {(discountType === 'percentage' || discountType === 'fixed_amount') && (
                    <Field
                      label={discountType === 'percentage' ? 'Discount percentage' : 'Discount amount (£)'}
                      hint={discountType === 'percentage' ? 'Enter a number between 1–100' : 'Enter the fixed GBP amount'}
                    >
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm pointer-events-none">
                          {discountType === 'percentage' ? '%' : '£'}
                        </span>
                        <input
                          type="number"
                          className={`${INPUT_CLS} pl-8`}
                          placeholder={discountType === 'percentage' ? '20' : '2.50'}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          onBlur={autoLabel}
                          min={0}
                          step={discountType === 'fixed_amount' ? 0.01 : 1}
                        />
                      </div>
                    </Field>
                  )}

                  {/* Discount label */}
                  <Field
                    label="Discount label"
                    required
                    hint="Short badge shown on the offer card — max 10 characters"
                  >
                    <input
                      type="text"
                      className={INPUT_CLS}
                      placeholder="e.g. 30% OFF or BOGO or FREE"
                      value={discountLabel}
                      onChange={(e) => setDiscountLabel(e.target.value.toUpperCase())}
                      maxLength={10}
                    />
                  </Field>
                </div>
              </Section>

              {/* 3. Category */}
              <Section title="Category" icon={<Tag size={14} />}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        category === cat.value
                          ? 'border-brand-500 bg-brand-50 text-brand-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* 4. Schedule */}
              <Section title="Schedule" icon={<Calendar size={14} />}>
                <div className="space-y-4">
                  <Field label="Start date & time" required>
                    <input
                      type="datetime-local"
                      className={INPUT_CLS}
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </Field>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-gray-700">End date & time</label>
                      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          checked={noExpiry}
                          onChange={(e) => setNoExpiry(e.target.checked)}
                        />
                        No expiry date
                      </label>
                    </div>
                    {!noExpiry && (
                      <input
                        type="datetime-local"
                        className={INPUT_CLS}
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        min={startsAt}
                      />
                    )}
                    {noExpiry && (
                      <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                        This offer will run indefinitely until you manually pause or end it.
                      </p>
                    )}
                  </div>
                </div>
              </Section>

              {/* 5. Limits */}
              <Section title="Redemption limits" icon={<Users size={14} />}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field
                    label="Max uses per student"
                    hint="How many times one student can claim this offer"
                  >
                    <input
                      type="number"
                      className={INPUT_CLS}
                      value={maxPerStudent}
                      onChange={(e) => setMaxPerStudent(e.target.value)}
                      min={1}
                    />
                  </Field>
                  <Field
                    label="Max total redemptions"
                    hint="Leave blank for unlimited"
                  >
                    <input
                      type="number"
                      className={INPUT_CLS}
                      placeholder="Unlimited"
                      value={maxTotal}
                      onChange={(e) => setMaxTotal(e.target.value)}
                      min={1}
                    />
                  </Field>
                </div>
              </Section>

              {/* 6. Terms */}
              <Section title="Terms & conditions" icon={<FileText size={14} />}>
                <Field
                  label="Terms"
                  hint="Students will see this before claiming. Keep it brief and clear."
                >
                  <textarea
                    className={`${INPUT_CLS} resize-none h-28`}
                    placeholder="Valid Monday–Friday only. Cannot be combined with other offers. Show student ID."
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-400 text-right">{terms.length}/500</p>
                </Field>
              </Section>

              {/* Submit actions */}
              <div className="flex flex-col sm:flex-row gap-3 pb-8">
                <button
                  onClick={() => handleSubmit('draft')}
                  disabled={submitLoading}
                  className="btn-secondary flex-1 justify-center"
                >
                  {submitLoading ? <Loader2 size={15} className="animate-spin" /> : null}
                  Save as Draft
                </button>
                <button
                  onClick={() => handleSubmit('active')}
                  disabled={submitLoading || !title.trim() || !discountLabel.trim()}
                  className="btn-vendor flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                  Publish now
                </button>
              </div>
            </div>

            {/* ── RIGHT: PREVIEW ──────────────────────────────────────── */}
            <div className="hidden lg:block sticky top-28">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Eye size={13} />
                Live preview
              </p>
              <OfferPreview
                title={title}
                discountLabel={discountLabel}
                category={category}
                description={description}
                expiresAt={expiresAt}
                businessName={businessName}
              />
              <p className="mt-3 text-xs text-gray-400 text-center leading-relaxed">
                Preview updates as you type. Actual card may vary slightly by device.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
