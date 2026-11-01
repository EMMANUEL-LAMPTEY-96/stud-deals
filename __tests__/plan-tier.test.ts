import { planLimitMessage, ACTIVE_OFFER_LIMIT, hasAccess } from '@/lib/utils/plan-tier';

describe('plan limits', () => {
  it('matches the billing page: Free 1, Growth 10, Pro unlimited', () => {
    expect(ACTIVE_OFFER_LIMIT).toEqual({ free: 1, growth: 10, pro: null });
  });

  it('surfaces the database plan-limit message to vendors', () => {
    const msg = 'Your Free plan allows 1 active offer. Pause another offer or upgrade your plan in Billing.';
    expect(planLimitMessage({ message: msg, hint: 'plan_limit' })).toBe(msg);
    expect(planLimitMessage({ message: msg })).toBe(msg);
  });

  it('ignores unrelated errors so pages keep their own fallback text', () => {
    expect(planLimitMessage({ message: 'new row violates row-level security policy' })).toBeNull();
    expect(planLimitMessage(null)).toBeNull();
  });

  it('cancelled plans get free features only', () => {
    expect(hasAccess({ plan_tier: 'growth', plan_status: 'cancelled', trial_ends_at: null }, 'growth')).toBe(false);
    expect(hasAccess({ plan_tier: 'growth', plan_status: 'active', trial_ends_at: null }, 'growth')).toBe(true);
  });
});
