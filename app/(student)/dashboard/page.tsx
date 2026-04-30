'use client';

// =============================================================================
// app/(student)/dashboard/page.tsx — Student Dashboard
// The primary screen a student sees after logging in.
//
// Features:
//   - Loyalty cards quick-access strip (show QR, recent stamp progress)
//   - Verification status banner
//   - Category filter pills
//   - Offer grid (partner businesses and their loyalty programs)
//   - Greeting with first name
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import AdminPreviewBanner from '@/components/shared/AdminPreviewBanner';
import OfferCard from '@/components/student/OfferCard';
import VoucherModal from '@/components/student/VoucherModal';
import EarnStampScanner from '@/components/student/EarnStampScanner';
import {
  GraduationCap, MapPin, Search, SlidersHorizontal,
  Sparkles, Trophy, AlertTriangle, ArrowRight, Loader2,
  Coffee, ShoppingBag, Laptop, Dumbbell,
  Book, Tag, Shirt, QrCode, Stamp, Gift, Store, ChevronRight, Building2,
} from 'lucide-react';

const LAUNCH_CITIES = [
  { value: 'Budapest', label: 'Budapest' },
  { value: 'Szeged',   label: 'Szeged' },
];
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

// ── Loyalty Strip ─────────────────────────────────────────────────────────────

interface LoyaltySnippet {
  vendor_name: string;
  logo_url: string | null;
  stamps_in_cycle: number;
  required_visits: number;
  offer_id: string;
}

