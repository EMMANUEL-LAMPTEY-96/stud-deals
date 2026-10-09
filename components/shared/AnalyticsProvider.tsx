'use client';

// =============================================================================
// components/shared/AnalyticsProvider.tsx — starts PostHog after consent
//
// Renders nothing. On mount (and whenever the cookie banner is saved) it starts
// analytics if — and only if — the user opted in. It then identifies the
// signed-in user by profile id with role / is_demo / city / institution, and
// resets the identity on sign-out. See lib/analytics/index.ts.
//
// It also reports milestones that someone else caused — an admin verifying the
// student or approving the vendor, a vendor confirming a voucher, a referred
// friend completing their referral — the next time the subject opens the app
// (trackOnce, back-dated to when it happened).
// =============================================================================

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CONSENT_EVENT, hasAnalyticsConsent, type ConsentState } from '@/lib/analytics/consent';
import {
  identify, initAnalytics, isAnalyticsConfigured, resetAnalytics, stopAnalytics, trackOnce,
  type PersonProperties,
} from '@/lib/analytics';

type Supabase = ReturnType<typeof createClient>;

const MILESTONE_LOOKBACK_DAYS = 90;

async function loadPersonProperties(
  supabase: Supabase,
  userId: string,
): Promise<PersonProperties | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_demo, city')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;

  let city: string | null = profile.city ?? null;
  let institution: string | null = null;

  if (profile.role === 'student') {
    const { data: sp } = await supabase
      .from('student_profiles')
      .select('institution_id, institution_name_manual')
      .eq('user_id', userId)
      .maybeSingle();
    institution = sp?.institution_name_manual ?? null;
    if (sp?.institution_id) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('name, city')
        .eq('id', sp.institution_id)
        .maybeSingle();
      institution = inst?.name ?? institution;
      city = city ?? inst?.city ?? null;
    }
  } else if (profile.role === 'vendor') {
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('city')
      .eq('user_id', userId)
      .maybeSingle();
    city = vp?.city ?? city;
  }

  return { role: profile.role, is_demo: profile.is_demo === true, city, institution };
}

/** Reports milestones caused by someone else (see header). Reads only the user's own rows (RLS). */
async function syncMilestones(supabase: Supabase, userId: string, role: string) {
  const since = new Date(Date.now() - MILESTONE_LOOKBACK_DAYS * 86_400_000).toISOString();

  if (role === 'vendor') {
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('id, is_verified, verified_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (vp?.is_verified) await trackOnce(vp.id, 'vendor_approved', {}, vp.verified_at);
    return;
  }
  if (role !== 'student') return;

  const { data: sp } = await supabase
    .from('student_profiles')
    .select('id, verification_status, verification_method, verified_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!sp) return;

  if (sp.verification_status === 'verified') {
    await trackOnce(userId, 'verified', { method: sp.verification_method ?? null }, sp.verified_at);
  }

  const { data: redeemed } = await supabase
    .from('redemptions')
    .select('id, offer_id, vendor_id, offer_category, confirmed_at, discount_value_applied')
    .eq('student_id', sp.id)
    .eq('status', 'confirmed')
    .gte('confirmed_at', since)
    .order('confirmed_at', { ascending: true })
    .limit(50);
  for (const r of redeemed ?? []) {
    await trackOnce(r.id, 'voucher_redeemed', {
      offer_id: r.offer_id,
      vendor_id: r.vendor_id,
      category: r.offer_category ?? null,
      discount_value_huf: r.discount_value_applied ?? null,
    }, r.confirmed_at);
  }

  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, status, reward_granted_at, created_at')
    .eq('referrer_id', sp.id)
    .eq('status', 'completed')
    .limit(50);
  for (const ref of referrals ?? []) {
    await trackOnce(ref.id, 'referral_completed', { side: 'referrer' }, ref.reward_granted_at ?? ref.created_at);
  }
}

export default function AnalyticsProvider() {
  useEffect(() => {
    if (!isAnalyticsConfigured()) return;

    const supabase = createClient();
    let identifiedId: string | null = null;
    let running = false;

    async function identifyUser(userId: string) {
      if (!running || identifiedId === userId) return;
      identifiedId = userId;
      const person = await loadPersonProperties(supabase, userId);
      identify(userId, person ?? undefined);
      if (person) await syncMilestones(supabase, userId, person.role);
    }

    async function start() {
      if (running || !hasAnalyticsConsent()) return;
      running = initAnalytics();
      if (!running) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await identifyUser(user.id);
    }

    function onConsentChanged(e: Event) {
      const consent = (e as CustomEvent<ConsentState>).detail;
      if (consent?.analytics) {
        void start();
      } else if (running) {
        stopAnalytics();
        running = false;
        identifiedId = null;
      }
    }

    void start();
    window.addEventListener(CONSENT_EVENT, onConsentChanged);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (running) resetAnalytics();
        identifiedId = null;
      } else if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        void identifyUser(session.user.id);
      }
    });

    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsentChanged);
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
