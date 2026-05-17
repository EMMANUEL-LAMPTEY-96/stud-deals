'use client';

import Link from 'next/link';
import {
  Activity, Shield, Store, Users,
  BookOpen, Tag, Star, Megaphone, Settings,
} from 'lucide-react';

const NAV_LINKS = [
  { href: '/admin',               label: 'Overview',      icon: <Activity   size={14} /> },
  { href: '/admin/verifications', label: 'Students',      icon: <Shield     size={14} /> },
  { href: '/admin/vendors',       label: 'Vendors',       icon: <Store      size={14} /> },
  { href: '/admin/users',         label: 'Users',         icon: <Users      size={14} /> },
  { href: '/admin/offers',        label: 'Offers',        icon: <Tag        size={14} /> },
  { href: '/admin/reviews',       label: 'Reviews',       icon: <Star       size={14} /> },
  { href: '/admin/audit-log',     label: 'Audit Log',     icon: <BookOpen   size={14} /> },
  { href: '/admin/announcements', label: 'Announce',      icon: <Megaphone  size={14} /> },
  { href: '/admin/config',        label: 'Config',        icon: <Settings   size={14} /> },
];

export default function AdminNav({ active }: { active: string }) {
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
