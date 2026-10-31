'use client';

// =============================================================================
// app/(student)/cafes/page.tsx — Cafés near campus
//
// Real cafés in Szeged and Budapest from public.listed_cafes (migration 024).
// These are listings only: the cafés are NOT partners and offer NO student
// discount through StudDeals. The page must say so plainly on every card.
// - City tabs (Szeged / Budapest)
// - Optional "Sort by distance" using the browser's location (never stored)
// - Map link opens OpenStreetMap at the café's coordinates
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/shared/Navbar';
import { createClient } from '@/lib/supabase/client';
import { haversineKm, proximityLabel } from '@/lib/utils/distance';
import { Coffee, MapPin, ExternalLink, Navigation, Loader2, Info } from 'lucide-react';

interface ListedCafe {
  id: string;
  slug: string;
  name: string;
  city: string;
  address_line1: string;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  website_url: string | null;
}

const CITIES = ['Szeged', 'Budapest'] as const;
type City = (typeof CITIES)[number];

export default function CafesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [cafes, setCafes]     = useState<ListedCafe[]>([]);
  const [city, setCity]       = useState<City>('Szeged');
  const [here, setHere]       = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('listed_cafes')
          .select('id, slug, name, city, address_line1, postal_code, latitude, longitude, website_url')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        setCafes((data ?? []).map((c) => ({ ...c, latitude: Number(c.latitude), longitude: Number(c.longitude) })));
      } catch {
        setError('Could not load cafés. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const inCity = cafes.filter((c) => c.city === city);
    if (!here) return inCity.map((c) => ({ cafe: c, km: null as number | null }));
    return inCity
      .map((c) => ({ cafe: c, km: haversineKm(here.lat, here.lng, c.latitude, c.longitude) }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  }, [cafes, city, here]);

  function locateMe() {
    if (!('geolocation' in navigator)) { setLocError('Your browser does not share location.'); return; }
    setLocating(true); setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      ()    => { setLocError('Location not available — showing A–Z instead.'); setLocating(false); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-2 mb-1">
            <Coffee size={22} className="text-brand-600" />
            <h1 className="text-2xl font-bold text-gray-900">Cafés near campus</h1>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Real coffee shops close to the universities in Szeged and Budapest.
          </p>

          <div className="flex gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 mb-6 text-sm text-amber-900">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <p>
              These cafés are <strong>not StudDeals partners yet</strong> and don&apos;t offer a student
              discount through us. Discounts appear here only after a café signs up.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-5">
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  city === c ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {c} <span className="opacity-60">({cafes.filter((x) => x.city === c).length})</span>
              </button>
            ))}
            <button
              onClick={locateMe}
              disabled={locating}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:border-gray-300 disabled:opacity-60"
            >
              {locating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
              {here ? 'Sorted by distance' : 'Sort by distance'}
            </button>
          </div>
          {locError && <p className="text-xs text-gray-500 -mt-3 mb-4">{locError}</p>}

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : error ? (
            <p className="text-center text-sm text-red-600 py-16">{error}</p>
          ) : shown.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-16">No cafés listed in {city} yet.</p>
          ) : (
            <ul className="space-y-3">
              {shown.map(({ cafe, km }) => (
                <li key={cafe.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-900">{cafe.name}</h2>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                        <MapPin size={13} className="flex-shrink-0" />
                        <span className="truncate">
                          {cafe.address_line1}, {cafe.postal_code ? `${cafe.postal_code} ` : ''}{cafe.city}
                        </span>
                      </p>
                    </div>
                    {km !== null && (
                      <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{proximityLabel(km)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">No student offer yet</span>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${cafe.latitude}&mlon=${cafe.longitude}#map=18/${cafe.latitude}/${cafe.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                    >
                      Map <ExternalLink size={12} />
                    </a>
                    {cafe.website_url && (
                      <a href={cafe.website_url} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                        Website <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-gray-400 mt-8">
            Locations © OpenStreetMap contributors. Own one of these cafés?{' '}
            <a href="/for-vendors" className="underline">List your student deals</a>.
          </p>
        </div>
      </div>
    </>
  );
}
