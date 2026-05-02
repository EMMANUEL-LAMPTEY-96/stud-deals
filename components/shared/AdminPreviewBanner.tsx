'use client';

// =============================================================================
// components/shared/AdminPreviewBanner.tsx
//
// Shown at the very top of the vendor dashboard when an admin account is
// viewing the page. Reminds admins they're in preview mode and links back
// to the admin panel.
// =============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function AdminPreviewBanner() {
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!cancelled && profile?.role === 'admin') {
          setIsAdmin(true);
        }
      } catch {
        // Silently ignore — banner is non-critical
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-sm font-semibold shadow-md">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} />
        <span>Admin preview — you are viewing the vendor dashboard</span>
      </div>
      <Link
        href="/admin"
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-lg text-xs font-bold"
      >
        <ArrowLeft size={13} /> Back to admin
      </Link>
    </div>
  );
}
