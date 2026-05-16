// =============================================================================
// lib/email/templates.ts
//
// HTML email templates for vendor transactional notifications.
// All templates:
//   - Use inline styles (email client compatibility)
//   - Are mobile-first (max-width 600px)
//   - Use Unideals brand colour #4f46e5 (indigo-600)
//   - Are plain HTML — no React, no JSX, runs on the server only
// =============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://studeals.vercel.app';

// Shared wrapper used by all templates
function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unideals</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;text-align:center;">
              <span style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Unideals</span>
              <span style="display:block;font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;">Student Loyalty Platform</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You're receiving this because you have a vendor account on
                <a href="${BASE_URL}" style="color:#4f46e5;text-decoration:none;">Unideals</a>.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                <a href="${BASE_URL}/vendor" style="color:#4f46e5;text-decoration:none;">Go to your dashboard</a>
                &nbsp;·&nbsp;
                <a href="${BASE_URL}/vendor/notifications" style="color:#4f46e5;text-decoration:none;">Notification settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Shared CTA button
function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">${label}</a>`;
}

// Star rating display
function starRating(rating: number): string {
  return Array.from({ length: 5 })
    .map((_, i) => `<span style="color:${i < rating ? '#f59e0b' : '#d1d5db'};font-size:20px;">★</span>`)
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 1: Voucher Redeemed
// Sent to vendor when a student's claimed voucher is confirmed at their venue.
// ─────────────────────────────────────────────────────────────────────────────

export interface RedemptionEmailData {
  vendorBusinessName: string;
  offerTitle: string;
  discountLabel: string;
  studentDisplayName: string;   // privacy-safe "Emmanuel A."
  confirmedAt: string;          // ISO timestamp
  dashboardUrl?: string;
}

export function redemptionEmail(data: RedemptionEmailData): { subject: string; html: string } {
  const time = new Date(data.confirmedAt).toLocaleString('hu-HU', {
    timeZone: 'Europe/Budapest',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const subject = `✅ Voucher redeemed — ${data.studentDisplayName} used "${data.offerTitle}"`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#111827;">Voucher redeemed! ✅</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">A student just successfully used a voucher at <strong>${data.vendorBusinessName}</strong>.</p>

    <!-- Summary card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;width:40%;">Student</td>
              <td style="padding:6px 0;font-size:14px;font-weight:700;color:#111827;">${data.studentDisplayName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Offer</td>
              <td style="padding:6px 0;font-size:14px;font-weight:700;color:#111827;">${data.offerTitle}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Discount applied</td>
              <td style="padding:6px 0;font-size:14px;font-weight:700;color:#4f46e5;">${data.discountLabel}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Time</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;">${time}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#6b7280;">Each confirmed redemption is tracked in your analytics — helping you measure ROI and student engagement over time.</p>

    ${ctaButton(data.dashboardUrl ?? `${BASE_URL}/vendor/analytics`, 'View analytics →')}
  `);

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 2: Loyalty Reward Earned
// Sent to vendor when a student completes a punch card and earns a reward.
// ─────────────────────────────────────────────────────────────────────────────

export interface RewardEarnedEmailData {
  vendorBusinessName: string;
  offerTitle: string;
  rewardLabel: string;
  studentDisplayName: string;
  stampsRequired: number;
  earnedAt: string;
}

export function rewardEarnedEmail(data: RewardEarnedEmailData): { subject: string; html: string } {
  const time = new Date(data.earnedAt).toLocaleString('hu-HU', {
    timeZone: 'Europe/Budapest',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const subject = `🎉 Loyalty reward earned — ${data.studentDisplayName} completed their punch card`;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#111827;">Loyalty reward earned! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;"><strong>${data.studentDisplayName}</strong> just completed their punch card at <strong>${data.vendorBusinessName}</strong> and has earned a reward.</p>

    <!-- Reward highlight -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-radius:12px;border:1px solid #fbbf24;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;text-align:center;">
          <span style="font-size:36px;">🏆</span>
          <p style="margin:8px 0 4px;font-size:18px;font-weight:900;color:#92400e;">Reward to honour</p>
          <p style="margin:0;font-size:22px;font-weight:900;color:#d97706;">${data.rewardLabel}</p>
          <p style="margin:8px 0 0;font-size:13px;color:#b45309;">After ${data.stampsRequired} visits · ${data.offerTitle}</p>
        </td>
      </tr>
    </table>

    <!-- Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;width:40%;">Student</td>
              <td style="padding:6px 0;font-size:14px;font-weight:700;color:#111827;">${data.studentDisplayName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Stamps completed</td>
              <td style="padding:6px 0;font-size:14px;font-weight:700;color:#4f46e5;">${data.stampsRequired} / ${data.stampsRequired} ✓</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Earned at</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;">${time}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#6b7280;">When the student visits to claim their reward, they'll show you the voucher on the Rewards page. Check your pending rewards in your dashboard.</p>

    ${ctaButton(`${BASE_URL}/vendor/rewards`, 'View pending rewards →')}
  `);

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template 3: New Review
// Sent to vendor when a student submits a review for their business.
// ─────────────────────────────────────────────────────────────────────────────

export interface NewReviewEmailData {
  vendorBusinessName: string;
  rating: number;        // 1–5
  reviewTitle?: string;
  reviewBody?: string;
  reviewsUrl?: string;
  submittedAt: string;
}

export function newReviewEmail(data: NewReviewEmailData): { subject: string; html: string } {
  const ratingWord = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][data.rating] ?? 'Rated';
  const subject = `⭐ New ${data.rating}-star review — ${ratingWord} feedback for ${data.vendorBusinessName}`;

  const hasText = data.reviewTitle || data.reviewBody;

  const html = emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#111827;">New student review ⭐</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">A verified student left a review for <strong>${data.vendorBusinessName}</strong>.</p>

    <!-- Rating card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:${hasText ? '16' : '24'}px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Rating</p>
          <div>${starRating(data.rating)}</div>
          <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:#111827;">${ratingWord} (${data.rating}/5)</p>
        </td>
      </tr>
    </table>

    ${hasText ? `
    <!-- Review text -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          ${data.reviewTitle ? `<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#111827;">${data.reviewTitle}</p>` : ''}
          ${data.reviewBody ? `<p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${data.reviewBody}</p>` : ''}
        </td>
      </tr>
    </table>
    ` : ''}

    <p style="margin:0;font-size:14px;color:#6b7280;">You can respond to this review from your vendor dashboard. Replying to feedback shows students you care — and can turn a 3★ into a regular.</p>

    ${ctaButton(data.reviewsUrl ?? `${BASE_URL}/vendor/reviews`, 'Reply to review →')}
  `);

  return { subject, html };
}
