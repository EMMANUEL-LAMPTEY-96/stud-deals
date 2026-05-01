'use client';

// =============================================================================
// components/vendor/VendorNav.tsx
// Shared horizontal sub-navigation for all vendor pages.
// Shows a live unclaimed-rewards badge on the Rewards tab.
// Shows a live unread-notifications bell icon on the right.
// =============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard, Tag, BarChart3, Settings, Users, Gift,
  Zap, Calendar, UserCheck, Bell, Star,
} from 'lucide-react';

export default function VendorNav() {
  const pathname  = usePathname();
  const supabase  = createClient();
  const [unclaimed, setUnclaimed] = useState(0);
  const [unread,    setUnread]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: vp } = await supabase
        .from('vendor_profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (!vp || cancelled) return;

      // Unclaimed rewards badge
      const { count: uc } = await supabase
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vp.id)
        .eq('status', 'reward_earned');
      if (!cancelled) setUnclaimed(uc ?? 0);

      // Unread notifications dot
      const { count: un } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (!cancelled) setUnread(un ?? 0);
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  const NAV_ITEMS = [
    { href: '/vendor',           label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
    { href: '/vendor/offers',    label: 'Offers',    icon: <Tag size={15} /> },
    { href: '/vendor/rewards',   label: 'Rewards',   icon: <Gift size={15} />, badge: unclaimed },
    { href: '/vendor/customers', label: 'Customers', icon: <Users size={15} /> },
    { href: '/vendor/staff',     label: 'Staff',     icon: <UserCheck size={15} /> },
    { href: '/vendor/boost',     label: 'Boost',     icon: <Zap size={15} /> },
    { href: '/vendor/calendar',  label: 'Calendar',  icon: <Calendar size={15} /> },
    { href: '/vendor/analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
    { href: '/vendor/reviews',   label: 'Reviews',   icon: <Star size={15} /> },
    { href: '/vendor/profile',   label: 'Settings',  icon: <Settings size={15} /> },
  ];

  const isActive = (href: string) => {
    if (href === '/vendor') return pathname === '/vendor';
    return pathname.startsWith(href);
  };

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1 flex-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive(item.href)
                    ? 'bg-vendor-50 text-vendor-700'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                {item.label}
                {'badge' in item && item.badge > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Notification bell — pinned right */}
          <Link
            href="/vendor/notifications"
            className={`relative flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ml-1 transition-colors ${
              isActive('/vendor/notifications')
                ? 'bg-vendor-50 text-vendor-700'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
            }`}
            title="Notifications"
          >
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-white" />
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
