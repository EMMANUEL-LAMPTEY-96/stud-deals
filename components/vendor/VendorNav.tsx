'use client';

// =============================================================================
// components/vendor/VendorNav.tsx
// Full horizontal sub-navigation for all vendor pages.
// Shows live badges: unclaimed rewards + unread notifications.
// Includes a Marketing dropdown (Boost · Flash Deal · Calendar)
// =============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, Tag, BarChart3, Users, Gift, CreditCard,
  QrCode, Star, Megaphone, UserCheck, Bell, ChevronDown,
  Zap, CalendarDays, Printer,
} from 'lucide-react';

// ── Marketing sub-menu items ──────────────────────────────────────────────────
const MARKETING_ITEMS = [
  { href: '/vendor/boost',    label: 'Boost Offer',   icon: <Zap size={14} />,         desc: 'Promote an existing offer' },
  { href: '/vendor/flash',    label: 'Flash Deal',    icon: <Megaphone size={14} />,   desc: 'Time-limited push deal' },
  { href: '/vendor/calendar', label: 'Campaign Calendar', icon: <CalendarDays size={14} />, desc: 'Schedule & manage campaigns' },
];

export default function VendorNav() {
  const pathname  = usePathname();
  const supabase  = createClient();

  const [unclaimed,      setUnclaimed]      = useState(0);
  const [unreadNotifs,   setUnreadNotifs]   = useState(0);
  const [marketingOpen,  setMarketingOpen]  = useState(false);
  const marketingRef = useRef<HTMLDivElement>(null);

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

  // ── Close marketing dropdown on outside click ───────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (marketingRef.current && !marketingRef.current.contains(e.target as Node)) {
        setMarketingOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const isActive = (href: string) => {
    if (href === '/vendor') return pathname === '/vendor';
    return pathname.startsWith(href);
  };

  const isMarketingActive = MARKETING_ITEMS.some(i => pathname.startsWith(i.href));

  const badge = (count: number) =>
    count > 0 ? (
      <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  const linkCls = (active: boolean) =>
    `relative flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
      active
        ? 'bg-vendor-50 text-vendor-700'
        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
    }`;

  return (
    <div className="bg-white border-b border-gray-100 sticky top-16 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide py-1">

          {/* Dashboard */}
          <Link href="/vendor" className={linkCls(isActive('/vendor'))}>
            <LayoutDashboard size={15} />Dashboard
          </Link>

          {/* Offers */}
          <Link href="/vendor/offers" className={linkCls(isActive('/vendor/offers'))}>
            <Tag size={15} />Offers
          </Link>

          {/* Scan — high-frequency operational action */}
          <Link href="/vendor/scan" className={linkCls(isActive('/vendor/scan'))}>
            <QrCode size={15} />Scan
          </Link>

          {/* Rewards */}
          <Link href="/vendor/rewards" className={linkCls(isActive('/vendor/rewards'))}>
            <Gift size={15} />Rewards
            {badge(unclaimed)}
          </Link>

          {/* Customers */}
          <Link href="/vendor/customers" className={linkCls(isActive('/vendor/customers'))}>
            <Users size={15} />Customers
          </Link>

          {/* Analytics */}
          <Link href="/vendor/analytics" className={linkCls(isActive('/vendor/analytics'))}>
            <BarChart3 size={15} />Analytics
          </Link>

          {/* Reviews */}
          <Link href="/vendor/reviews" className={linkCls(isActive('/vendor/reviews'))}>
            <Star size={15} />Reviews
          </Link>

          {/* Marketing dropdown ── */}
          <div className="relative" ref={marketingRef}>
            <button
              onClick={() => setMarketingOpen(v => !v)}
              className={linkCls(isMarketingActive || marketingOpen)}
            >
              <Megaphone size={15} />Marketing
              <ChevronDown
                size={13}
                className={`transition-transform duration-150 ${marketingOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {marketingOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                {MARKETING_ITEMS.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMarketingOpen(false)}
                    className={`flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-gray-50 transition-colors ${
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
            )}
          </div>

          {/* Staff */}
          <Link href="/vendor/staff" className={linkCls(isActive('/vendor/staff'))}>
            <UserCheck size={15} />Staff
          </Link>

          {/* Print QR */}
          <Link href="/vendor/print-qr" className={linkCls(isActive('/vendor/print-qr'))}>
            <Printer size={15} />Print QR
          </Link>

          {/* Notifications */}
          <Link href="/vendor/notifications" className={linkCls(isActive('/vendor/notifications'))}>
            <Bell size={15} />Notifications
            {badge(unreadNotifs)}
          </Link>

          {/* Billing */}
          <Link href="/vendor/billing" className={linkCls(isActive('/vendor/billing'))}>
            <CreditCard size={15} />Billing
          </Link>

        </nav>
      </div>
    </div>
  );
}
