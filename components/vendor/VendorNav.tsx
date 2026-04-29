'use client';

// =============================================================================
// components/vendor/VendorNav.tsx
// Shared horizontal sub-navigation for all vendor pages.
// Sits below the main Navbar, shows the current section and quick links.
// =============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Tag, BarChart3, Settings, Users } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/vendor',             label: 'Dashboard',  icon: <LayoutDashboard size={15} /> },
  { href: '/vendor/offers',      label: 'Offers',     icon: <Tag size={15} /> },
  { href: '/vendor/customers',   label: 'Customers',  icon: <Users size={15} /> },
  { href: '/vendor/analytics',   label: 'Analytics',  icon: <BarChart3 size={15} /> },
  { href: '/vendor/profile',     label: 'Settings',   icon: <Settings size={15} /> },
];

export default function VendorNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/vendor') return pathname === '/vendor';
    return pathname.startsWith(href);
  };

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
                isActive(item.href)
                  ? 'bg-vendor-50 text-vendor-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
