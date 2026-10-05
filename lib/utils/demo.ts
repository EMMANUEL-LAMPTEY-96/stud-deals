// =============================================================================
// lib/utils/demo.ts — server-side helpers for the public demo accounts
//
// profiles.is_demo (migration 020) marks the one-click demo logins. Their
// password is public, so the server — not just the UI — must stop them from
// changing credentials, deleting themselves, uploading ID documents, and
// (for the demo vendor) seeing or messaging real students.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function isDemoUser(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('is_demo').eq('id', userId).maybeSingle();
  return data?.is_demo === true;
}

export function demoForbiddenResponse(action: string) {
  return NextResponse.json(
    { error: `Demo accounts can't ${action}. Sign up for your own account to try this.`, demo: true },
    { status: 403 }
  );
}

/** auth user ids of every demo account (demo student, demo vendor, demo customers). */
export async function getDemoUserIds(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('id').eq('is_demo', true);
  return (data ?? []).map((p) => p.id);
}

/** student_profiles ids belonging to demo accounts. */
export async function getDemoStudentProfileIds(): Promise<string[]> {
  const userIds = await getDemoUserIds();
  if (!userIds.length) return [];
  const admin = createAdminClient();
  const { data } = await admin.from('student_profiles').select('id').in('user_id', userIds);
  return (data ?? []).map((s) => s.id);
}

/** True if the vendor profile belongs to a demo account. */
export async function isDemoVendor(vendorProfileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from('vendor_profiles').select('user_id').eq('id', vendorProfileId).maybeSingle();
  return data ? isDemoUser(data.user_id) : false;
}
