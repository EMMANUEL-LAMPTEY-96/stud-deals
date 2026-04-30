'use client';

// =============================================================================
// components/shared/AdminPreviewBanner.tsx
//
// A slim top banner shown only when an admin account is viewing student
// or vendor pages. Reminds the admin they are in preview mode and gives
// a one-click return to the admin dashboard.
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Shield, ArrowLeft, X } from 'lucide-react';

export default function AdminPreviewBanner() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      setIsAdmin(profile?.role === 'admin');
    };
    check();
  }, []);

  if (!isAdmin || dismissed) return null;

  return (
    <div className="bg-purple-600 text-white text-xs font-semibold flex items-center justify-between px-4 py-2 z-50">
      <div className="flex items-center gap-2">
        <Shield size={12} />
        Admin preview mode — you are viewing this as an admin, not a real user
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
        >
          <ArrowLeft size={11} />
          Back to admin
        </Link>
        <button onClick={() => setDismissed(true)} className="hover:text-white/70 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
