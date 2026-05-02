// =============================================================================
// supabase/functions/confirm-redemption/index.ts
// Supabase Edge Function — Deploy: `supabase functions deploy confirm-redemption`
//
// ALTERNATIVE to app/api/redemptions/confirm/route.ts for vendors who want to
// use the Supabase SDK directly from a native mobile POS app (if you build one).
//
// This Edge Function is also the recommended path if you ever add a
// physical POS device (tablet at the coffee counter) — the device can call
// this endpoint with its vendor API key.
//
// The logic mirrors the Next.js route but runs at the edge (Deno runtime)
// and has lower latency for international deployments.
//
// ALSO handles the vendor QR camera scan flow:
//   The vendor's phone camera reads the QR → app posts the payload here →
//   Edge Function validates + confirms → returns result in <100ms.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin':  Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header.' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Role check ────────────────────────────────────────────────────────────
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'vendor') {
    return json({ error: 'Vendor role required.' }, 403);
  }

  const { data: vendorProfile } = await adminClient
    .from('vendor_profiles')
    .select('id, is_verified')
    .eq('user_id', user.id)
    .single();

  if (!vendorProfile?.is_verified) {
    return json({ error: 'Vendor account not yet verified.' }, 403);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { redemption_code: string; estimated_transaction_value?: number };
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const { redemption_code, estimated_transaction_value } = body;
  if (!redemption_code) {
    return json({ error: 'redemption_code is required.' }, 400);
  }

  // Handle QR JSON payload
  let code = redemption_code;
  if (code.startsWith('{')) {
    try {
      const parsed = JSON.parse(code);
      if (parsed?.c) code = parsed.c;
    } catch (_) {
      return json({ error: 'Invalid QR payload.' }, 400);
    }
  }

  // Normalise the code
  const normCode = code.trim().toUpperCase();

  // ── Fetch redemption ──────────────────────────────────────────────────────
  const { data: redemption, error: fetchErr } = await adminClient
    .from('redemptions')
    .select(`
      id, status, expires_at, vendor_id, offer_id,
      offer:offers (title, discount_label),
      student:student_profiles (
        user:profiles (first_name, last_name)
      )
    `)
    .eq('redemption_code', normCode)
    .maybeSingle();

  if (fetchErr || !redemption) {
    return json({ error: 'Code not found.' }, 404);
  }

  // Anti-fraud: must belong to this vendor
  if (redemption.vendor_id !== vendorProfile.id) {
    return json({ error: 'Code not issued for your business.' }, 403);
  }

  // Status checks
  if (redemption.status !== 'claimed') {
    const msgs: Record<string, string> = {
      confirmed: 'Code already used.',
      expired:   'Code has expired.',
      cancelled: 'Code was cancelled.',
    };
    return json({ error: msgs[redemption.status] ?? 'Invalid code state.', status: redemption.status }, 409);
  }

  if (new Date(redemption.expires_at) < new Date()) {
    await adminClient
      .from('redemptions')
      .update({ status: 'expired' })
      .eq('id', redemption.id);
    return json({ error: 'Code expired.' }, 409);
  }

  // ── CONFIRM ───────────────────────────────────────────────────────────────
  const confirmedAt = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    status: 'confirmed',
    confirmed_at: confirmedAt,
    confirmed_by_vendor_user_id: user.id,
  };

  // If vendor optionally provided the transaction value (for ARPU tracking)
  if (estimated_transaction_value && typeof estimated_transaction_value === 'number') {
    updatePayload.estimated_transaction_value = estimated_transaction_value;
  }

  const { error: confirmErr } = await adminClient
    .from('redemptions')
    .update(updatePayload)
    .eq('id', redemption.id)
    .eq('status', 'claimed');

  if (confirmErr) {
    console.error('[confirm-redemption] update error:', confirmErr);
    return json({ error: 'Failed to confirm. Please retry.' }, 500);
  }

  // Build display name
  const studentUser = (redemption.student as { user: { first_name: string | null; last_name: string | null } | null } | null)?.user;
  const displayName = [
    studentUser?.first_name ?? 'Student',
    studentUser?.last_name ? `${studentUser.last_name[0]}.` : '',
  ].join(' ').trim();

  const offerData = redemption.offer as { title: string; discount_label: string } | null;

  return json({
    success: true,
    redemption_id: redemption.id,
    student_display_name: displayName,
    offer_title: offerData?.title ?? 'Discount',
    discount_label: offerData?.discount_label ?? '',
    confirmed_at: confirmedAt,
    message: `✓ Accepted! Apply ${offerData?.discount_label ?? 'discount'} for ${displayName}.`,
  });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
