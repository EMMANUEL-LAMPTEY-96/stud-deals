// =============================================================================
// lib/email/resend.ts
//
// Thin wrapper around the Resend REST API (no npm package — uses native fetch).
//
// All email sending in the codebase goes through `sendEmail()`.
// If RESEND_API_KEY is not set (local dev without a key), the call is a no-op
// so that every other feature keeps working without email configured.
//
// Required env var:  RESEND_API_KEY
// Optional env var:  RESEND_FROM_EMAIL  (default: onboarding@resend.dev)
//                    RESEND_FROM_NAME   (default: Unideals)
// =============================================================================

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send a transactional email via the Resend REST API.
 * Fire-and-forget safe — always resolves, never throws.
 * Returns `true` if the email was sent, `false` if skipped or errored.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[email] RESEND_API_KEY not set — skipping email to', opts.to);
    }
    return false;
  }

  const from = `${process.env.RESEND_FROM_NAME ?? 'Unideals'} <${process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'}>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[email] Resend API error:', res.status, body);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] Unexpected error sending email:', (err as Error).message);
    return false;
  }
}
