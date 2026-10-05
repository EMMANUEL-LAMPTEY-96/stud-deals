/**
 * rate-limit.ts
 * Supabase-backed rate limiter for verification endpoints.
 *
 * Attempts are recorded in public.verification_attempts (migration 018) using
 * the service role — the table has no client policies, so a user can neither
 * read nor erase their own attempt history. If the table can't be queried the
 * limiter fails CLOSED: an ID-upload endpoint without a working limit is open
 * to abuse.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { safeLog } from './safe-logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
}

interface RateLimitConfig {
  maxAttempts: number;      // max allowed in the window
  windowHours: number;      // rolling window in hours
}

const DEFAULTS: RateLimitConfig = {
  maxAttempts: 3,
  windowHours: 24,
};

/**
 * Check + record a rate-limited action for a given user.
 *
 * @param userId   - The authenticated user's UUID
 * @param action   - A label for what's being rate-limited (e.g. 'doc_upload')
 * @param config   - Override defaults
 */
export async function checkRateLimit(
  userId: string,
  action: string = 'verification',
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitResult> {
  const { maxAttempts, windowHours } = { ...DEFAULTS, ...config };
  const admin = createAdminClient();

  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const resetAt = new Date(Date.now() + windowHours * 60 * 60 * 1000);
  const unavailable: RateLimitResult = {
    allowed: false,
    remaining: 0,
    resetAt,
    reason: 'Verification is temporarily unavailable. Please try again later.',
  };

  try {
    const { count, error } = await admin
      .from('verification_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('attempt_at', windowStart.toISOString());

    if (error) {
      safeLog.error('rate-limit: could not query attempts table', error.message);
      return unavailable;
    }

    const usedAttempts = count ?? 0;
    if (usedAttempts >= maxAttempts) {
      safeLog.audit('rate_limit_exceeded', { action, userId, usedAttempts, maxAttempts });
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        reason: `Too many ${action} attempts. Please try again in ${windowHours} hours.`,
      };
    }

    const { error: insertError } = await admin.from('verification_attempts').insert({
      user_id: userId,
      action,
      success: false, // set to true by markVerificationSuccess
    });
    if (insertError) {
      safeLog.error('rate-limit: could not record attempt', insertError.message);
      return unavailable;
    }

    return { allowed: true, remaining: maxAttempts - usedAttempts - 1, resetAt };
  } catch (err) {
    safeLog.error('rate-limit: unexpected error', (err as Error).message);
    return unavailable;
  }
}

/**
 * Mark the most recent attempt for this user/action as successful.
 */
export async function markVerificationSuccess(userId: string, action: string = 'verification'): Promise<void> {
  const admin = createAdminClient();
  try {
    const { data } = await admin
      .from('verification_attempts')
      .select('id')
      .eq('user_id', userId)
      .eq('action', action)
      .order('attempt_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      await admin.from('verification_attempts').update({ success: true }).eq('id', data.id);
    }
  } catch (err) {
    safeLog.warn('markVerificationSuccess: could not update attempt', (err as Error).message);
  }
}

/**
 * Helper to build a 429 rate-limit response.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: result.reason ?? 'Rate limit exceeded', resetAt: result.resetAt }),
    {
      status: result.reason?.startsWith('Verification is temporarily unavailable') ? 503 : 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': result.resetAt.toISOString(),
        'Retry-After': String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)),
      },
    }
  );
}
