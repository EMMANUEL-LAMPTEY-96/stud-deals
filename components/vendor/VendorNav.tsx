'use client';

// =============================================================================
// components/vendor/VendorNav.tsx
// Full horizontal sub-navigation for all vendor pages.
// Shows live badges: unclaimed rewards + unread notifications.
// Low-use items (marketing tools, Staff, Print QR, Billing) live in a "More"
// dropdown; the main row scrolls horizontally with edge fades on narrow screens.
// =============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, Tag, BarChart3, Users, Gift, CreditCard,
  QrCode, Star, Megaphone, UserCheck, Bell, ChevronDown,
  Zap, CalendarDays, Printer, ChevronRight, MoreHorizontal,
} from 'lucide-react';

// ── "More" menu: marketing tools + low-frequency settings ──────────────────────
// Kept out of the main row so the nav fits at 1280px; the button is pinned
// outside the scroll area so its dropdown is never clipped.
const MORE_SECTIONS = [
  {
    title: 'Marketing',
    items: [
      { href: '/vendor/boost',    label: 'Boost Offer',       icon: <Zap size={14} />,          desc: 'Promote an existing offer' },
      { href: '/vendor/flash',    label: 'Flash Deal',        icon: <Megaphone size={14} />,    desc: 'Time-limited push deal' },
      { href: '/vendor/calendar', label: 'Campaign Calendar', icon: <CalendarDays size={14} />, desc: 'Schedule & manage campaigns' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { href: '/vendor/staff',    label: 'Staff',    icon: <UserCheck size={14} />,  desc: 'Staff PINs for scan mode' },
      { href: '/vendor/print-qr', label: 'Print QR', icon: <Printer size={14} />,    desc: 'Printable QR kit' },
      { href: '/vendor/billing',  label: 'Billing',  icon: <CreditCard size={14} />, desc: 'Plan & subscription' },
    ],
  },
];
const MORE_ITEMS = MORE_SECTIONS.flatMap(s => s.items);

export default function VendorNav() {
  const pathname  = usePathname();
  const supabase  = createClient();

  const [unclaimed,      setUnclaimed]      = useState(0);
  const [unreadNotifs,   setUnreadNotifs]   = useState(0);
  const [moreOpen,       setMoreOpen]       = useState(false);
  const [fadeLeft,       setFadeLeft]       = useState(false);
  const [fadeRight,      setFadeRight]      = useState(false);
  const moreRef   = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement>(null);

  // ── Live badge counts ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: vp } = await supabase
        .from('vendor_profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (!vp || cancelled) return;

      // Unclaimed rewards
      const { count: uc } = await supabase
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vp.id)
        .eq('status', 'reward_earned');

      // Unread notifications (vendor user_id)
      const { count: notif } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!cancelled) {
        setUnclaimed(uc ?? 0);
        setUnreadNotifs(notif ?? 0);
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  // ── Close "More" dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Edge fades: show when the link row can scroll in that direction ─────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setFadeLeft(el.scrollLeft > 2);
      setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);

  // Keep the active link visible when the row is scrollable (e.g. on mobile)
  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const isActive = (href: string) => {
    if (href === '/vendor') return pathname === '/vendor';
    return pathname.startsWith(href);
  };

  const isMoreActive = MORE_ITEMS.some(i => pathname.startsWith(i.href));

  const badge = (count: number) =>
    count > 0 ? (
      <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  const linkCls = (active: boolean) =>
    `relative flex items-center gap-1.5 px-2.5 xl:px-3 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
      active
        ? 'bg-vendor-50 text-vendor-700'
        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
    }`;

  return (
    <div className="bg-white border-b border-gray-100 sticky top-16 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1">
        {/* Scrollable link row with edge fades as a scroll hint */}
        <div className="relative flex-1 min-w-0">
          <nav
            ref={scrollRef}
            aria-label="Vendor"
            className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide py-1"
          >
          {/* Dashboard */}
          <Link href="/vendor" className={linkCls(isActive('/vendor'))} aria-current={isActive('/vendor') ? 'page' : undefined}>
            <LayoutDashboard size={15} />Dashboard
          </Link>

          {/* Offers */}
          <Link href="/vendor/offers" className={linkCls(isActive('/vendor/offers'))} aria-current={isActive('/vendor/offers') ? 'page' : undefined}>
            <Tag size={15} />Offers
          </Link>

          {/* Scan — high-frequency operational action */}
          <Link href="/vendor/scan" className={linkCls(isActive('/vendor/scan'))} aria-current={isActive('/vendor/scan') ? 'page' : undefined}>
            <QrCode size={15} />Scan
          </Link>

          {/* Rewards */}
          <Link href="/vendor/rewards" className={linkCls(isActive('/vendor/rewards'))} aria-current={isActive('/vendor/rewards') ? 'page' : undefined}>
            <Gift size={15} />Rewards
            {badge(unclaimed)}
          </Link>

          {/* Customers */}
          <Link href="/vendor/customers" className={linkCls(isActive('/vendor/customers'))} aria-current={isActive('/vendor/customers') ? 'page' : undefined}>
            <Users size={15} />Customers
          </Link>

          {/* Analytics */}
          <Link href="/vendor/analytics" className={linkCls(isActive('/vendor/analytics'))} aria-current={isActive('/vendor/analytics') ? 'page' : undefined}>
            <BarChart3 size={15} />Analytics
          </Link>

          {/* Reviews */}
          <Link href="/vendor/reviews" className={linkCls(isActive('/vendor/reviews'))} aria-current={isActive('/vendor/reviews') ? 'page' : undefined}>
            <Star size={15} />Reviews
          </Link>

          {/* Notifications */}
          <Link href="/vendor/notifications" className={linkCls(isActive('/vendor/notifications'))} aria-current={isActive('/vendor/notifications') ? 'page' : undefined}>
            <Bell size={15} />Notifications
            {badge(unreadNotifs)}
          </Link>

          </nav>
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-150 ${fadeLeft ? 'opacity-100' : 'opacity-0'}`}
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white via-white/80 to-transparent flex items-center justify-end transition-opacity duration-150 ${fadeRight ? 'opacity-100' : 'opacity-0'}`}
          >
            <ChevronRight size={14} className="text-gray-400" />
          </div>
        </div>

        {/* "More" dropdown — outside the scroll container so it isn't clipped */}
        <div className="relative flex-shrink-0" ref={moreRef}>
          <button
            onClick={() => setMoreOpen(v => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={linkCls(isMoreActive || moreOpen)}
          >
            <MoreHorizontal size={15} />More
            <ChevronDown
              size={13}
              className={`transition-transform duration-150 ${moreOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {moreOpen && (
            <div className="absolute top-full right-0 mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
              {MORE_SECTIONS.map((section, si) => (
                <div key={section.title} className={si > 0 ? 'border-t border-gray-100 mt-1.5 pt-1.5' : ''}>
                  <p className="px-3.5 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {section.title}
                  </p>
                  {section.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-start gap-2.5 px-3.5 py-2 hover:bg-gray-50 transition-colors ${
                        pathname.startsWith(item.href) ? 'bg-vendor-50' : ''
                      }`}
                    >
                      <span className={`mt-0.5 ${pathname.startsWith(item.href) ? 'text-vendor-600' : 'text-gray-400'}`}>
                        {item.icon}
                      </span>
                      <div>
                        <p className={`text-sm font-semibold leading-tight ${pathname.startsWith(item.href) ? 'text-vendor-700' : 'text-gray-800'}`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
