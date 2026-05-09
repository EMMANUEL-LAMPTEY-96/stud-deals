'use client';
import { useEffect, useState } from 'react';
import VendorNav from '@/components/vendor/VendorNav';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  vendor_reply: string | null;
  vendor_replied_at: string | null;
  created_at: string;
  student_profiles: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rating ? 'text-yellow-400' : 'text-gray-600'}>
          {s <= rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-4 text-right text-gray-400">{star}</span>
      <span className="text-yellow-400 text-xs">★</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: pct + '%' }} />
      </div>
      <span className="w-6 text-right text-gray-400 text-xs">{count}</span>
    </div>
  );
}

export default function VendorReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/vendor/reviews')
      .then((r) => r.json())
      .then((d) => {
        setReviews(d.reviews ?? []);
        setTotal(d.total ?? 0);
        setAverage(d.average ?? 0);
      })
      .catch(() => setError('Failed to load reviews.'))
      .finally(() => setLoading(false));
  }, []);

  async function submitReply(reviewId: string) {
    const reply = replyText[reviewId]?.trim();
    if (!reply) return;
    setSaving(reviewId);
    try {
      const res = await fetch('/api/vendor/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, reply }),
      });
      if (!res.ok) throw new Error('Failed to save reply');
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, vendor_reply: reply, vendor_replied_at: new Date().toISOString() }
            : r
        )
      );
      setReplyText((prev) => ({ ...prev, [reviewId]: '' }));
    } catch {
      setError('Could not save reply. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function initials(name: string | null) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <VendorNav />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-gray-400 animate-pulse">Loading reviews...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <VendorNav />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold">Customer Reviews</h1>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {/* Summary card */}
        <div className="bg-gray-900 rounded-2xl p-6 flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center justify-center min-w-[120px]">
            <span className="text-5xl font-bold text-white">{average.toFixed(1)}</span>
            <StarRating rating={Math.round(average)} />
            <span className="text-gray-400 text-sm mt-1">
              {total} review{total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex-1 space-y-1.5">
            {ratingCounts.map(({ star, count }) => (
              <RatingBar key={star} star={star} count={count} total={total} />
            ))}
          </div>
        </div>

        {/* Review list */}
        {reviews.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-8 text-center text-gray-500">
            No reviews yet. Share your stamp card link to start collecting feedback!
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-gray-900 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
                    {review.student_profiles?.avatar_url ? (
                      <img
                        src={review.student_profiles.avatar_url}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      initials(review.student_profiles?.full_name ?? null)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {review.student_profiles?.full_name ?? 'Anonymous'}
                      </span>
                      <span className="text-gray-500 text-xs">{formatDate(review.created_at)}</span>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                </div>

                {review.title && (
                  <p className="font-semibold text-sm">{review.title}</p>
                )}
                {review.body && (
                  <p className="text-gray-300 text-sm leading-relaxed">{review.body}</p>
                )}

                {review.vendor_reply && (
                  <div className="ml-4 pl-3 border-l-2 border-indigo-700 space-y-0.5">
                    <p className="text-xs text-indigo-400 font-medium">Your reply</p>
                    <p className="text-gray-300 text-sm">{review.vendor_reply}</p>
                    {review.vendor_replied_at && (
                      <p className="text-gray-600 text-xs">{formatDate(review.vendor_replied_at)}</p>
                    )}
                  </div>
                )}

                {!review.vendor_reply && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={2}
                      placeholder="Write a public reply..."
                      value={replyText[review.id] ?? ''}
                      onChange={(e) =>
                        setReplyText((prev) => ({ ...prev, [review.id]: e.target.value }))
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => submitReply(review.id)}
                      disabled={saving === review.id || !(replyText[review.id]?.trim())}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
                    >
                      {saving === review.id ? 'Saving...' : 'Post Reply'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
