// =============================================================================
// lib/utils/verification.ts
// Verification utility functions — runs on the server only.
//
// Two verification paths exist:
//   PATH A: .edu Email (automated, instant)
//     Student provides .edu email → domain extracted → matched against
//     institutions.email_domains[] → if match, send OTP/magic link → confirmed.
//
//   PATH B: Student ID Upload (manual, 24–48hr turnaround)
//     Student uploads photo of their student ID → stored in Supabase Storage →
//     admin reviews → approves/rejects → student notified.
//
// The strategy: offer Path A first. If email domain is not in our institutions
// table yet, gracefully fall back to Path B.
// =============================================================================

import type { Institution, VerificationMethod, VerificationStatus } from '@/lib/types/database.types';

// ---------------------------------------------------------------------------
// DOMAIN EXTRACTION & VALIDATION
// ---------------------------------------------------------------------------

/**
 * Extracts the domain from an email address.
 * e.g., "emma.jones@student.umich.edu" → "student.umich.edu"
 *
 * Returns null if the email is malformed.
 */
export function extractEmailDomain(email: string): string | null {
  const match = email.trim().toLowerCase().match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1] : null;
}

/**
 * Determines whether a domain matches an institution's allowed domains.
 * Supports exact match and subdomain matching.
 *
 * Examples:
 *   email: "joe@grad.umich.edu"
 *   institutionDomains: ["umich.edu", "student.umich.edu"]
 *   → matches "umich.edu" as a parent domain → true
 */
export function domainMatchesInstitution(
  emailDomain: string,
  institutionDomains: string[]
): boolean {
  const normalised = emailDomain.toLowerCase();

  return institutionDomains.some((allowed) => {
    const allowedNorm = allowed.toLowerCase();
    // Exact match
    if (normalised === allowedNorm) return true;
    // Subdomain match: "grad.umich.edu" ends with ".umich.edu"
    if (normalised.endsWith('.' + allowedNorm)) return true;
    return false;
  });
}

/**
 * Checks if an email address looks like an educational institution email.
 * This is a FAST client-side pre-check BEFORE hitting the database.
 * Not a security gate — the real check is `findInstitutionByEmail` below.
 *
 * Returns true for common .edu TLDs and international equivalents.
 */
export function looksLikeEduEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;

  // Common educational TLDs and patterns
  const EDU_PATTERNS = [
    /\.edu$/i,           // US: .edu
    /\.ac\.uk$/i,        // UK: university.ac.uk
    /\.edu\.au$/i,       // Australia
    /\.ac\.nz$/i,        // New Zealand
    /\.edu\.sg$/i,       // Singapore
    /\.ac\.za$/i,        // South Africa
    /\.edu\.gh$/i,       // Ghana
    /\.edu\.ng$/i,       // Nigeria
  ];

  return EDU_PATTERNS.some((pattern) => pattern.test(domain));
}

// ---------------------------------------------------------------------------
// VERIFICATION LOGIC HELPERS
// ---------------------------------------------------------------------------

/**
 * Determines the recommended verification path for a given email.
 * Called after `findInstitutionByEmail` to decide the UX flow.
 */
export function determineVerificationPath(
  email: string,
  matchedInstitution: Institution | null
): {
  path: 'edu_email' | 'id_upload' | 'not_eligible';
  reason: string;
} {
  if (matchedInstitution) {
    return {
      path: 'edu_email',
      reason: `We recognise ${matchedInstitution.name}. We'll send a verification link to ${email}.`,
    };
  }

  if (looksLikeEduEmail(email)) {
    return {
      path: 'id_upload',
      reason:
        "Your university isn't in our network yet, but you can verify instantly by uploading your student ID card.",
    };
  }

  return {
    path: 'not_eligible',
    reason:
      "Please use your university-issued email address (e.g., yourname@university.edu) to verify your student status.",
  };
}

/**
 * Computes the verification expiry date.
 * Strategy: expire at the end of the academic year in which the student graduates.
 * If graduation year is unknown, expire in 12 months.
 */
export function computeVerificationExpiry(graduationYear: number | null): Date {
  const now = new Date();

  if (graduationYear) {
    // Expire July 31 of graduation year (after spring commencement)
    const expiry = new Date(`${graduationYear}-07-31T23:59:59Z`);
    // If that date is in the past (student is overdue), expire immediately
    if (expiry <= now) {
      return new Date(now.getTime() + 1000 * 60); // 1 minute — forces re-verify
    }
    return expiry;
  }

  // Default: 12 months from now (require annual re-verification)
  return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
}

/**
 * Returns a human-readable label for each verification status.
 * Used in UI badges and notification copy.
 */
export function getVerificationStatusLabel(status: VerificationStatus): {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
  description: string;
} {
  const map: Record<
    VerificationStatus,
    { label: string; color: 'green' | 'yellow' | 'red' | 'gray'; description: string }
  > = {
    unverified: {
      label: 'Not Verified',
      color: 'gray',
      description: 'Verify your student status to unlock exclusive discounts.',
    },
    pending_email: {
      label: 'Check Your Email',
      color: 'yellow',
      description: "We've sent a verification link to your university email. Click it to confirm.",
    },
    pending_review: {
      label: 'Under Review',
      color: 'yellow',
      description: 'Your student ID is being reviewed. This usually takes under 24 hours.',
    },
    verified: {
      label: 'Verified Student',
      color: 'green',
      description: "You're verified! Enjoy exclusive student discounts.",
    },
    rejected: {
      label: 'Verification Failed',
      color: 'red',
      description:
        "We couldn't verify your student status. Please re-upload a clearer ID or use your .edu email.",
    },
    expired: {
      label: 'Re-verification Needed',
      color: 'yellow',
      description: 'Your verification has expired. Please re-verify to continue accessing discounts.',
    },
  };

  return map[status];
}

// ---------------------------------------------------------------------------
// STORAGE PATH HELPERS
// ---------------------------------------------------------------------------

/**
 * Generates the Supabase Storage path for a student ID upload.
 * Path is scoped to the user ID — RLS on the storage bucket ensures
 * only admins and the student themselves can access the file.
 *
 * Pattern: verification-docs/{user_id}/{timestamp}-student-id.{ext}
 */
export function generateVerificationDocumentPath(
  userId: string,
  fileExtension: string
): string {
  const timestamp = Date.now();
  const safeExt = fileExtension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `verification-docs/${userId}/${timestamp}-student-id.${safeExt}`;
}

/**
 * Returns accepted MIME types and max file size for student ID uploads.
 */
export const VERIFICATION_UPLOAD_CONFIG = {
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
  acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf'],
  maxFileSizeBytes: 5 * 1024 * 1024,   // 5MB
  maxFileSizeMB: 5,
} as const;

/**
 * Validates a file before uploading it as a student ID document.
 * Returns an error message string or null if valid.
 */
export function validateVerificationDocument(file: File): string | null {
  if (!VERIFICATION_UPLOAD_CONFIG.acceptedMimeTypes.includes(file.type as never)) {
    return 'Please upload a JPG, PNG, WebP, HEIC, or PDF file.';
  }
  if (file.size > VERIFICATION_UPLOAD_CONFIG.maxFileSizeBytes) {
    return `File is too large. Maximum size is ${VERIFICATION_UPLOAD_CONFIG.maxFileSizeMB}MB.`;
  }
  return null;
}
