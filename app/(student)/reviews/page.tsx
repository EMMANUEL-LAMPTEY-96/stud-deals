'use client';

// =============================================================================
// app/(student)/reviews/page.tsx — My Reviews
//
// Students see every vendor they've confirmed a redemption with.
// For each vendor they can submit or edit a 1–5 star rating + optional
// written review (title + body, each optional).
// Uses GET /api/student/reviews to load vendors + existing reviews.
// Uses POST /api/student/reviews to submit/update.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Star, Store, CheckCircle, Loader2, Edit3, Send, X,
  MessageSquare, Sparkles, ChevronRight, AlertCircle,
} from 'lucide-react';
import { fmtDate } from '@/lib/currency';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExistingReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
}

interface VendorEntry {
  id: string;
  business_name: string;
  logo_url: string | null;
  city: string | null;
  business_type: string | null;
  existing_review: ExistingReview | null;
}

// ── Star picker ────────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform active:scale-90"
        >
          <Star
            size={28}
            className={`transition-colors ${
              n <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm font-bold text-gray-600">
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][value]}
        </span>
      )}
    </div>
  );
}

// ── Review form ────────────────────────────────────────────────────────────────

function ReviewForm({
  vendor,
  existing,
  onDone,
  onCancel,
}: {
  vendor: VendorEntry;
  existing: ExistingReview | null;
  onDone: (review: ExistingReview) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError('Please select a star rating.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/student/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendor.id, rating, title: title.trim(), review: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to save review.'); return; }
      onDone({
        id: data.id ?? existing?.id ?? '',
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
        created_at: existing?.created_at ?? new Date().toISOString(),
      });
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {/* Stars */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">Your rating *</p>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1.5">
          Title <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Great deal, fast service"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      {/* Body */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-1.5">
          Review <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="What did you love? What could be better?"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none"
        />
        <p className="text-right text-[11px] text-gray-400 mt-0.5">{body.length}/1000</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-600">
          <AlertCircle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || rating === 0}
          className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {saving ? 'Saving…' : existing ? 'Update review' : 'Submit review'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Vendor card ────────────────────────────────────────────────────────────────

function VendorReviewCard({ vendor, onUpdate }: {
  vendor: VendorEntry;
  onUpdate: (vendorId: string, review: ExistingReview) => void;
}) {
  const [editing, setEditing] = useState(false);

  const handleDone = (review: ExistingReview) => {
    onUpdate(vendor.id, review);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Vendor header */}
      <div className="flex items-center gap-3 mb-4">
        {vendor.logo_url ? (
          <img
            src={vendor.logo_url}
            alt={vendor.business_name}
            className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
            <Store size={20} className="text-brand-600" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-sm">{vendor.business_name}</p>
          {vendor.city && <p className="text-xs text-gray-400">{vendor.city}</p>}
        </div>
        {vendor.existing_review && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
          >
            <Edit3 size={12} />
            Edit
          </button>
        )}
      </div>

      {/* Existing review display */}
      {vendor.existing_review && !editing ? (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map(n => (
              <Star
                key={n}
                size={14}
                className={n <= vendor.existing_review!.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
              />
            ))}
            <span className="text-xs text-gray-400 ml-2">{fmtDate(vendor.existing_review.created_at)}</span>
          </div>
          {vendor.existing_review.title && (
            <p className="text-sm font-semibold text-gray-800 mb-1">{vendor.existing_review.title}</p>
          )}
          {vendor.existing_review.body && (
            <p className="text-xs text-gray-500 leading-relaxed">{vendor.existing_review.body}</p>
          )}
          {!vendor.existing_review.title && !vendor.existing_review.body && (
            <p className="text-xs text-gray-400 italic">No written review — just a rating.</p>
          )}
          <div className="flex items-center gap-1.5 mt-3">
            <CheckCircle size={12} className="text-green-500" />
            <span className="text-[11px] text-green-600 font-medium">Review submitted</span>
          </div>
        </div>
      ) : !editing ? (
        /* No review yet — prompt */
        <div>
          <p className="text-xs text-gray-400 mb-3">You&apos;ve redeemed here. Share your experience!</p>
          <button
            onClick={() => setEditing(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-brand-200 hover:border-brand-400 text-brand-600 hover:text-brand-700 rounded-xl py-3 text-sm font-semibold transition-all hover:bg-brand-50"
          >
            <MessageSquare size={14} />
            Write a review
          </button>
        </div>
      ) : null}

      {/* Inline edit form */}
      {editing && (
        <ReviewForm
          vendor={vendor}
          existing={vendor.existing_review}
          onDone={handleDone}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function StudentReviewsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<VendorEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'pending'>('all');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/sign-in?redirect=/reviews'); return; }
    try {
      const res = await fetch('/api/student/reviews');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setVendors(data.vendors ?? []);
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = (vendorId: string, review: ExistingReview) => {
    setVendors(prev => prev.map(v =>
      v.id === vendorId ? { ...v, existing_review: review } : v
    ));
  };

  const filtered = vendors.filter(v => {
    if (filter === 'reviewed') return v.existing_review !== null;
    if (filter === 'pending') return v.existing_review === null;
    return true;
  });

  const reviewedCount = vendors.filter(v => v.existing_review).length;
  const pendingCount = vendors.length - reviewedCount;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={28} className="animate-spin text-brand-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading your reviews…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <Star size={18} className="text-amber-500" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">My Reviews</h1>
            </div>
            <p className="text-gray-500 text-sm mt-0.5 pl-12">
              Rate vendors you&apos;ve redeemed with — helps other students discover the best deals.
            </p>
          </div>

          {/* Stats bar */}
          {vendors.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-2xl font-black text-gray-900">{vendors.length}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Visited</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-2xl font-black text-green-600">{reviewedCount}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Reviewed</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-2xl font-black text-amber-500">{pendingCount}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Pending</p>
              </div>
            </div>
          )}

          {/* Filter tabs */}
          {vendors.length > 0 && (
            <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm mb-5">
              {(['all', 'reviewed', 'pending'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                    filter === tab ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'all' ? `All (${vendors.length})` : tab === 'reviewed' ? `Reviewed (${reviewedCount})` : `Pending (${pendingCount})`}
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {vendors.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={28} className="text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">No visits yet</h2>
              <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
                Once a vendor confirms your redemption, you&apos;ll be able to leave a review here.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-5 py-3 rounded-xl transition-colors"
              >
                Browse deals
                <ChevronRight size={14} />
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">
                {filter === 'reviewed' ? 'No reviews submitted yet.' : 'All vendors have been reviewed!'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(vendor => (
                <VendorReviewCard key={vendor.id} vendor={vendor} onUpdate={handleUpdate} />
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
