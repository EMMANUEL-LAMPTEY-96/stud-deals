'use client';

// =============================================================================
// app/(student)/dashboard/page.tsx — Student Dashboard
// The primary screen a verified student sees after logging in.
//
// Features:
//   - Verification status banner (nudges unverified students)
//   - Category filter pills (horizontal scroll on mobile)
//   - Offer grid (responsive: 1→2→3 columns)
//   - Voucher modal after claiming
//   - Empty state per category
//   - Greeting with first name + total savings gamification
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import OfferCard from '@/components/student/OfferCard';
import VoucherModal from '@/components/student/VoucherModal';
import {
  GraduationCap, MapPin, Search, SlidersHorizontal,
  Sparkles, Trophy, AlertTriangle, ArrowRight, Loader2,
  Coffee, ShoppingBag, Laptop, UtensilsCrossed, Dumbbell,
  Book, Tag, Shirt
} from 'lucide-react';
import type {
  OfferWithVendor, StudentProfile, Profile,
  OfferCategory, ClaimOfferResponse
} from '@/lib/types/database.types';

// ── Category configuration ───────────────────────────────────────────────────

interface CategoryConfig {
  label: string;
  icon: React.ReactNode;
  value: OfferCategory | 'all';
}

const CATEGORIES: CategoryConfig[] = [
  { value: 'all',             label: 'All Deals',   icon: <Sparkles size={14} /> },
  { value: 'food_drink',      label: 'Food & Drink', icon: <Coffee size={14} /> },
  { value: 'groceries',       label: 'Groceries',   icon: <ShoppingBag size={14} /> },
  { value: 'tech',            label: 'Tech',         icon: <Laptop size={14} /> },
  { value: 'books_stationery',label: 'Books',        icon: <Book size={14} /> },
  { value: 'fitness',         label: 'Fitness',      icon: <Dumbbell size={14} /> },
  { value: 'fashion',         label: 'Fashion',      icon: <Shirt size={14} /> },
  { value: 'other',           label: 'More',         icon: <Tag size={14} /> },
];

// ── Verification Banner ──────────────────────────────────────────────────────

