/**
 * rate-limit.ts
 * Lightweight in-process + Supabase-backed rate limiter for API routes.
 * Used primarily on verification upload endpoints.
 */

import { createClient } from '@/lib/supabase/server';
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
 * Uses the verification_attempts table (created in migration 004).
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
  const supabase = await createClient();

  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const resetAt = new Date(windowStart.getTime() + windowHours * 60 * 60 * 1000);

  try {
    // Count recent attempts
    const { count, error } = await supabase
      .from('verification_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('attempt_at', windowStart.toISOString());

    if (error) {
      safeLog.warn('rate-limit: could not query attempts table', error.message);
      // Fail open â don't block legitimate users if DB is having issues
      return { allowed: true, remaining: maxAttempts, resetAt };
    }

    const usedAttempts = count ?? 0;
    const remaining = Math.max(0, maxAttempts - usedAttempts);

    if (usedAttempts >= maxAttempts) {
      safeLog.audit('rate_limit_exceeded', { action, userId, usedAttempts, maxAttempts });
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        reason: `Too many ${action} attempts. You can try again after ${resetAt.toLocaleTimeString('hu-HU')}.`,
      };
    }

    // Record this attempt
    await supabase.from('verification_attempts').insert({
      user_id: userId,
      attempt_at: new Date().toISOString(),
      success: false, // updated to true if verification succeeds
    });

    return { allowed: true, remaining: remaining - 1, resetAt };
  } catch (err) {
    safeLog.error('rate-limit: unexpected error', (err as Error).message);
    return { allowed: true, remaining: maxAttempts, resetAt };
  }
}

/**
 * Mark the most recent attempt for this user as successful.
 */
export async function markVerificationSuccess(userId: string): Promise<void> {
  const supabase = await createClient();
  try {
    const { data } = await supabase
      .from('verification_attempts')
      .select('id')
      .eq('user_id', userId)
      .order('attempt_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      await supabase
        .from('verification_attempts')
        .update({ success: true })
        .eq('id', data.id);
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
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': result.resetAt.toISOString(),
        'Retry-After': String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)),
      },
    }
  );
}
