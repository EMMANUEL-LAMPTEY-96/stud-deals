// =============================================================================
// __tests__/distance.test.ts
// Unit tests for lib/utils/distance.ts — Haversine distance + proximity labels.
// Used for the near-campus offer filter on the student dashboard.
// =============================================================================

import {
  haversineKm,
  proximityLabel,
  proximityPriority,
  attachDistances,
} from '@/lib/utils/distance';

// ---------------------------------------------------------------------------
// haversineKm — Haversine distance calculation
// ---------------------------------------------------------------------------

describe('haversineKm', () => {
  test('same point returns 0', () => {
    expect(haversineKm(47.4979, 19.0402, 47.4979, 19.0402)).toBeCloseTo(0, 4);
  });

  test('Budapest → Debrecen ≈ 194 km', () => {
    // Budapest: 47.4979°N, 19.0402°E  |  Debrecen: 47.5316°N, 21.6273°E
    const km = haversineKm(47.4979, 19.0402, 47.5316, 21.6273);
    expect(km).toBeGreaterThan(180);
    expect(km).toBeLessThan(210);
  });

  test('Eötvös Loránd (ELTE) → BME ≈ 2 km (both in Budapest)', () => {
    // ELTE Lágymányos: 47.4726, 19.0570  |  BME: 47.4808, 19.0556
    const km = haversineKm(47.4726, 19.0570, 47.4808, 19.0556);
    expect(km).toBeGreaterThan(0.5);
    expect(km).toBeLessThan(3);
  });

  test('very short distance (50 m) is non-negative', () => {
    // shift by ~0.0005° lat ≈ 55 m
    const km = haversineKm(47.4979, 19.0402, 47.4984, 19.0402);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(0.1);
  });

  test('returns a number', () => {
    expect(typeof haversineKm(0, 0, 0, 0)).toBe('number');
  });

  test('is symmetric — A→B equals B→A', () => {
    const ab = haversineKm(47.4979, 19.0402, 48.2082, 16.3738);
    const ba = haversineKm(48.2082, 16.3738, 47.4979, 19.0402);
    expect(ab).toBeCloseTo(ba, 6);
  });

  test('Budapest → Vienna ≈ 214 km', () => {
    const km = haversineKm(47.4979, 19.0402, 48.2082, 16.3738);
    expect(km).toBeGreaterThan(200);
    expect(km).toBeLessThan(230);
  });
});

// ---------------------------------------------------------------------------
// proximityLabel
// ---------------------------------------------------------------------------

describe('proximityLabel', () => {
  test('0 km → "On campus"', () => {
    expect(proximityLabel(0)).toBe('On campus');
  });

  test('0.05 km → "On campus"', () => {
    expect(proximityLabel(0.05)).toBe('On campus');
  });

  test('0.1 km → "5 min walk"', () => {
    expect(proximityLabel(0.1)).toBe('5 min walk');
  });

  test('0.2 km → "5 min walk"', () => {
    expect(proximityLabel(0.2)).toBe('5 min walk');
  });

  test('0.3 km → "10 min walk"', () => {
    expect(proximityLabel(0.3)).toBe('10 min walk');
  });

  test('0.5 km → "10 min walk"', () => {
    expect(proximityLabel(0.5)).toBe('10 min walk');
  });

  test('0.6 km → "15 min walk"', () => {
    expect(proximityLabel(0.6)).toBe('15 min walk');
  });

  test('0.9 km → "15 min walk"', () => {
    expect(proximityLabel(0.9)).toBe('15 min walk');
  });

  test('1.0 km → distance in metres', () => {
    const label = proximityLabel(1.0);
    expect(label).toMatch(/1000 m away/);
  });

  test('1.5 km → distance in metres', () => {
    const label = proximityLabel(1.5);
    expect(label).toMatch(/1500 m away/);
  });

  test('2.0 km → distance in km', () => {
    const label = proximityLabel(2.0);
    expect(label).toMatch(/2\.0 km away/);
  });

  test('5.7 km → distance in km', () => {
    const label = proximityLabel(5.7);
    expect(label).toMatch(/5\.7 km away/);
  });
});

