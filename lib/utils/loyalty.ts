// =============================================================================
// lib/utils/loyalty.ts
// Pure utility functions for loyalty config parsing and stamp-window checking.
// Extracted from app/api/loyalty/stamp/route.ts so they can be unit-tested
// and reused across the client and server without importing the full route.
// =============================================================================

export interface DoubleStampWindow {
  /** e.g. ["monday", "wednesday"] */
  days: string[];
  /** "HH:MM" in Europe/Budapest timezone */
  start: string;
  /** "HH:MM" in Europe/Budapest timezone */
  end: string;
}

export interface RewardTier {
  stamps: number;
  reward_label: string;
  reward_type: string;
  reward_value?: number;
}

export interface LoyaltyConfig {
  mode: 'punch_card' | 'first_visit' | 'milestone' | 'standard';
  required_visits?: number;
  reward_type?: string;
  reward_value?: number;
  reward_label?: string;
  spend_threshold?: number;
  // Advanced options
  first_visit_bonus?: number;
  stamp_expiry_days?: number;
  double_stamp_windows?: DoubleStampWindow[];
  tiers?: RewardTier[];
}

/**
 * Parse a loyalty config embedded in an offer's terms_and_conditions field.
 * Format: [[LOYALTY:<json>]] at the START of the string.
 *
 * @example
 * parseLoyaltyConfig('[[LOYALTY:{"mode":"punch_card","required_visits":10}]]')
 * // → { mode: 'punch_card', required_visits: 10 }
 */
export function parseLoyaltyConfig(termsAndConditions: string | null | undefined): LoyaltyConfig | null {
  if (!termsAndConditions) return null;
  const match = termsAndConditions.match(/^\[\[LOYALTY:(.*?)\]\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as LoyaltyConfig;
  } catch {
    return null;
  }
}

/**
 * Returns true if the current moment (Europe/Budapest timezone) falls within
 * any of the configured double-stamp windows.
 */
export function isDoubleStampWindow(windows: DoubleStampWindow[], now = new Date()): boolean {
  const currentDay = now.toLocaleDateString('en-US', {
    weekday: 'long', timeZone: 'Europe/Budapest',
  }).toLowerCase();
  const currentTime = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Budapest',
  });

  for (const win of windows) {
    if (!win.days.includes(currentDay)) continue;
    if (currentTime >= win.start && currentTime <= win.end) return true;
  }
  return false;
}

/**
 * Calculate how many stamps to award, accounting for:
 * - double-stamp windows (2× multiplier)
 * - first-visit bonus stamps
 *
 * @param config        Parsed LoyaltyConfig
 * @param isFirstVisit  True if this is the student's very first stamp at this vendor
 * @param windows       Double-stamp windows (from config.double_stamp_windows)
 * @param now           Injectable for testing
 */
export function calculateStampsToAward(
  config: LoyaltyConfig,
  isFirstVisit: boolean,
  now = new Date()
): number {
  const windows = config.double_stamp_windows ?? [];
  const multiplier = windows.length > 0 && isDoubleStampWindow(windows, now) ? 2 : 1;
  const base = multiplier;
  const bonus = isFirstVisit && config.first_visit_bonus ? config.first_visit_bonus : 0;
  return base + bonus;
}

/**
 * Given a current stamp count and a loyalty config, return which tier reward
 * (if any) has just been crossed. Returns null if no tier reward is triggered.
 */
export function checkTierReward(
  config: LoyaltyConfig,
  totalStamps: number
): RewardTier | null {
  if (!config.tiers || config.tiers.length === 0) return null;
  const sorted = [...config.tiers].sort((a, b) => a.stamps - b.stamps);
  for (const tier of sorted) {
    if (totalStamps === tier.stamps) return tier;
  }
  return null;
}

/**
 * Return true if the main cycle reward threshold has been reached.
 */
export function isMainRewardReached(config: LoyaltyConfig, totalStamps: number): boolean {
  if (!config.required_visits || config.required_visits <= 0) return false;
  return totalStamps > 0 && totalStamps % config.required_visits === 0;
}
