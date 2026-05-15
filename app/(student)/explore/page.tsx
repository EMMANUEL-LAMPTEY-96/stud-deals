'use client';

// =============================================================================
// app/(student)/explore/page.tsx — Student Browse & Explore Page
//
// A dedicated discovery page beyond the dashboard feed. Gives students a
// searchable, filterable, sortable directory of ALL active offers with:
//   - Full-text search across title, vendor name, category
//   - Category filter pills
//   - Sort: relevance / distance / newest / discount size
//   - Near-campus distance filter toggle
//   - Vendor cards (grouped view) + Offer cards (flat view)
//   - Empty states per filter combination
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import OfferCard from '@/components/student/OfferCard';
import VoucherModal from '@/components/student/VoucherModal';
import {
  Search, SlidersHorizontal, Sparkles, Loader2, MapPin,
  Coffee, ShoppingBag, Laptop, Book, Dumbbell, Shirt,
  Tag, UtensilsCrossed, X, ChevronDown, Grid, List,
  TrendingUp, Clock, ArrowDownUp, Star,
} from 'lucide-react';
import type { OfferWithVendor, StudentProfile, Profile, OfferCategory, ClaimOfferResponse } from '@/lib/types/database.types';
import { haversineKm, proximityLabel } from '@/lib/utils/distance';

// ── Types ─────────────────────────────────────────────────────────────────────

type SortOption = 'relevance' | 'newest' | 'distance' | 'discount';
type ViewMode   = 'grid' | 'list';

interface CategoryConfig {
  label: string;
  icon: React.ReactNode;
  value: OfferCategory | 'all';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: CategoryConfig[] = [
  { value: 'all',              label: 'All',         icon: <Sparkles size={13} /> },
  { value: 'food_drink',       label: 'Food & Drink', icon: <Coffee size={13} /> },
  { value: 'groceries',        label: 'Groceries',   icon: <ShoppingBag size={13} /> },
  { value: 'tech',             label: 'Tech',         icon: <Laptop size={13} /> },
  { value: 'books_stationery', label: 'Books',        icon: <Book size={13} /> },
  { value: 'fitness',          label: 'Fitness',      icon: <Dumbbell size={13} /> },
  { value: 'fashion',          label: 'Fashion',      icon: <Shirt size={13} /> },
  { value: 'other',            label: 'More',         icon: <Tag size={13} /> },
];

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'relevance', label: 'Relevance',  icon: <Star size={13} /> },
  { value: 'newest',    label: 'Newest',     icon: <Clock size={13} /> },
  { value: 'distance',  label: 'Nearest',    icon: <MapPin size={13} /> },
  { value: 'discount',  label: 'Best deal',  icon: <TrendingUp size={13} /> },
];

