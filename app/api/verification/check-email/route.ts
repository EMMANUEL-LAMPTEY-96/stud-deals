// =============================================================================
// app/api/verification/check-email/route.ts
// POST /api/verification/check-email
//
// Step 1 of the .edu verification flow.
// Called as the student types their university email on the signup form.
// Returns whether the domain is recognised and which institution it maps to.
//
// This is NOT the confirmation step — it just tells the frontend whether
// to show "Great, we know your university!" or "Please upload your ID instead."
//
// Rate limited: 10 requests per minute per IP (enforced in Supabase Edge Config).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  extractEmailDomain,
  looksLikeEduEmail,
  domainMatchesInstitution,
  determineVerificationPath,
} from '@/lib/utils/verification';
import type { VerifyEduEmailRequest, VerifyEduEmailResponse } from '@/lib/types/database.types';

export async function POST(request: NextRequest) {
  try {
    const body: VerifyEduEmailRequest = await request.json();
    const { email } = body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { is_valid_edu_email: false, institution: null, message: 'Email is required.' },
        { status: 400 }
      );
    }

    const normalised = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalised)) {
      return NextResponse.json(
        { is_valid_edu_email: false, institution: null, message: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // ── Extract domain ────────────────────────────────────────────────────
    const domain = extractEmailDomain(normalised);
    if (!domain) {
      return NextResponse.json(
        { is_valid_edu_email: false, institution: null, message: 'Could not read email domain.' },
        { status: 400 }
      );
    }

    // ── Quick pre-filter: does this even look educational? ────────────────
    if (!looksLikeEduEmail(normalised)) {
      return NextResponse.json<VerifyEduEmailResponse>({
        is_valid_edu_email: false,
        institution: null,
        message:
          'Please use your official university email address (e.g., you@university.edu) to verify.',
      });
    }

    // ── Query institutions table ──────────────────────────────────────────
    // We fetch ALL active institutions and check domain client-side.
    // This avoids a complex PostgreSQL array query and keeps it fast
    // since the institutions table will only ever have ~5,000 rows max.
    const supabase = await createClient();

    const { data: institutions, error } = await supabase
      .from('institutions')
      .select('id, name, short_name, logo_url, email_domains')
      .eq('is_active', true);

    if (error) {
      console.error('[check-email] DB error fetching institutions:', error);
      return NextResponse.json(
        { is_valid_edu_email: false, institution: null, message: 'Server error. Please try again.' },
        { status: 500 }
      );
    }

    // ── Find matching institution ─────────────────────────────────────────
    const matchedInstitution = (institutions ?? []).find((inst) =>
      domainMatchesInstitution(domain, inst.email_domains)
    ) ?? null;

    // ── Determine the recommended verification path ───────────────────────
    const { path, reason } = determineVerificationPath(normalised, matchedInstitution as never);

    if (path === 'not_eligible') {
      return NextResponse.json<VerifyEduEmailResponse>({
        is_valid_edu_email: false,
        institution: null,
        message: reason,
      });
    }

    return NextResponse.json<VerifyEduEmailResponse>({
      is_valid_edu_email: true,
      institution: matchedInstitution
        ? {
            id: matchedInstitution.id,
            name: matchedInstitution.name,
            short_name: matchedInstitution.short_name,
            logo_url: matchedInstitution.logo_url,
          }
        : null,
      message: reason,
    });
  } catch (err) {
    console.error('[check-email] Unexpected error:', err);
    return NextResponse.json(
      { is_valid_edu_email: false, institution: null, message: 'Unexpected server error.' },
      { status: 500 }
    );
  }
}
