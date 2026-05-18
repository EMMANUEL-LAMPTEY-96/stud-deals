// @ts-nocheck
'use client';

// =============================================================================
// /admin/reviews — Review Moderation
// Admin can view and delete abusive/spam/fake student reviews.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminNav from '@/components/admin/AdminNav';
import {
  Star, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Search, Trash2, AlertTriangle, X, MessageSquare,
} from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  vendor_reply: string | null;
  created_at: string;
  student_name: string;
  business_name: string | null;
  city: string | null;
}

const LIMIT = 50;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <Star
          key={s}
          size={12}
          className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  );
}

function DeleteModal({
  review, onConfirm, onCancel, loading,
}: {
  review: Review; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-gray-900">Delete review</h3>
            <p className="text-sm text-gray-500 mt-1">
              This review by <strong>{review.student_name}</strong> for <strong>{review.business_name}</strong> will be permanently removed. This cannot be undone.
            </p>
          </div>
        </div>
        {review.review_text && (
          <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600 italic mb-4 line-clamp-3">
            "{review.review_text}"
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Delete review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminReviewsPage() {
  const router = useRouter();
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(false);
  const [reviews, setReviews]       = useState<Review[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [search, setSearch]             = useState('');
  const [toDelete, setToDelete]         = useState<Review | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/sign-in');
    });
  }, [router]);

  const fetchReviews = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(LIMIT) });
      if (ratingFilter) params.set('rating', String(ratingFilter));
      if (search)       params.set('search', search);
      const res  = await fetch(`/api/admin/reviews?${params}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.total_pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [ratingFilter, search]);

  useEffect(() => { fetchReviews(1); }, [fetchReviews]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reviews/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Delete failed: ${err.error ?? 'Unknown error'}`);
        return;
      }
      setToDelete(null);
      fetchReviews(page);
    } finally {
      setDeleting(false);
    }
  };

  const goPage = (p: number) => { setPage(p); fetchReviews(p); };

  const ratingColor = (r: number) =>
    r <= 2 ? 'bg-red-50 border-red-100' : r === 3 ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-gray-100';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav active="/admin/reviews" />
      {toDelete && (
        <DeleteModal
          review={toDelete}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
          loading={deleting}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Star size={22} className="text-purple-600" />
              Review Moderation
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Remove abusive, spam, or fake student reviews.</p>
          </div>
          <button
            onClick={() => fetchReviews(page)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchReviews(1)}
              placeholder="Search reviews…"
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Stars:</span>
            <button
              onClick={() => { setRatingFilter(null); setPage(1); }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ratingFilter === null ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >All</button>
            {[1,2,3,4,5].map((r) => (
              <button
                key={r}
                onClick={() => { setRatingFilter(r); setPage(1); }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-0.5 ${ratingFilter === r ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {r}<Star size={9} className="fill-current" />
              </button>
            ))}
          </div>

          {total > 0 && <span className="ml-auto text-xs text-gray-400">{total} reviews</span>}
        </div>

        {/* Reviews */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-purple-400" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-24">
            <Star size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No reviews found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className={`rounded-2xl border p-4 ${ratingColor(r.rating)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <StarRating rating={r.rating} />
                      <span className="text-xs text-gray-400">
                        {r.student_name} → <strong>{r.business_name}</strong>
                        {r.city && <span className="text-gray-300"> · {r.city}</span>}
                      </span>
                      <span className="text-xs text-gray-300 ml-auto">
                        {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {r.review_text ? (
                      <p className="text-sm text-gray-700 leading-relaxed">{r.review_text}</p>
                    ) : (
                      <p className="text-sm text-gray-300 italic">No written review</p>
                    )}
                    {r.vendor_reply && (
                      <div className="mt-2 pl-3 border-l-2 border-gray-200">
                        <div className="flex items-center gap-1 mb-0.5">
                          <MessageSquare size={10} className="text-gray-400" />
                          <span className="text-xs text-gray-400 font-medium">Vendor reply</span>
                        </div>
                        <p className="text-xs text-gray-500">{r.vendor_reply}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setToDelete(r)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors shrink-0"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <span className="text-xs text-gray-400">Page {page} of {totalPages} · {total} reviews</span>
            <div className="flex gap-2">
              <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