// Extract numeric discount value for sorting
function extractDiscountValue(offer: OfferWithVendor): number {
  const title = (offer.title ?? '') + ' ' + (offer.description ?? '');
  const pct = title.match(/(\d+)\s*%/);
  if (pct) return parseInt(pct[1], 10);
  return 0;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const router = useRouter();
  const supabase = createClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── State ───────────────────────────────────────────────────────────────────
  const [profile, setProfile]               = useState<Profile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [offers, setOffers]                 = useState<OfferWithVendor[]>([]);
  const [savedIds, setSavedIds]             = useState<Set<string>>(new Set());
  const [loading, setLoading]               = useState(true);
  const [claimingId, setClaimingId]         = useState<string | null>(null);
  const [activeVoucher, setActiveVoucher]   = useState<ClaimOfferResponse | null>(null);

  const [search, setSearch]                 = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory]             = useState<OfferCategory | 'all'>('all');
  const [sort, setSort]                     = useState<SortOption>('relevance');
  const [nearCampus, setNearCampus]         = useState(false);
  const [viewMode, setViewMode]             = useState<ViewMode>('grid');
  const [showSortMenu, setShowSortMenu]     = useState(false);
  const [totalCount, setTotalCount]         = useState(0);

  // Campus coordinates (from student profile → institution)
  const [campusCoords, setCampusCoords]     = useState<{ lat: number; lng: number } | null>(null);

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Load user + campus coords ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/sign-in'); return; }

      const [profileRes, studentRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
        supabase.from('student_profiles').select('*').eq('user_id', authUser.id).maybeSingle(),
      ]);

      setProfile(profileRes.data as Profile | null);
      setStudentProfile(studentRes.data as StudentProfile | null);

      // Fetch campus coordinates if student has an institution
      const sp = studentRes.data as StudentProfile | null;
      if (sp?.institution_id) {
        const { data: inst } = await supabase
          .from('institutions')
          .select('latitude, longitude')
          .eq('id', sp.institution_id)
          .maybeSingle();
        if (inst && (inst as any).latitude && (inst as any).longitude) {
          setCampusCoords({ lat: (inst as any).latitude, lng: (inst as any).longitude });
        }
      }
    };
    load();
  }, []);

  // ── Fetch saved offer IDs ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSaved = async () => {
      if (!(studentProfile as any)?.id) return;
      const { data } = await supabase
        .from('saved_offers')
        .select('offer_id')
        .eq('student_id', (studentProfile as any).id);
      if (data) setSavedIds(new Set((data as any[]).map((r) => r.offer_id)));
    };
    fetchSaved();
  }, [(studentProfile as any)?.id]);

  // ── Fetch offers ─────────────────────────────────────────────────────────────
  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('offers')
        .select(`
          *,
          vendor:vendor_profiles (id, business_name, logo_url, city, address_line1, latitude, longitude)
        `)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (debouncedSearch.trim()) {
        query = query.ilike('title', `%${debouncedSearch.trim()}%`);
      }

      // Always fetch more than needed so we can sort client-side
      const { data, count } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      const raw = (data as OfferWithVendor[]) ?? [];

      // Attach distance if campus is known
      let processed = raw.map((offer) => {
        const v = (offer as any).vendor;
        const distKm = campusCoords && v?.latitude && v?.longitude
          ? haversineKm(campusCoords.lat, campusCoords.lng, v.latitude, v.longitude)
          : null;
        return { ...offer, _distKm: distKm };
      });

      // Near-campus filter: only show offers within 5 km
      if (nearCampus && campusCoords) {
        processed = processed.filter((o) => (o as any)._distKm !== null && (o as any)._distKm <= 5);
      }

      // Sort
      switch (sort) {
        case 'newest':
          processed.sort((a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
          );
          break;
        case 'distance':
          processed.sort((a, b) => {
            const da = (a as any)._distKm ?? Infinity;
            const db = (b as any)._distKm ?? Infinity;
            return da - db;
          });
          break;
        case 'discount':
          processed.sort((a, b) => extractDiscountValue(b) - extractDiscountValue(a));
          break;
        default:
          // relevance: text matches first, then by date
          if (debouncedSearch.trim()) {
            const q = debouncedSearch.toLowerCase();
            processed.sort((a, b) => {
              const aScore = (a.title ?? '').toLowerCase().startsWith(q) ? 1 : 0;
              const bScore = (b.title ?? '').toLowerCase().startsWith(q) ? 1 : 0;
              return bScore - aScore;
            });
          }
      }

      setOffers(processed as OfferWithVendor[]);
      setTotalCount(processed.length);
    } finally {
      setLoading(false);
    }
  }, [category, debouncedSearch, sort, nearCampus, campusCoords]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  // ── Claim offer ──────────────────────────────────────────────────────────────
  const handleClaim = async (offerId: string) => {
    if ((studentProfile as any)?.verification_status !== 'verified') {
      router.push('/verification');
      return;
    }
    setClaimingId(offerId);
    try {
      const res = await fetch('/api/redemptions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId, device_type: 'mobile' }),
      });
      const data: ClaimOfferResponse & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        alert(data.error ?? 'Failed to claim voucher.');
        return;
      }
      setActiveVoucher(data);
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setClaimingId(null);
    }
  };

  const isVerified = (studentProfile as any)?.verification_status === 'verified';
  const activeSortLabel = SORT_OPTIONS.find(s => s.value === sort)?.label ?? 'Sort';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-surface-50">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-100 sticky top-16 z-20 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">

            {/* Search row */}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search deals, vendors, categories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              {/* Categories */}
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value as OfferCategory | 'all')}
                  className={`filter-pill flex-shrink-0 ${
                    category === cat.value ? 'filter-pill-active' : 'filter-pill-inactive'
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}

              <div className="w-px h-5 bg-gray-200 flex-shrink-0 mx-1" />

              {/* Near campus toggle */}
              <button
                onClick={() => setNearCampus(v => !v)}
                disabled={!campusCoords}
                className={`filter-pill flex-shrink-0 gap-1.5 ${
                  nearCampus ? 'filter-pill-active' : 'filter-pill-inactive'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title={!campusCoords ? 'Set your institution to enable' : undefined}
              >
                <MapPin size={13} />
                Near campus
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-5 gap-3">
            <p className="text-sm text-gray-500 font-medium">
              {loading ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading…</span>
              ) : (
                <span>{totalCount} {totalCount === 1 ? 'deal' : 'deals'}{nearCampus ? ' near campus' : ''}</span>
              )}
            </p>

            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:border-brand-400 transition-colors"
                >
                  <ArrowDownUp size={12} />
                  {activeSortLabel}
                  <ChevronDown size={11} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 mt-1.5 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 overflow-hidden">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSort(opt.value); setShowSortMenu(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                          sort === opt.value
                            ? 'bg-brand-50 text-brand-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.icon}
                        {opt.label}
                        {sort === opt.value && <span className="ml-auto text-brand-500">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Grid view"
                >
                  <Grid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="List view"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Active filter chips ──────────────────────────────────────────── */}
          {(category !== 'all' || debouncedSearch || nearCampus) && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-gray-400">Active filters:</span>
              {category !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-brand-100 text-brand-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {CATEGORIES.find(c => c.value === category)?.label}
                  <button onClick={() => setCategory('all')} className="ml-0.5 hover:text-brand-900"><X size={10} /></button>
                </span>
              )}
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  "{debouncedSearch}"
                  <button onClick={() => setSearch('')} className="ml-0.5 hover:text-gray-900"><X size={10} /></button>
                </span>
              )}
              {nearCampus && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <MapPin size={10} /> Near campus
                  <button onClick={() => setNearCampus(false)} className="ml-0.5 hover:text-green-900"><X size={10} /></button>
                </span>
              )}
              <button
                onClick={() => { setSearch(''); setCategory('all'); setNearCampus(false); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* ── Offer grid / list ─────────────────────────────────────────────── */}
          {loading ? (
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="card h-64 animate-pulse">
                  <div className="h-40 bg-gray-100 rounded-t-2xl" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-24">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                <SlidersHorizontal size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No deals found</h3>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">
                {debouncedSearch
                  ? `No deals match "${debouncedSearch}".`
                  : nearCampus
                  ? 'No deals within 5 km of your campus right now.'
                  : 'No deals in this category right now.'}
              </p>
              <button
                onClick={() => { setSearch(''); setCategory('all'); setNearCampus(false); }}
                className="mt-4 btn-secondary text-sm"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className={`grid gap-4 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 max-w-2xl'
            }`}>
              {offers.map((offer) => {
                const distKm = (offer as any)._distKm as number | null;
                const distLabel = distKm !== null && campusCoords
                  ? proximityLabel(distKm)
                  : null;

                return (
                  <div key={offer.id} className="flex flex-col">
                    {distLabel && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-1 px-0.5">
                        <MapPin size={10} />
                        {distLabel}
                      </div>
                    )}
                    <OfferCard
                      offer={offer}
                      isSaved={savedIds.has(offer.id)}
                      onSaveToggle={(id, state) => {
                        const next = new Set(savedIds);
                        state ? next.add(id) : next.delete(id);
                        setSavedIds(next);
                      }}
                    />
                    <button
                      onClick={() => handleClaim(offer.id)}
                      disabled={claimingId === offer.id || !isVerified}
                      className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2
                        ${!isVerified
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : claimingId === offer.id
                          ? 'bg-brand-200 text-brand-600 cursor-not-allowed'
                          : 'bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.98] shadow-sm hover:shadow-md'
                        }`}
                    >
                      {claimingId === offer.id ? (
                        <><Loader2 size={14} className="animate-spin" /> Generating…</>
                      ) : !isVerified ? (
                        <>🔒 Verify to unlock</>
                      ) : (
                        <><Sparkles size={14} /> Get Voucher</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeVoucher && (
        <VoucherModal voucher={activeVoucher} onClose={() => setActiveVoucher(null)} />
      )}

      {/* Close sort menu when clicking outside */}
      {showSortMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSortMenu(false)} />
      )}
    </>
  );
}
