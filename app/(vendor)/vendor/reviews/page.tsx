'use client';

// =============================================================================
// app/(vendor)/vendor/reviews/page.tsx — Student Reviews (Vendor View)
//
// Shows student ratings and written reviews for this vendor.
// Vendors can publicly respond to individual reviews.
//
// Schema required (run in Supabase SQL editor):
// ─────────────────────────────────────────────
// CREATE TABLE IF NOT EXISTS vendor_reviews (
//   id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   vendor_id        uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
//   student_id       uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
//   rating           smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
//   title            text,
//   body             text,
//   vendor_reply     text,
//   vendor_replied_at timestamptz,
//   is_visible       boolean NOT NULL DEFAULT true,
//   created_at       timestamptz NOT NULL DEFAULT now()
// );
// CREATE INDEX ON vendor_reviews(vendor_id);
// ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Vendors read own reviews" ON vendor_reviews
//   FOR SELECT USING (vendor_id IN (
//     SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
//   ));
// CREATE POLICY "Vendors update own replies" ON vendor_reviews
//   FOR UPDATE USING (vendor_id IN (
//     SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
//   ));
// ─────────────────────────────────────────────
//
// Until the table exists, the page shows a friendly setup prompt.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Star, MessageSquare, ThumbsUp, AlertCircle, CheckCircle,
  Loader2, RefreshCw, ChevronDown, ChevronUp, Send,
  X, BarChart3, TrendingUp, Users,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  vendor_reply: string | null;
  vendor_replied_at: string | null;
  is_visible: boolean;
  created_at: string;
  student_name: string;
  student_initials: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  );
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const days = Math.floor(d / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('hu-HU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  onReply,
}: {
  review: Review;
  onReply: (id: string, text: string) => Promise<void>;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState(review.vendor_reply ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!replyText.trim()) return;
    setSaving(true);
    await onReply(review.id, replyText.trim());
    setSaving(false);
    setShowReply(false);
  };

  const ratingColors: Record<number, string> = {
    5: 'bg-green-50 border-green-100',
    4: 'bg-emerald-50 border-emerald-100',
    3: 'bg-amber-50 border-amber-100',
    2: 'bg-orange-50 border-orange-100',
    1: 'bg-red-50 border-red-100',
  };

  return (
    <div className={`rounded-2xl border p-5 ${ratingColors[review.rating] ?? 'bg-white border-gray-100'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-vendor-100 text-vendor-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {review.student_initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{review.student_name}</p>
            <p className="text-xs text-gray-400">{timeAgo(review.created_at)}</p>
          </div>
        </div>
        <Stars rating={review.rating} size={15} />
      </div>

      {/* Content */}
      {review.title && (
        <p className="text-sm font-bold text-gray-900 mb-1">{review.title}</p>
      )}
      {review.body && (
        <p className="text-sm text-gray-700 leading-relaxed">{review.body}</p>
      )}

      {/* Existing reply */}
      {review.vendor_reply && !showReply && (
        <div className="mt-3 bg-white/70 rounded-xl border border-white p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare size={12} className="text-vendor-600" />
            <p className="text-[10px] font-bold text-vendor-700 uppercase tracking-wide">Your reply</p>
            <p className="text-[10px] text-gray-400 ml-auto">
              {review.vendor_replied_at ? timeAgo(review.vendor_replied_at) : ''}
            </p>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{review.vendor_reply}</p>
          <button
            onClick={() => setShowReply(true)}
            className="text-[10px] text-vendor-600 font-semibold mt-2 hover:underline"
          >
            Edit reply
          </button>
        </div>
      )}

      {/* Reply form */}
      {showReply ? (
        <div className="mt-3">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Thank the student, address feedback, or share more info…"
            rows={3}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-vendor-400 focus:ring-2 focus:ring-vendor-100 resize-none"
            maxLength={400}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-gray-400">{replyText.length}/400</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowReply(false); setReplyText(review.vendor_reply ?? ''); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !replyText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vendor-600 text-white text-xs font-bold hover:bg-vendor-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Post reply
              </button>
            </div>
          </div>
        </div>
      ) : !review.vendor_reply && (
        <button
          onClick={() => setShowReply(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-vendor-600 hover:text-vendor-800 transition-colors"
        >
          <MessageSquare size={13} /> Reply to this review
        </button>
      )}
    </div>
  );
}

// ── Setup prompt (table not yet created) ─────────────────────────────────────

function SetupPrompt() {
  const [showSql, setShowSql] = useState(false);
  const sql = `CREATE TABLE IF NOT EXISTS vendor_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id        uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  rating           smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title            text,
  body             text,
  vendor_reply     text,
  vendor_replied_at timestamptz,
  is_visible       boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON vendor_reviews(vendor_id);
ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors read own reviews" ON vendor_reviews
  FOR SELECT USING (vendor_id IN (
    SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
  ));
CREATE POLICY "Vendors update own replies" ON vendor_reviews
  FOR UPDATE USING (vendor_id IN (
    SELECT id FROM vendor_profiles WHERE user_id = auth.uid()
  ));`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
        <Star size={24} className="text-amber-600" />
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-2">Reviews not yet enabled</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-5">
        The reviews feature requires a <code className="bg-gray-100 px-1 rounded text-xs">vendor_reviews</code> table.
        Run the SQL below in your Supabase SQL editor to activate it.
      </p>
      <button
        onClick={() => setShowSql(v => !v)}
        className="flex items-center gap-2 mx-auto text-sm font-semibold text-vendor-600 hover:text-vendor-800 transition-colors"
      >
        {showSql ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showSql ? 'Hide' : 'Show'} SQL migration
      </button>
      {showSql && (
        <pre className="mt-4 text-left text-[10px] bg-gray-900 text-green-400 rounded-xl p-4 overflow-x-auto leading-relaxed">
          {sql}
        </pre>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1' | 'unreplied'>('all');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (vid: string) => {
    // Try fetching — if table doesn't exist Supabase returns a specific error
    const { data, error } = await supabase
      .from('vendor_reviews' as any)
      .select(`
        *,
        student:student_profiles(
          user_id,
          profile:profiles!student_profiles_user_id_fkey(first_name, last_name, display_name)
        )
      `)
      .eq('vendor_id', vid)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error) {
      // Table doesn't exist yet
      setTableExists(false);
      setLoading(false);
      return;
    }

    setTableExists(true);

    const mapped: Review[] = (data ?? []).map((r: any) => {
      const profile = r.student?.profile;
      const name = profile?.display_name
        ?? (profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : 'Anonymous');
      const parts = name.trim().split(' ').filter(Boolean);
      const initials = parts.length >= 2
        ? parts[0][0] + parts[parts.length - 1][0]
        : name.slice(0, 2);
      return {
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        vendor_reply: r.vendor_reply,
        vendor_replied_at: r.vendor_replied_at,
        is_visible: r.is_visible,
        created_at: r.created_at,
        student_name: name,
        student_initials: initials.toUpperCase(),
      };
    });

    setReviews(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?role=vendor'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles').select('id').eq('user_id', user.id).single();
      if (!vp) { router.push('/vendor/profile'); return; }
      setVendorId(vp.id);
      await load(vp.id);
    })();
  }, []);

  const handleReply = async (reviewId: string, text: string) => {
    await supabase
      .from('vendor_reviews' as any)
      .update({ vendor_reply: text, vendor_replied_at: new Date().toISOString() })
      .eq('id', reviewId);
    setToast('Reply posted.');
    setTimeout(() => setToast(null), 3000);
    if (vendorId) await load(vendorId);
  };

  // ── Stats ──

  const avg = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
    : 0;

  const dist = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: reviews.length > 0
      ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100
      : 0,
  }));

  const filtered = filter === 'all' ? reviews
    : filter === 'unreplied' ? reviews.filter(r => !r.vendor_reply)
    : reviews.filter(r => r.rating === parseInt(filter));

  if (loading) return (
    <><Navbar /><VendorNav />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-vendor-600" />
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <VendorNav />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2">
          <CheckCircle size={15} /> {toast}
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Student Reviews</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {reviews.length > 0
                  ? `${reviews.length} reviews · ${avg.toFixed(1)} avg rating`
                  : 'See what students think about your business'}
              </p>
            </div>
            <button
              onClick={() => vendorId && load(vendorId)}
              className="self-start flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white shadow-sm"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {!tableExists ? (
            <SetupPrompt />
          ) : reviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Star size={24} className="text-amber-500" />
              </div>
              <p className="text-sm font-bold text-gray-700 mb-1">No reviews yet</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Students can leave reviews after redeeming an offer. Reviews will appear here once they start coming in.
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">

              {/* Left: Summary */}
              <div className="space-y-4">
                {/* Overall rating */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                  <p className="text-5xl font-black text-gray-900">{avg.toFixed(1)}</p>
                  <Stars rating={Math.round(avg)} size={20} />
                  <p className="text-xs text-gray-400 mt-2">{reviews.length} reviews</p>

                  <div className="mt-4 space-y-1.5">
                    {dist.map(d => (
                      <div key={d.star} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-4 text-right">{d.star}</span>
                        <Star size={10} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${d.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 w-5 text-left">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Response rate */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Response rate</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-black text-vendor-700">
                      {reviews.length > 0
                        ? `${Math.round((reviews.filter(r => r.vendor_reply).length / reviews.length) * 100)}%`
                        : '—'}
                    </p>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">
                        {reviews.filter(r => r.vendor_reply).length} of {reviews.length} replied
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Businesses that reply get 23% more reviews
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sentiment breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sentiment</p>
                  {[
                    { label: 'Positive', stars: [4,5], color: 'bg-green-500' },
                    { label: 'Neutral',  stars: [3],   color: 'bg-amber-400' },
                    { label: 'Critical', stars: [1,2], color: 'bg-red-400' },
                  ].map(s => {
                    const count = reviews.filter(r => s.stars.includes(r.rating)).length;
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-14">{s.label}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{Math.round(pct)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Review list */}
              <div className="lg:col-span-2 space-y-4">
                {/* Filter tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all',       label: `All (${reviews.length})` },
                    { id: 'unreplied', label: `Unreplied (${reviews.filter(r => !r.vendor_reply).length})` },
                    { id: '5', label: '⭐⭐⭐⭐⭐' },
                    { id: '4', label: '⭐⭐⭐⭐' },
                    { id: '3', label: '⭐⭐⭐' },
                    { id: '1', label: '⭐ Low' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id as typeof filter)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        filter === f.id
                          ? 'bg-vendor-600 text-white border-vendor-600'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Reviews */}
                {filtered.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <p className="text-sm text-gray-400">No reviews match this filter.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map(r => (
                      <ReviewCard key={r.id} review={r} onReply={handleReply} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
