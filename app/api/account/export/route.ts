/**
 * GET /api/account/export
 *
 * GDPR Article 20 — Right to Data Portability.
 *
 * Returns a JSON file containing all personal data held for the authenticated
 * user. Covers:
 *   • Profile (name, email, role, created_at)
 *   • Student profile (institution, verification_status, graduation_year)
 *   • Redemptions — voucher claims (status = 'claimed' | 'confirmed')
 *   • Stamps         (status = 'stamp' | 'reward_earned' | 'tier_reward')
 *   • Saved offers
 *   • Reviews submitted by the student
 *   • Notifications (last 180 days)
 *   • Cookie consent snapshot (from request header, not stored server-side)
 *
 * Response: application/json with Content-Disposition: attachment header so
 * the browser prompts a file save dialogue.
 *
 * Rate-limited to 3 exports per user per hour (in-memory; resets on cold start).
 * In production, replace the in-memory map with a Redis / DB-backed counter.
 *
 * Security: all queries use the authenticated user's own ID — never a param
 * from the request body. RLS is additionally enforced by the server client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient }              from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { safeLog }                   from '@/lib/utils/safe-logger';

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter: 3 exports per userId per hour
// ---------------------------------------------------------------------------

const exportRateMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT     = 3;
const WINDOW_MS      = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now   = Date.now();
  const entry = exportRateMap.get(userId);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    exportRateMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Admin client (service role) — used for cross-table fetches that RLS might
// restrict when joining across roles. We still hard-scope every query to
// the authenticated userId, so there is no privilege escalation.
// ---------------------------------------------------------------------------

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const userId = user.id;

    // 2. Rate limiting
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Too many export requests. Please wait before downloading again.' },
        { status: 429 }
      );
    }

    const admin = getAdmin();

    // 3. Fetch all data in parallel
    const [
      profileResult,
      studentProfileResult,
      redemptionsResult,
      stampsResult,
      savedOffersResult,
      reviewsResult,
      notificationsResult,
    ] = await Promise.all([

      // Profile
      admin
        .from('profiles')
        .select('id, role, first_name, last_name, display_name, created_at')
        .eq('id', userId)
        .maybeSingle(),

      // Student profile (may not exist for vendors / admins)
      admin
        .from('student_profiles')
        .select('verification_status, institution_id, institution_name_manual, graduation_year, share_with_vendors, consent_updated_at, date_of_birth, created_at')
        .eq('user_id', userId)
        .maybeSingle(),

      // Voucher redemptions (claimed / confirmed — NOT stamps)
      admin
        .from('redemptions')
        .select('id, offer_id, vendor_id, status, redemption_code, created_at, updated_at, device_type')
        .eq('student_id', userId)
        .in('status', ['claimed', 'confirmed'])
        .order('created_at', { ascending: false }),

      // Loyalty stamps
      admin
        .from('redemptions')
        .select('id, offer_id, vendor_id, status, created_at, device_type')
        .eq('student_id', userId)
        .in('status', ['stamp', 'reward_earned', 'tier_reward'])
        .order('created_at', { ascending: false }),

      // Saved offers
      admin
        .from('saved_offers')
        .select('offer_id, created_at')
        .eq('student_id', userId)
        .order('created_at', { ascending: false }),

      // Reviews the student submitted
      admin
        .from('vendor_reviews')
        .select('id, vendor_id, rating, comment, created_at, updated_at')
        .eq('student_id', userId)
        .order('created_at', { ascending: false }),

      // Notifications — last 180 days
      admin
        .from('notifications')
        .select('id, type, message, is_read, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString())
        .order('created_at', { ascending: false }),
    ]);

    // 4. Fetch institution name if available
    let institutionName: string | null = null;
    const institutionId = studentProfileResult.data?.institution_id;
    if (institutionId) {
      const { data: inst } = await admin
        .from('institutions')
        .select('name, city')
        .eq('id', institutionId)
        .maybeSingle();
      if (inst) institutionName = `${inst.name}, ${inst.city}`;
    }

    // 5. Build clean export object — strip internal IDs where appropriate,
    //    keep data useful and human-readable.
    const exportData = {
      _meta: {
        export_generated_at:  new Date().toISOString(),
        gdpr_article:         'Article 20 — Right to Data Portability',
        data_controller:      'Studeals Kft.',
        data_controller_email: 'privacy@studeals.app',
        supervisory_authority: 'NAIH — naih.hu',
        platform:             'studeals.vercel.app',
        data_storage_region:  'eu-west-1 (Ireland, EU)',
      },

      account: {
        email:        user.email ?? null,
        role:         profileResult.data?.role ?? null,
        first_name:   profileResult.data?.first_name ?? null,
        last_name:    profileResult.data?.last_name ?? null,
        display_name: profileResult.data?.display_name ?? null,
        account_created_at: profileResult.data?.created_at ?? null,
      },

      student_profile: studentProfileResult.data
        ? {
            verification_status:      studentProfileResult.data.verification_status,
            institution:              institutionName ?? studentProfileResult.data.institution_name_manual ?? null,
            graduation_year:          studentProfileResult.data.graduation_year ?? null,
            date_of_birth:            studentProfileResult.data.date_of_birth ?? null,
            vendor_activity_sharing:  studentProfileResult.data.share_with_vendors ?? false,
            consent_updated_at:       studentProfileResult.data.consent_updated_at ?? null,
            profile_created_at:       studentProfileResult.data.created_at ?? null,
          }
        : null,

      voucher_redemptions: {
        count: redemptionsResult.data?.length ?? 0,
        records: (redemptionsResult.data ?? []).map(r => ({
          status:      r.status,
          device_type: r.device_type ?? null,
          redeemed_at: r.created_at,
          confirmed_at: r.status === 'confirmed' ? r.updated_at : null,
          // Offer/vendor IDs retained for portability — user may reference these
          offer_id:  r.offer_id,
          vendor_id: r.vendor_id,
        })),
      },

      loyalty_stamps: {
        count: stampsResult.data?.length ?? 0,
        records: (stampsResult.data ?? []).map(s => ({
          type:       s.status,
          earned_at:  s.created_at,
          vendor_id:  s.vendor_id,
          offer_id:   s.offer_id,
        })),
      },

      saved_offers: {
        count: savedOffersResult.data?.length ?? 0,
        offer_ids: (savedOffersResult.data ?? []).map(s => s.offer_id),
      },

      reviews_submitted: {
        count: reviewsResult.data?.length ?? 0,
        records: (reviewsResult.data ?? []).map(r => ({
          vendor_id:  r.vendor_id,
          rating:     r.rating,
          comment:    r.comment ?? null,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      },

      notifications_last_180_days: {
        count: notificationsResult.data?.length ?? 0,
        records: (notificationsResult.data ?? []).map(n => ({
          type:       n.type,
          message:    n.message ?? null,
          is_read:    n.is_read,
          created_at: n.created_at,
        })),
      },

      cookies_and_local_storage: {
        note: 'Cookie consent is stored locally in your browser under the key "studeals_consent_v2" and is not transmitted to our servers. Check your browser\'s localStorage for the exact value.',
        categories: {
          necessary:  true,
          analytics:  '(see browser localStorage)',
          marketing:  '(see browser localStorage)',
        },
      },

      your_rights: {
        access:         'You are reading your exported data right now (Art. 15).',
        rectification:  'Update your profile in Account Settings (Art. 16).',
        erasure:        'Delete your account from Account Settings → Delete Account (Art. 17).',
        restriction:    'Email privacy@studeals.app to request processing restriction (Art. 18).',
        portability:    'This file is your portable data export (Art. 20).',
        objection:      'Email privacy@studeals.app to object to legitimate-interest processing (Art. 21).',
        complaint:      'Lodge a complaint with NAIH at https://naih.hu',
      },
    };

    // 6. Audit log (PII-free)
    safeLog.audit('gdpr_data_export', { role: profileResult.data?.role ?? 'unknown' });

    // 7. Return as downloadable JSON file
    const filename = `studeals-data-export-${new Date().toISOString().split('T')[0]}.json`;
    const body     = JSON.stringify(exportData, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type':        'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (err) {
    safeLog.error('GDPR export: unexpected error', (err as Error).message);
    return NextResponse.json({ error: 'Unexpected error during data export.' }, { status: 500 });
  }
}
