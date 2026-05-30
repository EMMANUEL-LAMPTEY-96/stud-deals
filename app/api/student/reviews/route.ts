import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { safeLog } from '@/lib/utils/safe-logger';
import { sendEmail } from '@/lib/email/resend';
import { newReviewEmail } from '@/lib/email/templates';

// =============================================================================
// app/api/student/reviews/route.ts
//
// GET  — Returns all vendors the student has confirmed redemptions with,
//         plus any existing review they've written for each vendor.
// POST — Submit (or update) a review for a specific vendor.
//         Only allowed if student has at least 1 confirmed redemption there.
//         One review per student per vendor (upsert on conflict).
// =============================================================================

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    // Get the student_profile id
    const { data: sp } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sp) {
      return NextResponse.json({ vendors: [] });
    }

    // Fetch all vendors this student has had a CONFIRMED redemption with
    const { data: reds } = await admin
      .from('redemptions')
      .select('vendor_id')
      .eq('student_id', sp.id)
      .eq('status', 'confirmed');

    const vendorIds = [...new Set((reds ?? []).map(r => r.vendor_id).filter(Boolean))];

    if (vendorIds.length === 0) {
      return NextResponse.json({ vendors: [] });
    }

    // Fetch vendor details
    const { data: vendors } = await admin
      .from('vendor_profiles')
      .select('id, business_name, logo_url, city, business_type')
      .in('id', vendorIds);

    // Fetch existing reviews by this student for these vendors
    const { data: reviews } = await supabase
      .from('vendor_reviews')
      .select('id, vendor_id, rating, title, body, created_at')
      .eq('student_id', sp.id)
      .in('vendor_id', vendorIds);

    const reviewMap: Record<string, typeof reviews extends (infer T)[] | null ? T : never> = {};
    (reviews ?? []).forEach(r => { reviewMap[r.vendor_id] = r; });

    const result = (vendors ?? []).map(v => ({
      ...v,
      existing_review: reviewMap[v.id] ?? null,
    }));

    return NextResponse.json({ vendors: result });
  } catch (err) {
    safeLog.error('GET /api/student/reviews error', (err as Error).message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: { vendor_id: string; rating: number; title?: string; review?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { vendor_id, rating, title, review } = body;

  // Validate
  if (!vendor_id || typeof vendor_id !== 'string') {
    return NextResponse.json({ error: 'vendor_id required' }, { status: 400 });
  }
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json({ error: 'rating must be 1–5' }, { status: 400 });
  }
  if (review && review.length > 1000) {
    return NextResponse.json({ error: 'Review too long (max 1000 characters)' }, { status: 400 });
  }

  try {
    // Get student profile
    const { data: sp } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sp) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    // Verify student has at least 1 confirmed redemption at this vendor
    const { count } = await admin
      .from('redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', sp.id)
      .eq('vendor_id', vendor_id)
      .eq('status', 'confirmed');

    if (!count || count === 0) {
      return NextResponse.json(
        { error: 'You can only review vendors where you have confirmed redemptions.' },
        { status: 403 }
      );
    }

    // Upsert — one review per student per vendor
    const { data: upserted, error: upsertErr } = await supabase
      .from('vendor_reviews')
      .upsert(
        {
          vendor_id,
          student_id: sp.id,
          rating,
          title: title?.trim() || null,
          body: review?.trim() || null,
          is_visible: true,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'vendor_id,student_id', ignoreDuplicates: false }
      )
      .select('id')
      .maybeSingle();

    if (upsertErr) {
      safeLog.error('review upsert error', upsertErr.message);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    // Notify the vendor — in-app notification + email (both fire-and-forget)
    const { data: vendorRow } = await admin
      .from('vendor_profiles')
      .select('user_id, business_name')
      .eq('id', vendor_id)
      .maybeSingle();

    if (vendorRow?.user_id) {
      // In-app notification
      admin.from('notifications').insert({
        user_id:  vendorRow.user_id,
        type:     'new_review',
        title:    'New student review',
        body:     `A student left a ${rating}★ review.`,
        is_read:  false,
      }).then(() => {});

      // Email notification
      (async () => {
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(vendorRow.user_id);
          const vendorEmail = authUser?.user?.email;
          if (!vendorEmail) return;
          const { subject, html } = newReviewEmail({
            vendorBusinessName: vendorRow.business_name ?? 'your business',
            rating,
            reviewTitle:  title?.trim() || undefined,
            reviewBody:   review?.trim() || undefined,
            submittedAt:  new Date().toISOString(),
          });
          await sendEmail({ to: vendorEmail, subject, html });
        } catch {
          // Email is non-critical
        }
      })();
    }

    safeLog.audit('review_submitted', { vendorId: vendor_id, rating });

    return NextResponse.json({ success: true });
  } catch (err) {
    safeLog.error('POST /api/student/reviews error', (err as Error).message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}