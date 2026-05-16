// =============================================================================
// lib/email/resend.ts
//
// Thin wrapper around the Resend SDK.
//
// All email sending in the codebase goes through `sendEmail()`.
// If RESEND_API_KEY is not set (local dev without a key), the call is a no-op
// so that every other feature keeps working without email configured.
//
// Required env var:  RESEND_API_KEY
// Optional env var:  RESEND_FROM_EMAIL  (default: onboarding@resend.dev)
//                    RESEND_FROM_NAME   (default: Unideals)
// =============================================================================

import { Resend } from 'resend';

// Lazily instantiated — avoids throwing at import time if key is missing
let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send a transactional email via Resend.
 * Fire-and-forget safe — always resolves, never throws.
 * Returns `true` if the email was sent, `false` if skipped or errored.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    // Key not configured — silently skip in local dev
    if (process.env.NODE_ENV !== 'production') {
      console.log('[email] RESEND_API_KEY not set — skipping email to', opts.to);
    }
    return false;
  }

  const from = `${process.env.RESEND_FROM_NAME ?? 'Unideals'} <${process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'}>`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });

    if (error) {
      console.error('[email] Resend error:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] Unexpected error sending email:', (err as Error).message);
    return false;
  }
}
