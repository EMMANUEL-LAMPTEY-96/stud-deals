// =============================================================================
// lib/utils/validation.ts
// Centralised Zod schemas for all API route inputs.
// Import the relevant schema in each route handler and call .safeParse() on
// the request body before any DB operations.
// =============================================================================

import { z } from 'zod';

// ── Shared field definitions ──────────────────────────────────────────────────

const uuid = z.string().uuid({ message: 'Must be a valid UUID.' });

const deviceType = z
  .enum(['mobile', 'tablet', 'desktop'])
  .default('mobile');

// ── Redemption / Claim ───────────────────────────────────────────────────────

export const ClaimSchema = z.object({
  offer_id: uuid,
  device_type: deviceType,
});

export type ClaimInput = z.infer<typeof ClaimSchema>;

// ── Loyalty / Stamp ──────────────────────────────────────────────────────────

export const StampSchema = z.object({
  vendor_id: uuid,
  /** Optional TOTP nonce for QR replay protection (introduced in task #110) */
  nonce: z.string().optional(),
});

export type StampInput = z.infer<typeof StampSchema>;

// ── Vendor Promote ───────────────────────────────────────────────────────────

export const PromoteSchema = z.object({
  offer_id: uuid,
  message: z
    .string()
    .max(500, { message: 'Promotional message must be 500 characters or fewer.' })
    .optional(),
  channels: z
    .array(z.enum(['notification', 'email', 'flash']))
    .min(1, { message: 'At least one channel must be selected.' })
    .optional(),
});

export type PromoteInput = z.infer<typeof PromoteSchema>;

// ── Vendor Flash Deal ────────────────────────────────────────────────────────

export const FlashDealSchema = z.object({
  offer_id: uuid,
  duration_minutes: z
    .number()
    .int()
    .min(5, { message: 'Flash deal must run for at least 5 minutes.' })
    .max(480, { message: 'Flash deal cannot run for more than 8 hours.' }),
  message: z
    .string()
    .max(280, { message: 'Flash deal message must be 280 characters or fewer.' })
    .optional(),
});

export type FlashDealInput = z.infer<typeof FlashDealSchema>;

// ── Vendor Review Reply ───────────────────────────────────────────────────────

export const ReviewReplySchema = z.object({
  review_id: uuid,
  vendor_reply: z
    .string()
    .min(1, { message: 'Reply cannot be empty.' })
    .max(1000, { message: 'Reply must be 1000 characters or fewer.' }),
});

export type ReviewReplyInput = z.infer<typeof ReviewReplySchema>;

// ── Redemption Confirm (vendor confirms a student voucher) ────────────────────

export const ConfirmRedemptionSchema = z.object({
  redemption_code: z
    .string()
    .min(1, { message: 'redemption_code is required.' })
    .max(100, { message: 'Invalid redemption code.' }),
});

export type ConfirmRedemptionInput = z.infer<typeof ConfirmRedemptionSchema>;

// ── Shared helper: build a 400 validation-error response ─────────────────────

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function validationErrorResponse(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed.',
      issues: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    },
    { status: 400 }
  );
}
