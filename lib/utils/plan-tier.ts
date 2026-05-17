// =============================================================================
// lib/utils/plan-tier.ts
//
// Plan tier access control helpers.
//
// Usage in API routes:
//   const vendor = await getVendorPlan(supabase, userId);
//   if (!hasAccess(vendor, 'growth')) {
//     return NextResponse.json({ error: 'upgrade_required', tier: 'growth' }, { status: 403 });
//   }
// =============================================================================

export type PlanTier   = 'free' | 'growth' | 'pro';
export type PlanStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'free';

export interface VendorPlan {
  plan_tier:    PlanTier;
  plan_status:  PlanStatus;
  trial_ends_at: string | null;
}

// Rank used for >= comparisons
const TIER_RANK: Record<PlanTier, number> = {
  free:   0,
  growth: 1,
  pro:    2,
};

/**
 * Returns true if the vendor has access to features requiring `requiredTier`.
 *
 * Rules:
 *  - 'trialing' counts as fully active (trial not yet expired)
 *  - 'active'   counts as fully active
 *  - 'past_due' gets a 7-day grace period (still active), then downgrades
 *  - 'cancelled' / 'free' → only free features
 *
 * Trial expiry is enforced by the Stripe webhook / cron that sets
 * plan_status = 'free' and plan_tier = 'free' when trial_ends_at passes.
 */
export function hasAccess(vendor: VendorPlan, requiredTier: PlanTier): boolean {
  const { plan_tier, plan_status } = vendor;

  if (plan_status === 'cancelled' || plan_status === 'free') return false;

  // past_due: keep access for up to 7 days (Stripe retries in that window)
  // The webhook will flip status to 'cancelled' if still unpaid after retries.
  if (plan_status === 'past_due') {
    return TIER_RANK[plan_tier] >= TIER_RANK[requiredTier];
  }

  // trialing or active
  return TIER_RANK[plan_tier] >= TIER_RANK[requiredTier];
}

/**
 * Fetches the vendor's current plan from the DB.
 * Returns null if the vendor profile doesn't exist.
 */
export async function getVendorPlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<VendorPlan | null> {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('plan_tier, plan_status, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as VendorPlan;
}

/**
 * Days remaining in trial. Returns 0 if not trialing or trial has expired.
 */
export function trialDaysRemaining(vendor: VendorPlan): number {
  if (vendor.plan_status !== 'trialing' || !vendor.trial_ends_at) return 0;
  const diff = new Date(vendor.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Human-readable plan name for display.
 */
export function planLabel(tier: PlanTier): string {
  return { free: 'Free', growth: 'Growth', pro: 'Pro' }[tier];
}

/**
 * Monthly price in HUF for display.
 */
export const PLAN_PRICES_HUF: Record<PlanTier, number> = {
  free:   0,
  growth: 13990,
  pro:    27990,
};
