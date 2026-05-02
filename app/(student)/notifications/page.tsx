'use client';

// =============================================================================
// app/(student)/notifications/page.tsx — Student Notification Centre
//
// Shows all notifications sent to the authenticated student:
//   - Promotional campaigns from vendors they've visited
//   - System notifications (reward ready, stamp milestones, etc.)
//   - Unread badge count on Navbar is kept in sync here
//
// Behaviour:
//   - Unread notifications shown at top, highlighted
//   - "Mark all as read" button
//   - Click any notification → marks it read + optionally opens offer
//   - Infinite scroll (load 20 at a time)
//   - Empty state with CTA to browse deals
//
// Data source: notifications table
//   - type: 'promotion' | 'reward' | 'stamp_milestone' | 'system'
//   - is_read: boolean
//   - vendor_id: FK to vendor_profiles (optional)
//   - offer_id: FK to offers (optional)
// =============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Bell, BellOff, CheckCheck, Gift, Megaphone,
  Star, Zap, Info, Loader2, AlertCircle,
  Coffee, MapPin, ArrowRight, Trash2, ChevronDown,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type NotifType = 'promotion' | 'reward' | 'stamp_milestone' | 'system';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  vendor_id: string | null;
  offer_id: string | null;
  vendor_name?: string;
  vendor_logo?: string | null;
}

const PAGE_SIZE = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function notifIcon(type: NotifType) {
  switch (type) {
    case 'promotion':  return <Megaphone size={16} className="text-brand-500" />;
    case 'reward':     return <Gift size={16} className="text-amber-500" />;
    case 'stamp_milestone': return <Star size={16} className="text-yellow-500" />;
    case 'system':     return <Info size={16} className="text-blue-500" />;
    default:           return <Bell size={16} className="text-gray-400" />;
  }
}

function notifAccent(type: NotifType): string {
  switch (type) {
    case 'promotion':  return 'bg-brand-50 border-brand-100';
    case 'reward':     return 'bg-amber-50 border-amber-100';
    case 'stamp_milestone': return 'bg-yellow-50 border-yellow-100';
    case 'system':     return 'bg-blue-50 border-blue-100';
    default:           return 'bg-gray-50 border-gray-100';
  }
}

// ── Notification item ─────────────────────────────────────────────────────────

