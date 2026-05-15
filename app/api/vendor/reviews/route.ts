// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
// app/api/vendor/reviews/route.ts
// GET  /api/vendor/reviews        - fetch all reviews for the signed-in vendor
// PATCH /api/vendor/reviews       - vendor adds/updates a reply

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { validationErrorResponse } from '@/lib/utils/validation';

const ReviewReplySchema = z.object({
  reviewId: z.string().uuid({ message: 'reviewId must be a valid UUID.' }),
  reply: z.string().min(1, 'Reply cannot be empty.').max(1000, 'Reply must be 1000 characters or fewer.'),
});

export async function GET() {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
          return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!vendor) {
          return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
        }

    const { data: reviews, error } = await supabase
      .from('vendor_reviews')
      .select(`
                    id, rating, title, body,
                    vendor_reply, vendor_replied_at,
                    is_visible, created_at,
                    student_profiles ( id, full_name, avatar_url )
                  `)
      .eq('vendor_id', vendor.id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

    const total = reviews?.length ?? 0;
    const avg = total
      ? reviews!.reduce((s, r) => s + r.rating, 0) / total
      : 0;

    return NextResponse.json({ reviews: reviews ?? [], total, average: avg });
  }

export async function PATCH(req: NextRequest) {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
          return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch (_) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const parsedBody = ReviewReplySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return validationErrorResponse(parsedBody.error);
    }

    const { reviewId, reply } = parsedBody.data;

    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!vendor) {
          return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
        }

    const { error } = await supabase
      .from('vendor_reviews')
      .update({
              vendor_reply: reply.trim(),
              vendor_replied_at: new Date().toISOString(),
            })
      .eq('id', reviewId)
      .eq('vendor_id', vendor.id);

    if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

    return NextResponse.json({ success: true });
  }
