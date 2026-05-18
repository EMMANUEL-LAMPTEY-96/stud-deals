'use client';

// =============================================================================
// AdminNav — sticky top navigation for all admin pages.
// Fetches live pending-count badges (verifications, vendor approvals) and
// refreshes them every 60 s so admins see urgent items without a page reload.
// =============================================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity, Shield, Store, Users,
  BookOpen, Tag, Star, Megaphone, Settings, Receipt, CreditCard,
} from 'lucide-react';

interface Counts {
  pending_verifications: number;
  pending_vendors: number;
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export default function AdminNav({ active }: { active: string }) {
  const [counts, setCounts] = useState<Counts>({ pending_verifications: 0, pending_vendors: 0 });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/admin/pending-counts');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setCounts(data);
      } catch (_) { /* silently ignore — badges are non-critical */ }
    };

    load();
    const interval = setInterval(load, 60_000); // refresh every 60 s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const NAV_LINKS = [
    { href: '/admin',               label: 'Overview',  icon: <Activity  size={14} />, badge: 0 },
    { href: '/admin/verifications', label: 'Students',  icon: <Shield    size={14} />, badge: counts.pending_verifications },
    { href: '/admin/vendors',       label: 'Vendors',   icon: <Store     size={14} />, badge: counts.pending_vendors },
    { href: '/admin/users',         label: 'Users',     icon: <Users     size={14} />, badge: 0 },
    { href: '/admin/offers',        label: 'Offers',    icon: <Tag       size={14} />, badge: 0 },
    { href: '/admin/reviews',       label: 'Reviews',   icon: <Star      size={14} />, badge: 0 },
    { href: '/admin/redemptions',    label: 'Redeem',    icon: <Receipt   size={14} />, badge: 0 },
    { href: '/admin/audit-log',     label: 'Audit Log', icon: <BookOpen  size={14} />, badge: 0 },
    { href: '/admin/announcements', label: 'Announce',  icon: <Megaphone   size={14} />, badge: 0 },
    { href: '/admin/billing',      label: 'Billing',   icon: <CreditCard  size={14} />, badge: 0 },
    { href: '/admin/config',       label: 'Config',    icon: <Settings    size={14} />, badge: 0 },
  ];

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <nav className="flex items-center gap-0.5 py-1 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                active === l.href
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {l.icon}
              {l.label}
              <Badge n={l.badge} />
            </Link>
          ))}
          <span className="ml-auto text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded-lg font-semibold shrink-0">
            Admin
          </span>
        </nav>
      </div>
    </div>
  );
}