function NotifItem({
  notif,
  onRead,
}: {
  notif: Notification;
  onRead: (id: string) => void;
}) {
  const handleClick = () => {
    if (!notif.is_read) onRead(notif.id);
  };

  const inner = (
    <div
      onClick={handleClick}
      className={`
        flex gap-3 p-4 rounded-2xl border cursor-pointer
        transition-all hover:shadow-sm active:scale-[0.99]
        ${notif.is_read ? 'bg-white border-gray-100' : notifAccent(notif.type)}
      `}
    >
      {/* Vendor logo or type icon */}
      <div className="flex-shrink-0 mt-0.5">
        {notif.vendor_logo ? (
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
            <Image src={notif.vendor_logo} alt={notif.vendor_name ?? ''} width={40} height={40} className="object-cover w-full h-full" />
          </div>
        ) : (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${notif.is_read ? 'bg-gray-100' : notifAccent(notif.type)}`}>
            {notifIcon(notif.type)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className={`text-sm font-bold leading-snug ${notif.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
            {notif.title}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!notif.is_read && (
              <div className="w-2 h-2 rounded-full bg-brand-600 flex-shrink-0" />
            )}
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(notif.created_at)}</span>
          </div>
        </div>

        {notif.vendor_name && (
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <Coffee size={10} /> {notif.vendor_name}
          </p>
        )}

        {notif.message && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{notif.message}</p>
        )}

        {notif.offer_id && (
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-600">
            View offer <ArrowRight size={11} />
          </div>
        )}
      </div>
    </div>
  );

  if (notif.offer_id) {
    return (
      <Link href={`/offers/${notif.offer_id}`} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const offsetRef = useRef(0);
  const userIdRef = useRef<string | null>(null);

  const unreadCount = notifs.filter(n => !n.is_read).length;

  // ── Fetch page ──────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (userId: string, offset: number, append = false) => {
    if (offset === 0 && !append) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data, error: fetchErr } = await supabase
        .from('notifications')
        .select(`
          id, type, title, message, is_read, created_at,
          vendor_id, offer_id,
          vendor_profiles (
            business_name,
            logo_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (fetchErr) {
        setError('Failed to load notifications. Please refresh.');
        return;
      }

      const rows = (data ?? []).map((n: any) => ({
        id: n.id,
        type: n.type as NotifType,
        title: n.title,
        message: n.message,
        is_read: n.is_read,
        created_at: n.created_at,
        vendor_id: n.vendor_id,
        offer_id: n.offer_id,
        vendor_name: n.vendor_profiles?.business_name ?? undefined,
        vendor_logo: n.vendor_profiles?.logo_url ?? null,
      }));

      setHasMore(rows.length === PAGE_SIZE);
      offsetRef.current = offset + rows.length;

      if (append) {
        setNotifs(prev => [...prev, ...rows]);
      } else {
        setNotifs(rows);
      }
    } catch (_) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        router.push('/sign-in?next=/notifications');
        return;
      }

      userIdRef.current = user.id;
      await fetchPage(user.id, 0, false);
    };

    init();
    return () => { cancelled = true; };
  }, [fetchPage]);

  // ── Mark single as read ───────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  }, []);

  // ── Mark all as read ──────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!userIdRef.current || unreadCount === 0) return;
    setMarkingAll(true);

    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userIdRef.current)
      .eq('is_read', false);

    setMarkingAll(false);
  }, [unreadCount]);

  // ── Load more ─────────────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!userIdRef.current || loadingMore || !hasMore) return;
    fetchPage(userIdRef.current, offsetRef.current, true);
  }, [fetchPage, loadingMore, hasMore]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50 pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-4">

          {/* Header */}
          <div className="pt-8 pb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-gray-900 mb-1 flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-brand-600 text-white text-xs font-black px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-gray-400 text-sm">Deals and updates from your favourite spots</p>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50"
              >
                {markingAll
                  ? <Loader2 size={13} className="animate-spin" />
                  : <CheckCheck size={13} />
                }
                Mark all read
              </button>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-16">
              <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Loading notifications…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-4 text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                onClick={() => { setError(null); if (userIdRef.current) fetchPage(userIdRef.current, 0, false); }}
                className="font-bold underline whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && notifs.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                <BellOff size={32} className="text-gray-300" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">No notifications yet</h2>
              <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                Earn stamps at partner venues and you'll start receiving exclusive deals and updates here.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition-colors"
              >
                Browse deals <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {/* Notification list */}
          {!loading && notifs.length > 0 && (
            <>
              {/* Unread section */}
              {unreadCount > 0 && (
                <div className="mb-6">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">
                    New · {unreadCount}
                  </h2>
                  <div className="space-y-3">
                    {notifs.filter(n => !n.is_read).map(n => (
                      <NotifItem key={n.id} notif={n} onRead={markRead} />
                    ))}
                  </div>
                </div>
              )}

              {/* Read section */}
              {notifs.filter(n => n.is_read).length > 0 && (
                <div>
                  {unreadCount > 0 && (
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">
                      Earlier
                    </h2>
                  )}
                  <div className="space-y-3">
                    {notifs.filter(n => n.is_read).map(n => (
                      <NotifItem key={n.id} notif={n} onRead={markRead} />
                    ))}
                  </div>
                </div>
              )}

              {/* Load more */}
              {hasMore && (
                <div className="text-center mt-6">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-300 hover:shadow-sm transition-all disabled:opacity-50"
                  >
                    {loadingMore
                      ? <><Loader2 size={15} className="animate-spin" /> Loading…</>
                      : <><ChevronDown size={15} /> Load more</>
                    }
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