function VerificationBanner({ status }: { status: string }) {
  const config = {
    unverified: {
      bg: 'bg-gradient-to-r from-brand-600 to-brand-700',
      icon: <GraduationCap size={20} className="text-white" />,
      title: 'Verify your student status to unlock deals',
      description: 'Takes 60 seconds with your .edu email.',
      cta: 'Verify now',
      href: '/verification',
    },
    pending_email: {
      bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
      icon: <AlertTriangle size={20} className="text-white" />,
      title: 'Check your university email',
      description: "We sent a verification link. Click it to unlock all deals.",
      cta: 'Resend email',
      href: '/verification',
    },
    pending_review: {
      bg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
      icon: <AlertTriangle size={20} className="text-white" />,
      title: 'Your ID is under review',
      description: "We'll notify you within 24 hours.",
      cta: null,
      href: null,
    },
    rejected: {
      bg: 'bg-gradient-to-r from-red-600 to-red-700',
      icon: <AlertTriangle size={20} className="text-white" />,
      title: 'Verification unsuccessful',
      description: "Please re-upload a clearer photo of your student ID.",
      cta: 'Try again',
      href: '/verification',
    },
  };

  const c = config[status as keyof typeof config];
  if (!c || status === 'verified') return null;

  return (
    <div className={`${c.bg} rounded-2xl p-4 flex items-center gap-4 mb-6 animate-fade-in`}>
      <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
        {c.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{c.title}</p>
        <p className="text-white/70 text-xs mt-0.5">{c.description}</p>
      </div>
      {c.cta && c.href && (
        <a
          href={c.href}
          className="flex-shrink-0 bg-white text-brand-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors flex items-center gap-1"
        >
          {c.cta}
          <ArrowRight size={11} />
        </a>
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<Profile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [offers, setOffers] = useState<OfferWithVendor[]>([]);
  const [savedOfferIds, setSavedOfferIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<OfferCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeVoucher, setActiveVoucher] = useState<ClaimOfferResponse | null>(null);
  const [city, setCity] = useState<string>('');

  // ── Fetch user + student profile ──────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const [profileRes, studentRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', authUser.id).single(),
        supabase.from('student_profiles').select('*').eq('user_id', authUser.id).single(),
      ]);

      setUser(profileRes.data);
      setStudentProfile(studentRes.data);
      setCity(profileRes.data?.city ?? '');
    };

    fetchUser();
  }, []);

  // ── Fetch offers ──────────────────────────────────────────────────────────
  const fetchOffers = useCallback(async () => {
    setLoadingOffers(true);

    let query = supabase
      .from('offers')
      .select(`
        *,
        vendor:vendor_profiles (id, business_name, logo_url, city, address_line1)
      `)
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('created_at', { ascending: false });

    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }

    if (searchQuery.trim()) {
      query = query.ilike('title', `%${searchQuery.trim()}%`);
    }

    const { data, error } = await query.limit(30);

    if (!error) {
      setOffers((data as OfferWithVendor[]) ?? []);
    }

    setLoadingOffers(false);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // ── Fetch saved offer IDs ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchSaved = async () => {
      if (!studentProfile?.id) return;
      const { data } = await supabase
        .from('saved_offers')
        .select('offer_id')
        .eq('student_id', studentProfile.id);
      if (data) setSavedOfferIds(new Set(data.map((r) => r.offer_id)));
    };
    fetchSaved();
  }, [studentProfile?.id]);

  // ── Claim offer ───────────────────────────────────────────────────────────
  const handleClaimOffer = async (offerId: string) => {
    if (studentProfile?.verification_status !== 'verified') {
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
        alert(data.error ?? 'Failed to claim voucher. Please try again.');
        return;
      }

      setActiveVoucher(data);
    } catch {
      alert('Network error. Please check your connection and try again.');
    } finally {
      setClaimingId(null);
    }
  };

  const firstName = user?.first_name ?? user?.display_name?.split(' ')[0] ?? 'there';
  const isVerified = studentProfile?.verification_status === 'verified';

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-surface-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                  Hey {firstName}! 👋
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  {city ? `Exclusive deals near ${city}` : 'Discover deals near your campus'}
                </p>
              </div>

              {/* Savings gamification */}
              {isVerified && (studentProfile?.total_savings_usd ?? 0) > 0 && (
                <div className="flex-shrink-0 bg-white rounded-2xl border border-brand-100 px-4 py-3 text-center shadow-sm">
                  <div className="flex items-center gap-1.5 text-brand-600 mb-0.5">
                    <Trophy size={14} />
                    <span className="text-xs font-semibold">Total saved</span>
                  </div>
                  <div className="text-xl font-black text-gray-900">
                    ${(studentProfile?.total_savings_usd ?? 0).toFixed(0)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── VERIFICATION BANNER ────────────────────────────────────── */}
          {studentProfile && (
            <VerificationBanner status={studentProfile.verification_status} />
          )}

          {/* ── SEARCH BAR ─────────────────────────────────────────────── */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search deals (e.g. 'coffee', '20% off')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-12 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* ── CATEGORY FILTERS ───────────────────────────────────────── */}
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-3 mb-6 -mx-4 px-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value as OfferCategory | 'all')}
                className={`filter-pill flex-shrink-0 ${
                  selectedCategory === cat.value ? 'filter-pill-active' : 'filter-pill-inactive'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>

          {/* ── OFFER GRID ─────────────────────────────────────────────── */}
          {loadingOffers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
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
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4">
                <SlidersHorizontal size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No deals found</h3>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">
                {searchQuery
                  ? `No deals match "${searchQuery}". Try a different search.`
                  : 'No deals in this category right now. Check back soon!'}
              </p>
              {(searchQuery || selectedCategory !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                  className="mt-4 btn-secondary text-sm"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500 font-medium">
                  {offers.length} {offers.length === 1 ? 'deal' : 'deals'} available
                </p>
                {city && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin size={11} />
                    {city}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {offers.map((offer) => (
                  <div key={offer.id} className="flex flex-col">
                    <OfferCard
                      offer={offer}
                      isSaved={savedOfferIds.has(offer.id)}
                      onSaveToggle={(id, state) => {
                        const next = new Set(savedOfferIds);
                        state ? next.add(id) : next.delete(id);
                        setSavedOfferIds(next);
                      }}
                    />
                    {/* Claim button below card */}
                    <button
                      onClick={() => handleClaimOffer(offer.id)}
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
                        <><Loader2 size={14} className="animate-spin" /> Generating code...</>
                      ) : !isVerified ? (
                        <>🔒 Verify to unlock</>
                      ) : (
                        <><Sparkles size={14} /> Get Voucher</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── VOUCHER MODAL ──────────────────────────────────────────────── */}
      {activeVoucher && (
        <VoucherModal
          voucher={activeVoucher}
          onClose={() => setActiveVoucher(null)}
        />
      )}
    </>
  );
}