function LoyaltyStrip({
  items,
  studentProfileId,
}: {
  items: LoyaltySnippet[];
  studentProfileId: string | undefined;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">My Loyalty Cards</h2>
        <Link href="/my-loyalty" className="text-xs text-brand-600 font-semibold flex items-center gap-1 hover:text-brand-700">
          View all
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {/* Show QR card — always first */}
        <Link
          href="/my-loyalty"
          className="flex-shrink-0 w-32 bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <QrCode size={18} className="text-white" />
          </div>
          <p className="text-white text-xs font-bold text-center leading-tight">Show my QR</p>
        </Link>

        {/* Loyalty progress cards */}
        {items.map((item) => {
          const pct = Math.round((item.stamps_in_cycle / item.required_visits) * 100);
          return (
            <Link
              key={item.offer_id}
              href="/my-loyalty"
              className="flex-shrink-0 w-36 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {item.logo_url ? (
                    <img src={item.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Store size={13} className="text-gray-400" />
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-800 truncate">{item.vendor_name}</p>
              </div>
              {/* Mini stamp dots */}
              <div className="flex gap-1 flex-wrap mb-2">
                {Array.from({ length: Math.min(item.required_visits, 8) }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      i < item.stamps_in_cycle ? 'bg-brand-500' : 'bg-gray-100'
                    }`}
                  >
                    {i < item.stamps_in_cycle && <Stamp size={8} className="text-white" />}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                {item.stamps_in_cycle}/{item.required_visits}
                {item.stamps_in_cycle === item.required_visits && ' 🎉'}
              </p>
            </Link>
          );
        })}

        {/* Empty state card */}
        {items.length === 0 && (
          <Link
            href="/my-loyalty"
            className="flex-shrink-0 w-44 bg-white border border-dashed border-gray-200 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 text-center"
          >
            <Gift size={18} className="text-gray-300" />
            <p className="text-xs text-gray-400 leading-tight">
              Visit a business and earn your first stamp
            </p>
          </Link>
        )}
      </div>
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
  const [city, setCity] = useState<string>('Budapest');
  const [selectedCity, setSelectedCity] = useState<string>('Budapest');
  const [loyaltySnippets, setLoyaltySnippets] = useState<LoyaltySnippet[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

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
      const userCity = profileRes.data?.city ?? '';
      setCity(userCity);
      // Use their saved city if it's a launch city, otherwise default to Budapest
      if (LAUNCH_CITIES.some(c => c.value === userCity)) {
        setSelectedCity(userCity);
      }

      // Fetch loyalty snippets for the strip
      if (studentRes.data?.id) {
        try {
          const res = await fetch(`/api/loyalty/stamp?student_id=${studentRes.data.id}`);
          if (res.ok) {
            const { stamps } = await res.json();
            // Group by offer, compute progress
            const grouped: Record<string, {
              vendor_name: string; logo_url: string | null;
              stamps: number; required: number; offer_id: string;
            }> = {};
            for (const s of stamps ?? []) {
              const key = s.offer_id;
              if (!grouped[key]) {
                const terms = s.offer?.terms_and_conditions ?? '';
                const match = terms.match(/^\[\[LOYALTY:(.*?)\]\]/);
                let req = 5;
                try { if (match) req = JSON.parse(match[1])?.required_visits ?? 5; } catch { /* ignore */ }
                grouped[key] = {
                  vendor_name: s.offer?.vendor?.business_name ?? 'Business',
                  logo_url: s.offer?.vendor?.logo_url ?? null,
                  stamps: 0,
                  required: req,
                  offer_id: s.offer_id,
                };
              }
              if (['stamp', 'reward_earned'].includes(s.status)) grouped[key].stamps++;
            }
            const snippets: LoyaltySnippet[] = Object.values(grouped).map((g) => ({
              vendor_name: g.vendor_name,
              logo_url: g.logo_url,
              stamps_in_cycle: g.stamps % g.required || (g.stamps > 0 ? g.required : 0),
              required_visits: g.required,
              offer_id: g.offer_id,
            }));
            setLoyaltySnippets(snippets.slice(0, 5));
          }
        } catch { /* silently fail */ }
      }
    };

    fetchUser();
  }, []);

  // ── Fetch offers (via API route — bypasses RLS so all auth users can browse)
  const fetchOffers = useCallback(async () => {
    setLoadingOffers(true);

    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    params.set('city', selectedCity);

    try {
      const res = await fetch(`/api/offers?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setOffers((json.offers as OfferWithVendor[]) ?? []);
      }
    } catch {
      // silently fail — empty state shown
    }

    setLoadingOffers(false);
  }, [selectedCategory, searchQuery, selectedCity]);

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

  // Refresh loyalty snippets after a new stamp
  const refreshLoyalty = async () => {
    if (!studentProfile?.id) return;
    try {
      const res = await fetch(`/api/loyalty/stamp?student_id=${studentProfile.id}`);
      if (!res.ok) return;
      const { stamps } = await res.json();
      const grouped: Record<string, {
        vendor_name: string; logo_url: string | null;
        stamps: number; required: number; offer_id: string;
      }> = {};
      for (const s of stamps ?? []) {
        const key = s.offer_id;
        if (!grouped[key]) {
          const terms = s.offer?.terms_and_conditions ?? '';
          const match = terms.match(/^\[\[LOYALTY:(.*?)\]\]/);
          let req = 5;
          try { if (match) req = JSON.parse(match[1])?.required_visits ?? 5; } catch { /* ignore */ }
          grouped[key] = {
            vendor_name: s.offer?.vendor?.business_name ?? 'Business',
            logo_url: s.offer?.vendor?.logo_url ?? null,
            stamps: 0,
            required: req,
            offer_id: s.offer_id,
          };
        }
        if (['stamp', 'reward_earned'].includes(s.status)) grouped[key].stamps++;
      }
      const snippets: LoyaltySnippet[] = Object.values(grouped).map((g) => ({
        vendor_name: g.vendor_name,
        logo_url: g.logo_url,
        stamps_in_cycle: g.stamps % g.required || (g.stamps > 0 ? g.required : 0),
        required_visits: g.required,
        offer_id: g.offer_id,
      }));
      setLoyaltySnippets(snippets.slice(0, 5));
    } catch { /* silently fail */ }
  };

  const firstName = user?.first_name ?? user?.display_name?.split(' ')[0] ?? 'there';
  const isVerified = studentProfile?.verification_status === 'verified';

  return (
    <>
      <AdminPreviewBanner />
      <Navbar />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
                  Hey {firstName}! 👋
                </h1>
                <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
                  <Building2 size={13} className="text-brand-400" />
                  Deals in {selectedCity}
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

          {/* ── CITY SWITCHER ──────────────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-5">
            <MapPin size={14} className="text-gray-400 flex-shrink-0" />
            <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
              {LAUNCH_CITIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setSelectedCity(c.value)}
                  className={`px-5 py-2 text-sm font-bold transition-colors ${
                    selectedCity === c.value
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 ml-1">More cities coming soon</span>
          </div>

          {/* ── VERIFICATION BANNER ────────────────────────────────────── */}
          {studentProfile && (
            <VerificationBanner status={studentProfile.verification_status} />
          )}

          {/* ── EARN STAMP CTA ─────────────────────────────────────────── */}
          <button
            onClick={() => setScannerOpen(true)}
            className="w-full mb-5 flex items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 rounded-2xl p-4 shadow-md hover:shadow-lg transition-all text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <QrCode size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-black text-base">Earn a Stamp</p>
              <p className="text-white/70 text-xs mt-0.5">Scan the QR code at the counter</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <ArrowRight size={15} className="text-white" />
            </div>
          </button>

          {/* ── LOYALTY STRIP ──────────────────────────────────────────── */}
          <LoyaltyStrip
            items={loyaltySnippets}
            studentProfileId={studentProfile?.id}
          />

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

      {/* ── EARN STAMP SCANNER ─────────────────────────────────────────── */}
      {scannerOpen && (
        <EarnStampScanner
          onClose={() => setScannerOpen(false)}
          onStampSuccess={() => {
            setScannerOpen(false);
            refreshLoyalty();
          }}
        />
      )}
    </>
  );
}
