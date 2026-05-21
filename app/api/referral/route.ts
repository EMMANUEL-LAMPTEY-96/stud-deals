// @ts-nocheck
// Supabase typed-client suppressed: referrals table and referral_code/referred_by_id
// columns on student_profiles were added in SQL migrations after the last type
// regeneration. Safe to suppress — queries are correct, columns exist in DB.
// TODO: remove after running `supabase gen types typescript --project-id mktqusaucpunasdnfulx`
// =============================================================================
// app/api/referral/route.ts
//
// GET  — Returns the authenticated student's referral code (creates it on first
//         call), plus referral stats: pending count, completed count, stamps earned.
//
// POST — Registers a referral link. Called immediately after a new student
//         account is created, passing the referral code they signed up with.
//         Body: { referral_code: string }
// =============================================================================

import { safeLog } from '@/lib/utils/safe-logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
// VULN-11 fix: use cryptographically secure random bytes instead of Math.random()
import { randomBytes } from 'crypto';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 to avoid confusion
  const bytes = randomBytes(8);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get student profile
  const { data: sp } = await admin
    .from('student_profiles')
    .select('id, referral_code')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sp) return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });

  // Auto-generate referral code if this student doesn't have one yet
  let referralCode = sp.referral_code;
  if (!referralCode) {
    // Retry on collision (extremely unlikely with 8 chars from 32-char alphabet = 32^8 = 1 trillion combos)
    let attempts = 0;
    while (!referralCode && attempts < 5) {
      const candidate = generateReferralCode();
      const { error } = await admin
        .from('student_profiles')
        .update({ referral_code: candidate })
        .eq('id', sp.id);
      if (!error) {
        referralCode = candidate;
      }
      attempts++;
    }
  }

  if (!referralCode) {
    return NextResponse.json({ error: 'Could not generate referral code' }, { status: 500 });
  }

  // Fetch referral stats
  const { data: referrals } = await admin
    .from('referrals')
    .select('status, reward_granted_at')
    .eq('referrer_id', sp.id);

  const pending   = (referrals ?? []).filter(r => r.status === 'pending').length;
  const completed = (referrals ?? []).filter(r => r.status === 'completed').length;
  // 2 bonus stamps per completed referral (referrer earns 2, referred earns 2)
  const stampsEarned = completed * 2;

  // Fetch referred friends display info
  const { data: referralRows } = await admin
    .from('referrals')
    .select(`
      id,
      status,
      reward_granted_at,
      created_at,
      referred:referred_id (
        user:profiles ( first_name, last_name )
      )
    `)
    .eq('referrer_id', sp.id)
    .order('created_at', { ascending: false });

  const friends = (referralRows ?? []).map(r => {
    const u = r.referred?.user ?? null;
    const firstName = u?.first_name ?? 'Student';
    const lastInit  = u?.last_name ? `${u.last_name[0].toUpperCase()}.` : '';
    return {
      display_name:       `${firstName} ${lastInit}`.trim(),
      status:             r.status,
      joined_at:          r.created_at,
      reward_granted_at:  r.reward_granted_at,
    };
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://studeals.vercel.app';

  return NextResponse.json({
    referral_code:   referralCode,
    referral_link:   `${baseUrl}/sign-up/student?ref=${referralCode}`,
    stats: {
      pending,
      completed,
      stamps_earned: stampsEarned,
    },
    friends,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { referral_code?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const code = (body.referral_code ?? '').trim().toUpperCase();
  if (!code || code.length !== 8) {
    return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
  }

  // Get the new student's profile (the one calling this)
  const { data: referred } = await admin
    .from('student_profiles')
    .select('id, referred_by_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!referred) return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });

  // Already linked to a referrer — idempotent, just return success
  if (referred.referred_by_id) {
    return NextResponse.json({ success: true, already_linked: true });
  }

  // Find the referrer by code
  const { data: referrer } = await admin
    .from('student_profiles')
    .select('id, user_id')
    .eq('referral_code', code)
    .maybeSingle();

  if (!referrer) {
    return NextResponse.json({ error: 'Referral code not found' }, { status: 404 });
  }

  // Can't refer yourself
  if (referrer.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot refer yourself' }, { status: 400 });
  }

  // Link the referred student to the referrer
  await admin
    .from('student_profiles')
    .update({ referred_by_id: referrer.id })
    .eq('id', referred.id);

  // Create the referral tracking row
  const { error: refError } = await admin
    .from('referrals')
    .upsert({
      referrer_id: referrer.id,
      referred_id: referred.id,
      status:      'pending',
    }, { onConflict: 'referrer_id,referred_id', ignoreDuplicates: true });

  if (refError) {
    safeLog.error('[referral] Error creating referral row:', refError);
  }

  // Notify the referrer
  await admin.from('notifications').insert({
    user_id: referrer.user_id,
    type:    'referral_joined',
    title:   'Your friend joined Studeals! 🎉',
    body:    'A friend signed up using your referral link. You\'ll earn 2 bonus stamps when they claim their first deal.',
    is_read: false,
  });

  return NextResponse.json({ success: true });
}
