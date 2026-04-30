'use client';

// =============================================================================
// app/(vendor)/vendor/notifications/page.tsx — Vendor Notification Centre
//
// Full notification feed combining:
//   A. Database notifications (notifications table — user_id = vendor's auth uid)
//   B. Client-generated alerts:
//      - Offers expiring in ≤ 48 hours
//      - Recent rewards earned (last 24 h, not yet confirmed)
//      - Loyalty milestones (50th / 100th / 500th stamp)
//
// Notification types and their colours:
//   reward_earned   → green  (Gift icon)
//   tier_reward     → purple (Award icon)
//   offer_expiring  → amber  (Clock icon)
//   milestone       → blue   (Trophy icon)
//   boost_launched  → orange (Zap icon)
//   general         → gray   (Bell icon)
//
// Actions:
//   - Mark individual notification read
//   - Mark all read
//   - Deep-link to relevant page
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Bell, Gift, Award, Clock, Trophy, Zap, CheckCircle,
  Loader2, RefreshCw, X, ArrowRight, AlertCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifType = 'reward_earned' | 'tier_reward' | 'offer_expiring' | 'milestone' | 'boost_launched' | 'general';

interface VendorNotif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  href: string;
  is_read: boolean;
  created_at: string;
  source: 'db' | 'client';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeConfig(type: NotifType) {
  switch (type) {
    case 'reward_earned':  return { icon: <Gift size={16} />,         bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' };
    case 'tier_reward':    return { icon: <Award size={16} />,        bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' };
    case 'offer_expiring': return { icon: <Clock size={16} />,        bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' };
    case 'milestone':      return { icon: <Trophy size={16} />,       bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' };
    case 'boost_launched': return { icon: <Zap size={16} />,          bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' };
    default:               return { icon: <Bell size={16} />,         bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' };
  }
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function msToHours(ms: number) { return Math.round(ms / 3600000); }

// ── Notification Row ──────────────────────────────────────────────────────────

function NotifRow({
  n,
  onRead,
}: {
  n: VendorNotif;
  onRead: (id: string) => void;
}) {
  const cfg = typeConfig(n.type);
  return (
    <div className={`relative flex items-start gap-3.5 p-4 rounded-2xl border transition-colors ${
      n.is_read ? 'bg-white border-gray-100' : 'bg-blue-50/40 border-blue-100'
    }`}>
      {/* Unread dot */}
      {!n.is_read && (
        <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${cfg.dot}`} />
      )}

      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${n.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-gray-400 font-medium">{timeAgo(n.created_at)}</span>
          {n.href && n.href !== '#' && (
            <Link href={n.href} className={`text-[10px] font-bold flex items-center gap-1 ${cfg.text} hover:underline`}>
              View <ArrowRight size={9} />
            </Link>
          )}
          {!n.is_read && n.source === 'db' && (
            <button
              onClick={() => onRead(n.id)}
              className="text-[10px] text-gray-400 hover:text-gray-600 font-medium"
            >
              Mark read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId]   = useState<string | null>(null);
  const [userId, setUserId]       = useState<string | null>(null);
  const [notifs, setNotifs]       = useState<VendorNotif[]>([]);
  const [filter, setFilter]       = useState<'all' | 'unread'>('all');

  // ── Load ──

  const load = useCallback(async (vid: string, uid: string) => {
    const now = new Date();

    // A. Database notifications for this vendor user
    const { data: dbNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);

    const dbItems: VendorNotif[] = (dbNotifs ?? []).map(n => ({
      id: n.id,
      type: (n.type as NotifType) ?? 'general',
      title: n.title,
      body: n.body ?? '',
      href: n.related_entity_id
        ? (n.related_entity_type === 'offer' ? `/vendor/offers/${n.related_entity_id}` : '/vendor/rewards')
        : '#',
      is_read: n.is_read,
      created_at: n.created_at,
      source: 'db',
    }));

    // B. Client-generated: offers expiring ≤ 48h
    const in48h = new Date(Date.now() + 48 * 3600000).toISOString();
    const { data: expiringOffers } = await supabase
      .from('offers')
      .select('id, title, expires_at')
      .eq('vendor_id', vid)
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lte('expires_at', in48h)
      .gte('expires_at', now.toISOString());

    const expiringItems: VendorNotif[] = (expiringOffers ?? []).map(o => {
      const hoursLeft = msToHours(new Date(o.expires_at!).getTime() - Date.now());
      return {
        id: `exp-${o.id}`,
        type: 'offer_expiring',
        title: `"${o.title.slice(0, 40)}" expires soon`,
        body: `This offer expires in ${hoursLeft < 2 ? 'less than 2 hours' : `~${hoursLeft} hours`}. Extend or let it expire.`,
        href: `/vendor/offers/${o.id}`,
        is_read: false,
        created_at: now.toISOString(),
        source: 'client',
      };
    });

    // C. Client-generated: recent unclaimed rewards (last 24 h)
    const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
    const { count: recentRewards } = await supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vid)
      .in('status', ['reward_earned', 'tier_reward'])
      .gte('created_at', since24h);

    const rewardItems: VendorNotif[] = recentRewards && recentRewards > 0 ? [{
      id: 'rewards-pending',
      type: 'reward_earned',
      title: `${recentRewards} reward${recentRewards > 1 ? 's' : ''} waiting to be claimed`,
      body: 'Students have earned their loyalty rewards — visit the Rewards page to mark them as claimed.',
      href: '/vendor/rewards',
      is_read: false,
      created_at: new Date(Date.now() - 60000).toISOString(),
      source: 'client',
    }] : [];

    // D. Milestones — total stamps
    const { count: totalStamps } = await supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vid)
      .eq('status', 'stamp');

    const milestoneItems: VendorNotif[] = [];
    const ts = totalStamps ?? 0;
    const milestones = [500, 100, 50, 10];
    for (const m of milestones) {
      if (ts >= m) {
        milestoneItems.push({
          id: `milestone-${m}`,
          type: 'milestone',
          title: `🏆 ${m} loyalty stamps awarded!`,
          body: `Your loyalty program has now issued ${ts.toLocaleString()} stamps in total. Students love you.`,
          href: '/vendor/analytics',
          is_read: ts > m + 10, // auto-read if well past milestone
          created_at: now.toISOString(),
          source: 'client',
        });
        break; // show only the highest milestone
      }
    }

    // Merge and deduplicate, sort newest first
    const all: VendorNotif[] = [
      ...expiringItems,
      ...rewardItems,
      ...dbItems,
      ...milestoneItems,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setNotifs(all);
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
      setUserId(user.id);
      await load(vp.id, user.id);
    })();
  }, []);

  // ── Actions ──

  const markRead = async (id: string) => {
    if (!userId) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!userId) return;
    const unreadIds = notifs.filter(n => !n.is_read && n.source === 'db').map(n => n.id);
    if (unreadIds.length > 0) {
      await supabase.from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);
    }
    setNotifs(ns => ns.map(n => ({ ...n, is_read: true })));
  };

  // ── Derived ──

  const displayed = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs;
  const unreadCount = notifs.filter(n => !n.is_read).length;

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

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-2xl font-black text-gray-900">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm">Rewards, alerts, and milestones from your loyalty programs.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white transition-colors shadow-sm"
                >
                  <CheckCircle size={14} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => vendorId && userId && load(vendorId, userId)}
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-white shadow-sm"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm mb-5 w-fit">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                  filter === f ? 'bg-vendor-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>

          {/* Notification list */}
          {displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Bell size={24} className="text-gray-400" />
              </div>
              <p className="text-sm font-bold text-gray-700 mb-1">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
              <p className="text-xs text-gray-400">
                {filter === 'unread'
                  ? 'You\'re all caught up.'
                  : 'Notifications appear here when rewards are earned, offers expire, or milestones are reached.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(n => (
                <NotifRow key={n.id} n={n} onRead={markRead} />
              ))}
            </div>
          )}

          {/* Notification types legend */}
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Notification types</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['reward_earned',  'Reward earned — student completed their punch card'],
                ['tier_reward',    'Tier reward — mid-card milestone reached'],
                ['offer_expiring', 'Offer expiring — within 48 hours'],
                ['milestone',      'Milestone — loyalty program achievement'],
              ] as [NotifType, string][]).map(([type, label]) => {
                const cfg = typeConfig(type);
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                      <span className="scale-75">{cfg.icon}</span>
                    </div>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
