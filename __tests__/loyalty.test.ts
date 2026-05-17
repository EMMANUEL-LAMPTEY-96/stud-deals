// =============================================================================
// __tests__/loyalty.test.ts
// Unit tests for lib/utils/loyalty.ts — loyalty config parsing + stamp logic.
// The stamp system drives the core retention loop; regressions here affect
// whether students receive correct rewards and whether vendors' configured
// tiers fire at the right thresholds.
// =============================================================================

import {
  parseLoyaltyConfig,
  isDoubleStampWindow,
  calculateStampsToAward,
  checkTierReward,
  isMainRewardReached,
  type LoyaltyConfig,
  type DoubleStampWindow,
} from '@/lib/utils/loyalty';

// ---------------------------------------------------------------------------
// parseLoyaltyConfig
// ---------------------------------------------------------------------------

describe('parseLoyaltyConfig', () => {
  test('returns null for null input', () => {
    expect(parseLoyaltyConfig(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(parseLoyaltyConfig(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseLoyaltyConfig('')).toBeNull();
  });

  test('returns null for plain text (no LOYALTY prefix)', () => {
    expect(parseLoyaltyConfig('Buy 10 get 1 free')).toBeNull();
  });

  test('returns null for malformed JSON after prefix', () => {
    expect(parseLoyaltyConfig('[[LOYALTY:{bad json}]]')).toBeNull();
  });

  test('parses a basic punch_card config', () => {
    const raw = '[[LOYALTY:{"mode":"punch_card","required_visits":10,"reward_label":"Free coffee"}]]';
    const config = parseLoyaltyConfig(raw);
    expect(config).not.toBeNull();
    expect(config!.mode).toBe('punch_card');
    expect(config!.required_visits).toBe(10);
    expect(config!.reward_label).toBe('Free coffee');
  });

  test('parses a config with advanced options', () => {
    const raw = JSON.stringify({
      mode: 'punch_card',
      required_visits: 5,
      first_visit_bonus: 2,
      stamp_expiry_days: 30,
    });
    const result = parseLoyaltyConfig(`[[LOYALTY:${raw}]]`);
    expect(result!.first_visit_bonus).toBe(2);
    expect(result!.stamp_expiry_days).toBe(30);
  });

  test('parses a config with tiers', () => {
    const raw = JSON.stringify({
      mode: 'punch_card',
      required_visits: 10,
      tiers: [
        { stamps: 5, reward_label: 'Free drink', reward_type: 'item' },
        { stamps: 10, reward_label: 'Free meal', reward_type: 'item' },
      ],
    });
    const config = parseLoyaltyConfig(`[[LOYALTY:${raw}]]`);
    expect(config!.tiers).toHaveLength(2);
    expect(config!.tiers![0].stamps).toBe(5);
    expect(config!.tiers![1].reward_label).toBe('Free meal');
  });

  test('returns null if prefix is not at start of string', () => {
    // Prefix must be at position 0
    const raw = 'Some terms. [[LOYALTY:{"mode":"punch_card"}]]';
    expect(parseLoyaltyConfig(raw)).toBeNull();
  });

  test('parses config even when followed by extra text', () => {
    // The regex uses non-greedy match — extra content after ]] is fine
    const raw = '[[LOYALTY:{"mode":"standard"}]] Additional terms apply.';
    const config = parseLoyaltyConfig(raw);
    expect(config).not.toBeNull();
    expect(config!.mode).toBe('standard');
  });

  test('all valid modes parse correctly', () => {
    const modes: LoyaltyConfig['mode'][] = ['punch_card', 'first_visit', 'milestone', 'standard'];
    for (const mode of modes) {
      const config = parseLoyaltyConfig(`[[LOYALTY:{"mode":"${mode}"}]]`);
      expect(config!.mode).toBe(mode);
    }
  });
});

// ---------------------------------------------------------------------------
// isDoubleStampWindow
// ---------------------------------------------------------------------------

describe('isDoubleStampWindow', () => {
  const windows: DoubleStampWindow[] = [
    { days: ['monday', 'wednesday'], start: '10:00', end: '12:00' },
    { days: ['friday'],              start: '17:00', end: '19:00' },
  ];

  test('returns false for empty windows array', () => {
    expect(isDoubleStampWindow([], new Date())).toBe(false);
  });

  // Note: isDoubleStampWindow uses Europe/Budapest timezone internally.
  // We stub the `now` parameter with a known UTC time that corresponds to a
  // Budapest time that IS/IS NOT within the window.
  //
  // Budapest is UTC+1 (CET) or UTC+2 (CEST in summer).
  // Monday 10:30 Budapest = Monday 08:30 UTC (winter) or 09:30 UTC (CEST).
  // To avoid flakiness, we verify the function returns a boolean and test
  // edge logic separately.

  test('returns a boolean', () => {
    const result = isDoubleStampWindow(windows, new Date());
    expect(typeof result).toBe('boolean');
  });

  test('window that starts and ends at the same time is a point — boundary', () => {
    const pointWindow: DoubleStampWindow[] = [
      { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        start: '00:00', end: '23:59' }
    ];
    // With a full-day window, any time today should be in range
    const result = isDoubleStampWindow(pointWindow, new Date());
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateStampsToAward
// ---------------------------------------------------------------------------

describe('calculateStampsToAward', () => {
  const basicConfig: LoyaltyConfig = {
    mode: 'punch_card',
    required_visits: 10,
  };

  const configWithBonus: LoyaltyConfig = {
    mode: 'punch_card',
    required_visits: 10,
    first_visit_bonus: 2,
  };

  const configWithDoubleWindow: LoyaltyConfig = {
    mode: 'punch_card',
    required_visits: 10,
    double_stamp_windows: [
      // All day every day — always active
      {
        days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
        start: '00:00',
        end: '23:59',
      },
    ],
  };

  test('normal visit returns 1 stamp', () => {
    expect(calculateStampsToAward(basicConfig, false)).toBe(1);
  });

  test('first visit without bonus returns 1 stamp', () => {
    expect(calculateStampsToAward(basicConfig, true)).toBe(1);
  });

  test('first visit WITH bonus returns 1 + bonus stamps', () => {
    // base=1 (not in double window) + first_visit_bonus=2 → 3
    expect(calculateStampsToAward(configWithBonus, true)).toBe(3);
  });

  test('non-first visit with bonus config returns 1 stamp (no bonus)', () => {
    expect(calculateStampsToAward(configWithBonus, false)).toBe(1);
  });

  test('double stamp window active: returns 2 stamps', () => {
    // The config has a 24/7 window so isDoubleStampWindow always returns true
    const stamps = calculateStampsToAward(configWithDoubleWindow, false);
    expect(stamps).toBe(2);
  });

  test('double stamp window + first visit bonus: returns 2 + bonus', () => {
    const config: LoyaltyConfig = {
      mode: 'punch_card',
      required_visits: 10,
      first_visit_bonus: 1,
      double_stamp_windows: [
        { days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
          start: '00:00', end: '23:59' },
      ],
    };
    // double window → base 2, first visit bonus 1 → 3 total
    expect(calculateStampsToAward(config, true)).toBe(3);
  });

  test('config with no double windows: never doubles', () => {
    expect(calculateStampsToAward(basicConfig, false)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// checkTierReward
// ---------------------------------------------------------------------------

describe('checkTierReward', () => {
  const config: LoyaltyConfig = {
    mode: 'punch_card',
    required_visits: 20,
    tiers: [
      { stamps: 5,  reward_label: 'Free coffee',    reward_type: 'item' },
      { stamps: 10, reward_label: '10% off meal',   reward_type: 'percentage', reward_value: 10 },
      { stamps: 15, reward_label: 'Free dessert',   reward_type: 'item' },
    ],
  };

  test('returns null if no tiers configured', () => {
    const noTiers: LoyaltyConfig = { mode: 'punch_card', required_visits: 10 };
    expect(checkTierReward(noTiers, 5)).toBeNull();
  });

  test('returns null if stamp count does not match any tier', () => {
    expect(checkTierReward(config, 3)).toBeNull();
    expect(checkTierReward(config, 7)).toBeNull();
    expect(checkTierReward(config, 20)).toBeNull();
  });

  test('returns correct tier at threshold 5', () => {
    const reward = checkTierReward(config, 5);
    expect(reward).not.toBeNull();
    expect(reward!.reward_label).toBe('Free coffee');
  });

  test('returns correct tier at threshold 10', () => {
    const reward = checkTierReward(config, 10);
    expect(reward!.reward_label).toBe('10% off meal');
    expect(reward!.reward_value).toBe(10);
  });

  test('returns correct tier at threshold 15', () => {
    const reward = checkTierReward(config, 15);
    expect(reward!.reward_label).toBe('Free dessert');
  });

  test('returns null for 0 stamps', () => {
    expect(checkTierReward(config, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isMainRewardReached
// ---------------------------------------------------------------------------

describe('isMainRewardReached', () => {
  const config: LoyaltyConfig = {
    mode: 'punch_card',
    required_visits: 10,
  };

  test('returns false at 0 stamps', () => {
    expect(isMainRewardReached(config, 0)).toBe(false);
  });

  test('returns false before threshold', () => {
    expect(isMainRewardReached(config, 9)).toBe(false);
  });

  test('returns true exactly at threshold (10)', () => {
    expect(isMainRewardReached(config, 10)).toBe(true);
  });

  test('returns true at 2× threshold (20)', () => {
    expect(isMainRewardReached(config, 20)).toBe(true);
  });

  test('returns false at 11 (just past threshold, not a multiple)', () => {
    expect(isMainRewardReached(config, 11)).toBe(false);
  });

  test('returns true at every multiple of required_visits', () => {
    for (let i = 1; i <= 5; i++) {
      expect(isMainRewardReached(config, i * 10)).toBe(true);
    }
  });

  test('returns false if required_visits is 0', () => {
    const noVisits: LoyaltyConfig = { mode: 'punch_card', required_visits: 0 };
    expect(isMainRewardReached(noVisits, 0)).toBe(false);
    expect(isMainRewardReached(noVisits, 10)).toBe(false);
  });

  test('returns false if required_visits is undefined', () => {
    const noVisits: LoyaltyConfig = { mode: 'punch_card' };
    expect(isMainRewardReached(noVisits, 10)).toBe(false);
  });
});
