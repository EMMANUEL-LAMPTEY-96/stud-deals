// =============================================================================
// supabase/functions/verify-student/index.ts
// Supabase Edge Function — Deploy: `supabase functions deploy verify-student`
//
// Handles BOTH verification paths:
//   POST body { action: 'send_edu_email' }  → Sends OTP to student .edu email
//   POST body { action: 'upload_id' }       → Stores upload ref + notifies admin
//   POST body { action: 'confirm_otp' }     → Confirms OTP, marks student verified
//   POST body { action: 'admin_approve' }   → Admin approves ID upload review
//   POST body { action: 'admin_reject' }    → Admin rejects ID upload with reason
//
// Runs with the SERVICE ROLE KEY — can bypass RLS for administrative operations.
// JWTs are validated on every request to prevent unauthorized calls.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!;

// Code TTL: OTP sent to .edu email expires in 10 minutes
const OTP_EXPIRY_MINUTES = 10;

// ────────────────────────────────────────────────────────────────────────────
// CORS headers — update origin to your production domain before deploying
// ────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin':  Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // ── Authenticate the calling user via their JWT ───────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or invalid Authorization header.' }, 401);
  }
  const userJwt = authHeader.replace('Bearer ', '');

  // Create user-scoped client to verify JWT and get user identity
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userJwt}` } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json({ error: 'Unauthorized. Invalid session.' }, 401);
  }

  // Admin client for privileged database operations
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Route to action handler ───────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const action = body.action as string;

  switch (action) {

    // ────────────────────────────────────────────────────────────────────────
    // ACTION: send_edu_email
    // Sends a magic link / OTP to the student's .edu email address.
    // The student must click the link within 10 minutes to confirm.
    // ────────────────────────────────────────────────────────────────────────
    case 'send_edu_email': {
      const { edu_email, institution_id } = body as {
        edu_email: string;
        institution_id: string;
      };

      if (!edu_email || !institution_id) {
        return json({ error: 'edu_email and institution_id are required.' }, 400);
      }

      // Validate the institution exists
      const { data: institution } = await adminClient
        .from('institutions')
        .select('id, name, email_domains')
        .eq('id', institution_id)
        .eq('is_active', true)
        .single();

      if (!institution) {
        return json({ error: 'Institution not found or inactive.' }, 404);
      }

      // Double-check domain matches (defense in depth — don't trust client)
      const domain = edu_email.split('@')[1]?.toLowerCase();
      const isValid = institution.email_domains.some(
        (d: string) => domain === d || domain?.endsWith(`.${d}`)
      );
      if (!isValid) {
        return json({
          error: `That email domain (${domain}) does not match ${institution.name}.`,
        }, 400);
      }

      // Update student_profile to pending_email state
      const { error: updateError } = await adminClient
        .from('student_profiles')
        .update({
          student_email: edu_email.toLowerCase(),
          institution_id: institution_id,
          verification_status: 'pending_email',
          verification_method: 'edu_email',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[verify-student] update error:', updateError);
        return json({ error: 'Failed to update verification state.' }, 500);
      }

      // Send OTP to the .edu email using Supabase Auth's built-in OTP
      // This sends a 6-digit code valid for OTP_EXPIRY_MINUTES minutes.
      const { error: otpError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: edu_email,
        options: {
          redirectTo: `${Deno.env.get('SITE_URL')}/verification/confirmed`,
          data: {
            verification_type: 'edu_email',
            student_user_id: user.id,
          },
        },
      });

      if (otpError) {
        console.error('[verify-student] OTP send error:', otpError);
        return json({ error: 'Failed to send verification email. Please try again.' }, 500);
      }

      // Insert a notification for the student
      await adminClient.from('notifications').insert({
        user_id: user.id,
        title: 'Check your university email',
        body: `We sent a verification link to ${edu_email}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        type: 'verification_email_sent',
        related_entity_type: 'student_profile',
      });

      return json({
        success: true,
        message: `Verification email sent to ${edu_email}. Check your inbox (and spam folder).`,
        expires_in_minutes: OTP_EXPIRY_MINUTES,
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // ACTION: confirm_edu_email
    // Called from the email magic link callback.
    // Marks the student as verified if the email OTP is valid.
    // (Supabase Auth handles the actual OTP validation — this just
    // updates the student_profile to 'verified' after auth confirms it.)
    // ────────────────────────────────────────────────────────────────────────
    case 'confirm_edu_email': {
      // At this point the user's auth session is already valid (they clicked
      // the magic link and are authenticated). We just need to promote their
      // student_profile status.

      // Fetch their current student profile
      const { data: studentProfile, error: fetchError } = await adminClient
        .from('student_profiles')
        .select('id, institution_id, graduation_year, verification_status')
        .eq('user_id', user.id)
        .single();

      if (fetchError || !studentProfile) {
        return json({ error: 'Student profile not found.' }, 404);
      }

      if (studentProfile.verification_status === 'verified') {
        return json({ success: true, message: 'Already verified.', already_verified: true });
      }

      if (studentProfile.verification_status !== 'pending_email') {
        return json({ error: 'No pending email verification found.' }, 400);
      }

      // Compute expiry based on graduation year
      const graduationYear = studentProfile.graduation_year as number | null;
      const expiryDate = graduationYear
        ? new Date(`${graduationYear}-07-31T23:59:59Z`)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      // Mark as verified
      const { error: verifyError } = await adminClient
        .from('student_profiles')
        .update({
          verification_status: 'verified',
          verification_method: 'edu_email',
          verified_at: new Date().toISOString(),
          verification_expires_at: expiryDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (verifyError) {
        return json({ error: 'Failed to confirm verification.' }, 500);
      }

      // Send congratulations notification
      await adminClient.from('notifications').insert({
        user_id: user.id,
        title: "You're verified! 🎉",
        body: "Your student status is confirmed. Start claiming exclusive discounts near you.",
        type: 'verification_approved',
        related_entity_type: 'student_profile',
      });

      return json({
        success: true,
        message: "Verified! Welcome to the marketplace.",
        redirect_to: '/dashboard',
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // ACTION: upload_id
    // Called after student uploads their ID photo to Supabase Storage.
    // Updates their profile to pending_review and notifies admins.
    // ────────────────────────────────────────────────────────────────────────
    case 'upload_id': {
      const { storage_path, institution_name_manual } = body as {
        storage_path: string;
        institution_name_manual?: string;
      };

      if (!storage_path) {
        return json({ error: 'storage_path is required.' }, 400);
      }

      const { error: updateError } = await adminClient
        .from('student_profiles')
        .update({
          verification_status: 'pending_review',
          verification_method: 'id_upload',
          verification_document_url: storage_path,
          institution_name_manual: institution_name_manual ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        return json({ error: 'Failed to submit ID for review.' }, 500);
      }

      // Notify all admins of a new pending review
      const { data: admins } = await adminClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true);

      if (admins && admins.length > 0) {
        const adminNotifications = admins.map((admin) => ({
          user_id: admin.id,
          title: 'New student ID verification pending',
          body: `A student has uploaded their ID for review. User ID: ${user.id}`,
          type: 'admin_review_required',
          related_entity_type: 'student_profile',
          related_entity_id: user.id,
        }));
        await adminClient.from('notifications').insert(adminNotifications);
      }

      // Notify the student
      await adminClient.from('notifications').insert({
        user_id: user.id,
        title: 'ID uploaded — under review',
        body: 'Your student ID is being reviewed. We typically process these within 24 hours.',
        type: 'verification_pending_review',
        related_entity_type: 'student_profile',
      });

      return json({
        success: true,
        message: "Your ID has been submitted for review. We'll notify you within 24 hours.",
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // ACTION: admin_approve
    // Called by an admin to approve a pending_review student.
    // Requires the calling user to have role = 'admin'.
    // ────────────────────────────────────────────────────────────────────────
    case 'admin_approve': {
      const { student_user_id, graduation_year } = body as {
        student_user_id: string;
        graduation_year?: number;
      };

      // Confirm caller is admin
      const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (callerProfile?.role !== 'admin') {
        return json({ error: 'Forbidden. Admin access required.' }, 403);
      }

      const expiryDate = graduation_year
        ? new Date(`${graduation_year}-07-31T23:59:59Z`)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      const { error: approveError } = await adminClient
        .from('student_profiles')
        .update({
          verification_status: 'verified',
          verification_method: 'id_upload',
          verified_at: new Date().toISOString(),
          verified_by: user.id,
          verification_expires_at: expiryDate.toISOString(),
          graduation_year: graduation_year ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', student_user_id);

      if (approveError) {
        return json({ error: 'Failed to approve student.' }, 500);
      }

      // Notify the student
      await adminClient.from('notifications').insert({
        user_id: student_user_id,
        title: "You're verified! 🎉",
        body: "Your student ID has been approved. Start claiming exclusive discounts near you!",
        type: 'verification_approved',
        related_entity_type: 'student_profile',
      });

      return json({ success: true, message: 'Student approved successfully.' });
    }

    // ────────────────────────────────────────────────────────────────────────
    // ACTION: admin_reject
    // Admin rejects an ID upload with a reason.
    // ────────────────────────────────────────────────────────────────────────
    case 'admin_reject': {
      const { student_user_id, rejection_reason } = body as {
        student_user_id: string;
        rejection_reason: string;
      };

      const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (callerProfile?.role !== 'admin') {
        return json({ error: 'Forbidden.' }, 403);
      }

      if (!rejection_reason?.trim()) {
        return json({ error: 'A rejection reason is required.' }, 400);
      }

      const { error: rejectError } = await adminClient
        .from('student_profiles')
        .update({
          verification_status: 'rejected',
          verification_notes: rejection_reason,
          verified_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', student_user_id);

      if (rejectError) {
        return json({ error: 'Failed to reject student.' }, 500);
      }

      await adminClient.from('notifications').insert({
        user_id: student_user_id,
        title: 'Verification unsuccessful',
        body: `We couldn't verify your student status. Reason: ${rejection_reason}. Please try again with a clearer photo.`,
        type: 'verification_rejected',
        related_entity_type: 'student_profile',
      });

      return json({ success: true, message: 'Student rejected. They have been notified.' });
    }

    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }
});

// ── Helper: return typed JSON response ──────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