// ---------------------------------------------------------------------------
// proximityPriority
// ---------------------------------------------------------------------------

describe('proximityPriority', () => {
  test('0 km → priority 0 (walking distance)', () => {
    expect(proximityPriority(0)).toBe(0);
  });

  test('0.29 km → priority 0', () => {
    expect(proximityPriority(0.29)).toBe(0);
  });

  test('0.3 km → priority 1 (nearby)', () => {
    expect(proximityPriority(0.3)).toBe(1);
  });

  test('0.99 km → priority 1', () => {
    expect(proximityPriority(0.99)).toBe(1);
  });

  test('1.0 km → priority 2 (close)', () => {
    expect(proximityPriority(1.0)).toBe(2);
  });

  test('1.99 km → priority 2', () => {
    expect(proximityPriority(1.99)).toBe(2);
  });

  test('2.0 km → priority 3 (in the city)', () => {
    expect(proximityPriority(2.0)).toBe(3);
  });

  test('4.99 km → priority 3', () => {
    expect(proximityPriority(4.99)).toBe(3);
  });

  test('5.0 km → priority 4 (further out)', () => {
    expect(proximityPriority(5.0)).toBe(4);
  });

  test('closer items always have lower or equal priority number', () => {
    expect(proximityPriority(0.1)).toBeLessThanOrEqual(proximityPriority(0.5));
    expect(proximityPriority(0.5)).toBeLessThanOrEqual(proximityPriority(1.5));
    expect(proximityPriority(1.5)).toBeLessThanOrEqual(proximityPriority(3.0));
    expect(proximityPriority(3.0)).toBeLessThanOrEqual(proximityPriority(10.0));
  });
});

// ---------------------------------------------------------------------------
// attachDistances
// ---------------------------------------------------------------------------

describe('attachDistances', () => {
  const campus = { latitude: 47.4979, longitude: 19.0402 }; // Budapest

  const items = [
    { id: 'near',    latitude: 47.4984, longitude: 19.0402 }, // ~55 m
    { id: 'mid',     latitude: 47.5080, longitude: 19.0500 }, // ~1.3 km
    { id: 'far',     latitude: 47.6000, longitude: 19.1000 }, // ~14 km
    { id: 'no-coords', latitude: null,  longitude: null },
  ];

  test('returns an array of the same length', () => {
    const result = attachDistances(items, campus);
    expect(result).toHaveLength(items.length);
  });

  test('attaches item reference correctly', () => {
    const result = attachDistances(items, campus);
    expect(result[0].item).toBe(items[0]);
  });

  test('near item has small distanceKm', () => {
    const result = attachDistances(items, campus);
    const near = result.find(r => r.item.id === 'near')!;
    expect(near.distanceKm).toBeLessThan(0.1);
  });

  test('far item has large distanceKm', () => {
    const result = attachDistances(items, campus);
    const far = result.find(r => r.item.id === 'far')!;
    expect(far.distanceKm).toBeGreaterThan(10);
  });

  test('items without coordinates get Infinity distance', () => {
    const result = attachDistances(items, campus);
    const noCoords = result.find(r => r.item.id === 'no-coords')!;
    expect(noCoords.distanceKm).toBe(Infinity);
    expect(noCoords.priority).toBe(99);
    expect(noCoords.label).toBe('');
  });

  test('null campus returns all items with Infinity distance', () => {
    const result = attachDistances(items, null);
    expect(result.every(r => r.distanceKm === Infinity)).toBe(true);
    expect(result.every(r => r.priority === 99)).toBe(true);
  });

  test('near item has lower priority number than far item', () => {
    const result = attachDistances(items, campus);
    const near = result.find(r => r.item.id === 'near')!;
    const far  = result.find(r => r.item.id === 'far')!;
    expect(near.priority).toBeLessThan(far.priority);
  });

  test('label is a non-empty string for items with coordinates', () => {
    const result = attachDistances(items, campus);
    const near = result.find(r => r.item.id === 'near')!;
    expect(typeof near.label).toBe('string');
    expect(near.label.length).toBeGreaterThan(0);
  });

  test('handles empty item array', () => {
    const result = attachDistances([], campus);
    expect(result).toHaveLength(0);
  });
});
