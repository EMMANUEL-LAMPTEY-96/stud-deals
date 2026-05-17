/**
 * distance.ts
 * Haversine distance calculation + campus proximity labels.
 * Used to sort/filter vendors by distance from student's campus.
 */

const EARTH_RADIUS_KM = 6371;

/** Returns distance in kilometres between two lat/lng points */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Human-readable proximity label for display */
export function proximityLabel(km: number): string {
  if (km < 0.1) return 'On campus';
  if (km < 0.3) return '5 min walk';
  if (km < 0.6) return '10 min walk';
  if (km < 1.0) return '15 min walk';
  if (km < 2.0) return `${(km * 1000).toFixed(0)} m away`;
  return `${km.toFixed(1)} km away`;
}

/** Sort order priority (lower = closer = higher priority) */
export function proximityPriority(km: number): number {
  if (km < 0.3) return 0;  // walking distance
  if (km < 1.0) return 1;  // nearby
  if (km < 2.0) return 2;  // close
  if (km < 5.0) return 3;  // in the city
  return 4;                  // further out
}

export interface CampusCoords {
  latitude: number;
  longitude: number;
}

export interface WithDistance<T> {
  item: T;
  distanceKm: number;
  label: string;
  priority: number;
}

/**
 * Attach distance info to a list of items that have lat/lng fields.
 * Items without coordinates are placed last.
 */
export function attachDistances<T extends { latitude?: number | null; longitude?: number | null }>(
  items: T[],
  campus: CampusCoords | null
): WithDistance<T>[] {
  if (!campus) {
    return items.map(item => ({
      item,
      distanceKm: Infinity,
      label: '',
      priority: 99,
    }));
  }

  return items.map(item => {
    if (item.latitude == null || item.longitude == null) {
      return { item, distanceKm: Infinity, label: '', priority: 99 };
    }
    const km = haversineKm(campus.latitude, campus.longitude, item.latitude, item.longitude);
    return {
      item,
      distanceKm: km,
      label: proximityLabel(km),
      priority: proximityPriority(km),
    };
  });
}
