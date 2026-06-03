import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// POST /api/offers/[id]/save   — toggle save/unsave (bookmark) on an offer
// Returns: { saved: boolean }
// =============================================================================

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: offerId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { data: sp } = await supabase
    .from('student_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sp) return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });

  // Toggle: check if already saved
  const { data: existing } = await supabase
    .from('saved_offers')
    .select('id')
    .eq('student_id', sp.id)
    .eq('offer_id', offerId)
    .maybeSingle();

  if (existing) {
    await supabase.from('saved_offers').delete().eq('id', existing.id);
    return NextResponse.json({ saved: false });
  }

  await supabase.from('saved_offers').insert({ student_id: sp.id, offer_id: offerId });
  return NextResponse.json({ saved: true });
}
