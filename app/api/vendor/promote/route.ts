// =============================================================================
// app/api/vendor/promote/route.ts — Vendor Promotional Notification Sender
//
// POST /api/vendor/promote
// Body: {
//   target: 'all' | 'loyal' | 'lapsed',
//   title: string,
//   message: string,
//   offer_id?: string,  // optional — link to a specific offer
// }
//
// Target groups:
//   all    → every student who has ever stamped with this vendor
//   loyal  → students with ≥ 5 stamps (your best customers)
//   lapsed → students whose last stamp was > 30 days ago
//
// Inserts one row per student into the `notifications` table.
// Returns { sent_to: number } — count of notifications queued.
//
// Auth: vendor must be authenticated + approved
// Rate limit: max 1 campaign per hour (checked via last promo notification)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type TargetGroup = 'all' | 'loyal' | 'lapsed';

interface PromoteBody {
  target: TargetGroup;
  title: string;
  message: string;
  offer_id?: string;
}

const MAX_MESSAGE_LEN = 280;
const MAX_TITLE_LEN = 80;
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour between campaigns

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (_) {}
        },
      },
    }
  );

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Vendor check ──────────────────────────────────────────────────────────
  const { data: vp } = await supabase
    .from('vendor_profiles')
    .select('id, business_name, is_approved')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vp) {
    return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
  }

  if (!vp.is_approved) {
    return NextResponse.json({ error: 'Vendor account not yet approved' }, { status: 403 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: PromoteBody;
  try {
    body = await req.json();
  } catch (_) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { target, title, message, offer_id } = body;

  // Validate
  if (!['all', 'loyal', 'lapsed'].includes(target)) {
    return NextResponse.json({ error: 'target must be all | loyal | lapsed' }, { status: 400 });
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  if (title.trim().length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: `title must be ${MAX_TITLE_LEN} characters or fewer` }, { status: 400 });
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  if (message.trim().length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: `message must be ${MAX_MESSAGE_LEN} characters or fewer` }, { status: 400 });
  }

  // ── Rate limit: check last campaign sent ───────────────────────────────────
  const { data: lastPromo } = await supabase
    .from('notifications')
    .select('created_at')
    .eq('vendor_id', vp.id)
    .eq('type', 'promotion')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastPromo) {
    const msSinceLast = Date.now() - new Date(lastPromo.created_at).getTime();
    if (msSinceLast < RATE_LIMIT_MS) {
      const msLeft = RATE_LIMIT_MS - msSinceLast;
      const minsLeft = Math.ceil(msLeft / 60_000);
      return NextResponse.json(
        {
          error: `You can only send one campaign per hour. Try again in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}.`,
          retry_after: new Date(Date.now() + msLeft).toISOString(),
        },
        { status: 429 }
      );
    }
  }

  // ── Fetch all redemptions for this vendor ──────────────────────────────────
  const { data: redemptions, error: rdError } = await supabase
    .from('redemptions')
    .select('student_profile_id, status, claimed_at')
    .eq('vendor_id', vp.id)
    .in('status', ['stamp', 'reward_earned', 'tier_reward', 'confirmed'])
    .order('claimed_at', { ascending: false });

  if (rdError) {
    console.error('[/api/vendor/promote] Fetch error:', rdError.message);
    return NextResponse.json({ error: 'Failed to load customer data' }, { status: 500 });
  }

  const rows = redemptions ?? [];

  // ── Aggregate per student ──────────────────────────────────────────────────
  const stampMap = new Map<string, { stamps: number; lastVisit: Date }>();

  for (const row of rows) {
    const sid = row.student_profile_id;
    const existing = stampMap.get(sid);
    const visitDate = new Date(row.claimed_at);

    if (!existing) {
      stampMap.set(sid, {
        stamps: row.status === 'stamp' ? 1 : 0,
        lastVisit: visitDate,
      });
    } else {
      if (row.status === 'stamp') existing.stamps += 1;
      if (visitDate > existing.lastVisit) existing.lastVisit = visitDate;
    }
  }

  // ── Apply target filter ────────────────────────────────────────────────────
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const targetStudentIds: string[] = [];

  for (const [sid, agg] of stampMap.entries()) {
    let include = false;

    switch (target) {
      case 'all':
        include = true;
        break;
      case 'loyal':
        include = agg.stamps >= 5;
        break;
      case 'lapsed':
        include = agg.lastVisit < thirtyDaysAgo;
        break;
    }

    if (include) targetStudentIds.push(sid);
  }

  if (targetStudentIds.length === 0) {
    return NextResponse.json({
      sent_to: 0,
      message: 'No students match this target group yet.',
    });
  }

  // ── Look up user_ids from student_profiles ──────────────────────────────────
  const { data: studentProfiles } = await supabase
    .from('student_profiles')
    .select('id, user_id')
    .in('id', targetStudentIds);

  const studentRows = studentProfiles ?? [];

  if (studentRows.length === 0) {
    return NextResponse.json({ sent_to: 0 });
  }

  // ── Build notification rows ─────────────────────────────────────────────────
  const notifRows = studentRows.map((sp) => ({
    user_id: sp.user_id,
    vendor_id: vp.id,
    type: 'promotion' as const,
    title: title.trim(),
    message: message.trim(),
    ...(offer_id ? { offer_id } : {}),
    is_read: false,
  }));

  // ── Insert in batches of 100 ────────────────────────────────────────────────
  const BATCH_SIZE = 100;
  let insertedCount = 0;
  let insertError: string | null = null;

  for (let i = 0; i < notifRows.length; i += BATCH_SIZE) {
    const batch = notifRows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('notifications')
      .insert(batch)
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('[/api/vendor/promote] Insert error:', error.message);
      insertError = error.message;
      break;
    }

    insertedCount += batch.length;
  }

  if (insertError && insertedCount === 0) {
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 });
  }

  return NextResponse.json({
    sent_to: insertedCount,
    target,
    partial: insertError != null,
  });
}
