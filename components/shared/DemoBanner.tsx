'use client';

// =============================================================================
// components/shared/DemoBanner.tsx
//
// Slim banner shown on every page while signed in to one of the public demo
// accounts (profiles.is_demo). Reads the user's own profile row, which RLS
// allows.
// =============================================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const check = async (userId: string | undefined) => {
      if (!userId) { if (!cancelled) setIsDemo(false); return; }
      const { data } = await supabase.from('profiles').select('is_demo').eq('id', userId).maybeSingle();
      if (!cancelled) setIsDemo(data?.is_demo === true);
    };

    supabase.auth.getUser().then(({ data }) => check(data.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      check(session?.user?.id);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  if (!isDemo) return null;

  return (
    <div className="w-full bg-amber-400 text-amber-950 text-xs font-semibold text-center px-4 py-1.5" role="status">
      You&apos;re viewing a demo account — sample data only. Email, password, account deletion and ID uploads are disabled.
    </div>
  );
}
