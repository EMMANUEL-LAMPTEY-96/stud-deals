'use client';

// =============================================================================
// app/(vendor)/vendor/offers/[id]/page.tsx — Offer Detail & Edit
//
// Split into two modes:
//   VIEW mode — stats header, recent redemptions, quick actions
//   EDIT mode — same form fields as create, with current values pre-filled
//
// Stats row: Views | Redemptions | Conversion | Saves | Days active
// Actions: Pause/Resume · Edit · Delete
// Recent redemptions list (last 50)
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  ArrowLeft, Edit3, Pause, Play, Trash2, Eye,
  CheckCircle, TrendingUp, Heart, Clock, Loader2,
  AlertCircle, Calendar, Users, FileText, Percent,
  DollarSign, Gift, Coffee, Tag, X, Save,
} from 'lucide-react';
import type { Offer, Redemption, DiscountType, OfferCategory } from '@/lib/types/database.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function convRate(views: number, r: number) {
  if (views === 0) return '—';
  return `${((r / views) * 100).toFixed(1)}%`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysActive(createdAt: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active:   { label: 'Active',   dot: 'bg-vendor-500', bg: 'bg-vendor-50',  text: 'text-vendor-700' },
  paused:   { label: 'Paused',   dot: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  draft:    { label: 'Draft',    dot: 'bg-gray-400',   bg: 'bg-gray-100',  text: 'text-gray-600'   },
  expired:  { label: 'Expired',  dot: 'bg-red-400',    bg: 'bg-red-50',    text: 'text-red-600'    },
  depleted: { label: 'Depleted', dot: 'bg-orange-400', bg: 'bg-orange-50', text: 'text-orange-700' },
};

const DISCOUNT_TYPES: { value: DiscountType; label: string; icon: React.ReactNode }[] = [
  { value: 'percentage',  label: '% Off',      icon: <Percent size={14} /> },
  { value: 'fixed_amount',label: 'Fix Ft',       icon: <DollarSign size={14} /> },
  { value: 'buy_x_get_y', label: 'Buy X Get Y', icon: <Gift size={14} /> },
  { value: 'free_item',   label: 'Free Item',   icon: <Coffee size={14} /> },
];

const CATEGORIES: { value: OfferCategory; label: string; emoji: string }[] = [
  { value: 'food_drink', label: 'Food & Drink', emoji: '🍕' },
  { value: 'groceries', label: 'Groceries', emoji: '🛒' },
  { value: 'tech', label: 'Tech', emoji: '💻' },
  { value: 'fashion', label: 'Fashion', emoji: '👗' },
  { value: 'health_beauty', label: 'Health & Beauty', emoji: '💆' },
  { value: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { value: 'transport', label: 'Transport', emoji: '🚗' },
  { value: 'books_stationery', label: 'Books', emoji: '📚' },
  { value: 'fitness', label: 'Fitness', emoji: '🏋️' },
  { value: 'other', label: 'Other', emoji: '🏷️' },
];

const INPUT_CLS = 'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors placeholder:text-gray-300';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent = false }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`card p-4 ${accent ? 'bg-vendor-50 border-vendor-100' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-vendor-100 text-vendor-600' : 'bg-gray-100 text-gray-500'}`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-black mb-0.5 ${accent ? 'text-vendor-700' : 'text-gray-900'}`}>{value}</div>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
          <Trash2 size={22} className="text-red-600" />
        </div>
        <h2 className="text-lg font-black text-gray-900 mb-1">Delete this offer?</h2>
        <p className="text-sm text-gray-500 mb-6">
          This offer will be permanently removed. Historical redemption data is preserved. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OfferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const offerId = params?.id as string;
  const supabase = createClient();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [redemptions, setRedemptions] = useState<(Redemption & { offer?: { title: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  // Edit form state
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eDiscountType, setEDiscountType] = useState<DiscountType>('percentage');
  const [eDiscountValue, setEDiscountValue] = useState('');
  const [eDiscountLabel, setEDiscountLabel] = useState('');
  const [eCategory, setECategory] = useState<OfferCategory>('food_drink');
  const [eStartsAt, setEStartsAt] = useState('');
  const [eExpiresAt, setEExpiresAt] = useState('');
  const [eNoExpiry, setENoExpiry] = useState(false);
  const [eMaxPerStudent, setEMaxPerStudent] = useState('1');
  const [eMaxTotal, setEMaxTotal] = useState('');
  const [eTerms, setETerms] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }

      const { data: offerData } = await supabase
        .from('offers').select('*').eq('id', offerId).single();
      if (!offerData) { router.push('/vendor/offers'); return; }
      setOffer(offerData);
      populateEditForm(offerData);

      const { data: redemptionData } = await supabase
        .from('redemptions')
        .select('*')
        .eq('offer_id', offerId)
        .order('claimed_at', { ascending: false })
        .limit(50);
      setRedemptions(redemptionData ?? []);

      setLoading(false);
    })();
  }, [offerId]);

  const populateEditForm = (o: Offer) => {
    setETitle(o.title);
    setEDesc(o.description ?? '');
    setEDiscountType(o.discount_type);
    setEDiscountValue(o.discount_value?.toString() ?? '');
    setEDiscountLabel(o.discount_label);
    setECategory(o.category);
    setEStartsAt(o.starts_at ? new Date(o.starts_at).toISOString().slice(0, 16) : '');
    setEExpiresAt(o.expires_at ? new Date(o.expires_at).toISOString().slice(0, 16) : '');
    setENoExpiry(!o.expires_at);
    setEMaxPerStudent(o.max_uses_per_student.toString());
    setEMaxTotal(o.max_total_redemptions?.toString() ?? '');
    setETerms(o.terms_and_conditions ?? '');
  };

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 4000);
  };

  // ── Save edit ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!offer) return;
    if (!eTitle.trim() || !eDiscountLabel.trim()) { setError('Title and discount label are required.'); return; }
    setError('');
    setSaveLoading(true);

    const { error: updateError } = await supabase.from('offers').update({
      title: eTitle.trim(),
      description: eDesc.trim() || null,
      discount_type: eDiscountType,
      discount_value: eDiscountValue ? parseFloat(eDiscountValue) : null,
      discount_label: eDiscountLabel.trim().toUpperCase(),
      category: eCategory,
      starts_at: new Date(eStartsAt).toISOString(),
      expires_at: eNoExpiry || !eExpiresAt ? null : new Date(eExpiresAt).toISOString(),
      max_uses_per_student: parseInt(eMaxPerStudent) || 1,
      max_total_redemptions: eMaxTotal ? parseInt(eMaxTotal) : null,
      terms_and_conditions: eTerms.trim() || null,
    }).eq('id', offer.id);

    setSaveLoading(false);
    if (updateError) { setError(updateError.message); return; }

    // Re-fetch offer
    const { data: fresh } = await supabase.from('offers').select('*').eq('id', offer.id).single();
    if (fresh) setOffer(fresh);
    setEditMode(false);
    showFlash('Offer updated successfully.');
  };

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: 'active' | 'paused') => {
    if (!offer) return;
    await supabase.from('offers').update({ status: newStatus }).eq('id', offer.id);
    setOffer((prev) => prev ? { ...prev, status: newStatus } : null);
    showFlash(newStatus === 'active' ? 'Offer resumed.' : 'Offer paused.');
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!offer) return;
    setDeleteLoading(true);
    const { error } = await supabase.from('offers').delete().eq('id', offer.id);
    setDeleteLoading(false);
    if (error) { setError('Failed to delete offer.'); return; }
    router.push('/vendor/offers');
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <VendorNav />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-vendor-500" />
        </div>
      </>
    );
  }

  if (!offer) return null;
  const sc = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG.draft;
  const days = daysActive(offer.created_at);
  const rate = convRate(offer.view_count, offer.redemption_count);

  return (
    <>
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
            <div className="flex items-start gap-3">
              <Link href="/vendor/offers" className="w-8 h-8 mt-1 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 flex-shrink-0 transition-colors">
                <ArrowLeft size={15} />
              </Link>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-gray-900">{offer.title}</h1>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Created {new Date(offer.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {(offer.status === 'active' || offer.status === 'paused') && (
                <button
                  onClick={() => handleStatusChange(offer.status === 'active' ? 'paused' : 'active')}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  {offer.status === 'active'
                    ? <><Pause size={13} className="text-yellow-500" /> Pause</>
                    : <><Play size={13} className="text-vendor-500" /> Resume</>
                  }
                </button>
              )}
              {!editMode ? (
                <button onClick={() => setEditMode(true)} className="btn-secondary text-xs px-4 py-2">
                  <Edit3 size={13} />
                  Edit offer
                </button>
              ) : (
                <button onClick={() => { setEditMode(false); populateEditForm(offer); }} className="btn-secondary text-xs px-4 py-2">
                  <X size={13} />
                  Cancel
                </button>
              )}
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>

          {/* Flash */}
          {flash && (
            <div className="flex items-center gap-2.5 bg-vendor-50 border border-vendor-200 text-vendor-800 rounded-xl px-4 py-3 text-sm mb-5 animate-fade-in">
              <CheckCircle size={15} />
              {flash}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5 animate-fade-in">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-7">
            <StatCard icon={<Eye size={15} />} label="Views" value={fmtNum(offer.view_count)} sub="Total impressions" />
            <StatCard icon={<CheckCircle size={15} />} label="Redeemed" value={fmtNum(offer.redemption_count)} sub="In-store confirmations" accent />
            <StatCard icon={<TrendingUp size={15} />} label="Conversion" value={rate} sub="Views → confirmed" />
            <StatCard icon={<Heart size={15} />} label="Saved" value={fmtNum(offer.save_count)} sub="Students bookmarked" />
            <StatCard icon={<Calendar size={15} />} label="Days active" value={days} sub={`Since ${new Date(offer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} />
          </div>

          {/* Main grid */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── Offer details / Edit form (2/3) ──────────────────────── */}
            <div className="lg:col-span-2">
              <div className="card p-5 sm:p-6">
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <Tag size={15} className="text-gray-400" />
                    {editMode ? 'Edit offer details' : 'Offer details'}
                  </h2>
                  {editMode && (
                    <button
                      onClick={handleSave}
                      disabled={saveLoading}
                      className="btn-vendor text-xs px-4 py-2"
                    >
                      {saveLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      Save changes
                    </button>
                  )}
                </div>

                {editMode ? (
                  // EDIT FORM
                  <div className="space-y-5">
                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Title <span className="text-red-400">*</span></label>
                      <input type="text" className={INPUT_CLS} value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={100} />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Description</label>
                      <textarea className={`${INPUT_CLS} resize-none h-20`} value={eDesc} onChange={(e) => setEDesc(e.target.value)} maxLength={300} />
                    </div>

                    {/* Discount type */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Discount type</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {DISCOUNT_TYPES.map((dt) => (
                          <button
                            key={dt.value}
                            type="button"
                            onClick={() => setEDiscountType(dt.value)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                              eDiscountType === dt.value ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {dt.icon} {dt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Discount value + label */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      {(eDiscountType === 'percentage' || eDiscountType === 'fixed_amount') && (
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-gray-700">
                            {eDiscountType === 'percentage' ? 'Percentage' : 'Amount (Ft)'}
                          </label>
                          <input type="number" className={INPUT_CLS} value={eDiscountValue} onChange={(e) => setEDiscountValue(e.target.value)} />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Discount label <span className="text-red-400">*</span></label>
                        <input type="text" className={INPUT_CLS} value={eDiscountLabel} onChange={(e) => setEDiscountLabel(e.target.value.toUpperCase())} maxLength={10} />
                      </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Category</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setECategory(cat.value)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                              eCategory === cat.value ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {cat.emoji} {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Starts at</label>
                        <input type="datetime-local" className={INPUT_CLS} value={eStartsAt} onChange={(e) => setEStartsAt(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-sm font-semibold text-gray-700">Expires at</label>
                          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                            <input type="checkbox" checked={eNoExpiry} onChange={(e) => setENoExpiry(e.target.checked)} className="rounded border-gray-300 text-brand-600" />
                            No expiry
                          </label>
                        </div>
                        {!eNoExpiry && (
                          <input type="datetime-local" className={INPUT_CLS} value={eExpiresAt} onChange={(e) => setEExpiresAt(e.target.value)} />
                        )}
                      </div>
                    </div>

                    {/* Limits */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Max uses per student</label>
                        <input type="number" className={INPUT_CLS} value={eMaxPerStudent} onChange={(e) => setEMaxPerStudent(e.target.value)} min={1} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Max total redemptions</label>
                        <input type="number" className={INPUT_CLS} placeholder="Unlimited" value={eMaxTotal} onChange={(e) => setEMaxTotal(e.target.value)} min={1} />
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Terms & conditions</label>
                      <textarea className={`${INPUT_CLS} resize-none h-24`} value={eTerms} onChange={(e) => setETerms(e.target.value)} maxLength={500} />
                    </div>
                  </div>
                ) : (
                  // VIEW mode
                  <dl className="space-y-4">
                    {[
                      { label: 'Discount', value: `${offer.discount_label} · ${offer.discount_type.replace('_', ' ')}${offer.discount_value ? ` (${offer.discount_value}${offer.discount_type === 'percentage' ? '%' : ' Ft'})` : ''}` },
                      { label: 'Category', value: CATEGORIES.find((c) => c.value === offer.category)?.label ?? offer.category },
                      { label: 'Starts', value: new Date(offer.starts_at).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }) },
                      { label: 'Expires', value: offer.expires_at ? new Date(offer.expires_at).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }) : 'No expiry' },
                      { label: 'Per-student limit', value: `${offer.max_uses_per_student} use${offer.max_uses_per_student !== 1 ? 's' : ''}` },
                      { label: 'Total cap', value: offer.max_total_redemptions ? `${offer.redemption_count} / ${offer.max_total_redemptions}` : 'Unlimited' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                        <dt className="text-sm text-gray-400 font-medium w-36 flex-shrink-0">{item.label}</dt>
                        <dd className="text-sm text-gray-800 font-semibold text-right">{item.value}</dd>
                      </div>
                    ))}
                    {offer.description && (
                      <div className="py-2">
                        <dt className="text-sm text-gray-400 font-medium mb-1.5">Description</dt>
                        <dd className="text-sm text-gray-700 leading-relaxed">{offer.description}</dd>
                      </div>
                    )}
                    {offer.terms_and_conditions && (
                      <div className="py-2">
                        <dt className="text-sm text-gray-400 font-medium mb-1.5">Terms</dt>
                        <dd className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
                          {offer.terms_and_conditions}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>

            {/* ── Recent Redemptions (1/3) ──────────────────────────────── */}
            <div>
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <CheckCircle size={14} className="text-gray-400" />
                    Recent redemptions
                  </h2>
                  <span className="text-xs text-gray-400">Last 50</span>
                </div>

                {redemptions.length === 0 ? (
                  <div className="py-12 text-center px-4">
                    <Clock size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No redemptions yet.</p>
                    <p className="text-xs text-gray-400 mt-0.5">Publish this offer to start seeing activity.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                    {redemptions.map((r) => {
                      const isConfirmed = r.status === 'confirmed';
                      return (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isConfirmed ? 'bg-vendor-100 text-vendor-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isConfirmed ? <CheckCircle size={13} /> : <Clock size={13} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 capitalize">{r.student_institution_name ?? 'Student'}</p>
                            <p className="text-[11px] text-gray-400">{timeAgo(r.claimed_at)}</p>
                          </div>
                          <span className={`text-[11px] font-bold ${isConfirmed ? 'text-vendor-600' : 'text-gray-400'}`}>
                            {isConfirmed ? '✓' : '⏳'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDelete && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}
