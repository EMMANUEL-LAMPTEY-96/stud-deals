// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
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
import AchievementBadges from '@/components/student/AchievementBadges';
import SavingsHero from '@/components/student/SavingsHero';
import {
  GraduationCap, MapPin, Search, SlidersHorizontal,
  Sparkles, Trophy, AlertTriangle, ArrowRight, Loader2,
  Coffee, ShoppingBag, Laptop, UtensilsCrossed, Dumbbell,
  Book, Tag, Shirt, Gift, Cake, X, Star, Flame, Clock, Zap,
} from 'lucide-react';
import Link from 'next/link';
import type {
  OfferWithVendor, StudentProfile, Profile,
  OfferCategory, ClaimOfferResponse
} from '@/lib/types/database.types';
import { fmtHUF, fmtEUR } from '@/lib/currency';

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

// ── Discover / Trending types ─────────────────────────────────────────────────

interface DiscoverOffer {
  id: string;
  title: string;
  category: string | null;
  discount_value: number | null;
  discount_type: string | null;
  expires_at: string | null;
  claim_count: number;
  business_name: string | null;
  city: string | null;
  logo_url: string | null;
}

interface DiscoverData {
  trending:      DiscoverOffer[];
  expiring_soon: DiscoverOffer[];
  new_this_week: DiscoverOffer[];
}

// ── Discover section pill ─────────────────────────────────────────────────────

function DiscoverPill({ offer, badge }: { offer: DiscoverOffer; badge?: React.ReactNode }) {
  const discount =
    offer.discount_value != null
      ? offer.discount_type === 'percentage'
        ? `${offer.discount_value}%`
        : `${offer.discount_value.toLocaleString('hu-HU')} HUF`
      : null;

  return (
    <Link
      href={`/offer/${offer.id}`}
      className="flex-shrink-0 w-44 bg-white border border-gray-100 rounded-2xl p-3 hover:border-purple-200 hover:shadow-md transition-all duration-150 group"
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
          {offer.logo_url
            ? <img src={offer.logo_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-lg">{CATEGORY_EMOJI[offer.category ?? ''] ?? '🏷️'}</span>
          }
        </div>
        {badge}
      </div>
      <p className="text-xs font-bold text-gray-800 leading-tight line-clamp-2 group-hover:text-purple-700 transition-colors mb-1">
        {offer.title}
      </p>
      <p className="text-xs text-gray-400 truncate">{offer.business_name}</p>
      {discount && (
        <span className="mt-1.5 inline-block bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
          {discount} off
        </span>
      )}
    </Link>
  );
}

const CATEGORY_EMOJI: Record<string, string> = {
  food_drink:       '☕',
  groceries:        '🛒',
  tech:             '💻',
  books_stationery: '📚',
  fitness:          '🏋️',
  fashion:          '👗',
  other:            '🏷️',
};

function DiscoverRow({
  title, icon, offers, emptyMsg,
}: {
  title: string;
  icon: React.ReactNode;
  offers: DiscoverOffer[];
  emptyMsg: string;
  badgeFn?: (o: DiscoverOffer) => React.ReactNode;
}) {
  if (offers.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {offers.map((o) => {
          let badge: React.ReactNode = null;
          if (o.claim_count > 0) {
            badge = (
              <span className="ml-auto flex items-center gap-0.5 bg-orange-50 text-orange-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                <Flame size={8} /> {o.claim_count}
              </span>
            );
          }
          if (o.expires_at) {
            const hoursLeft = Math.max(0, Math.ceil(
              (new Date(o.expires_at).getTime() - Date.now()) / 3_600_000
            ));
            badge = (
              <span className="ml-auto flex items-center gap-0.5 bg-red-50 text-red-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                <Clock size={8} /> {hoursLeft}h
              </span>
            );
          }
          return <DiscoverPill key={o.id} offer={o} badge={badge} />;
        })}
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
  const [city, setCity] = useState<string>('');
  const [showEUR, setShowEUR] = useState(false);

  // Discover / trending state
  const [discover, setDiscover] = useState<DiscoverData | null>(null);

  // Birthday modal state
  const [birthdayData, setBirthdayData] = useState<{
    is_birthday: boolean; has_dob: boolean; claimed: boolean;
    top_vendor: { id: string; business_name: string; logo_url: string | null } | null;
    bonus_stamps: number;
  } | null>(null);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [claimingBirthday, setClaimingBirthday] = useState(false);
  const [birthdayClaimed, setBirthdayClaimed] = useState(false);

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

      // Check for birthday bonus (verified students only)
      if (studentRes.data?.verification_status === 'verified') {
        fetch('/api/birthday')
          .then(r => r.json())
          .then(d => {
            setBirthdayData(d);
            if (d.is_birthday && !d.claimed) setShowBirthdayModal(true);
          })
          .catch(() => {});

        // Fetch discover / trending data
        fetch('/api/offers/discover')
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setDiscover(d); })
          .catch(() => {});
      }
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
        body: JSON.stringify({
          offer_id: offerId,
          device_type: typeof window !== 'undefined'
            ? window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop'
            : 'mobile',
        }),
      });

      const data: ClaimOfferResponse & { error?: string } = await res.json();

      if (!res.ok || data.error) {
        alert(data.error ?? 'Failed to claim voucher. Please try again.');
        return;
      }

      setActiveVoucher(data);
    } catch (_) {
      alert('Network error. Please check your connection and try again.');
    } finally {
      setClaimingId(null);
    }
  };

  // ── Claim birthday reward ─────────────────────────────────────────────────
  const handleClaimBirthday = async () => {
    setClaimingBirthday(true);
    try {
      const res = await fetch('/api/birthday', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to claim birthday reward');
      setBirthdayClaimed(true);
      setBirthdayData(prev => prev ? { ...prev, claimed: true } : prev);
    } catch (err) {
      console.error(err);
    } finally {
      setClaimingBirthday(false);
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

              {/* placeholder — SavingsHero renders below */}
              <div />
            </div>
          </div>

          {/* ── VERIFICATION BANNER ────────────────────────────────────── */}
          {studentProfile && (
            <VerificationBanner status={studentProfile.verification_status} />
          )}

          {/* ── ACHIEVEMENT BADGES ─────────────────────────────────────── */}
          {studentProfile?.id && studentProfile.verification_status === 'verified' && (
            <AchievementBadges studentProfileId={studentProfile.id} />
          )}

          {/* ── SAVINGS HERO ───────────────────────────────────────────── */}
          {studentProfile?.id && studentProfile.verification_status === 'verified' && (
            <SavingsHero
              studentProfileId={studentProfile.id}
              institutionId={studentProfile.institution_id}
              showEUR={showEUR}
              onToggleCurrency={() => setShowEUR(v => !v)}
            />
          )}

          {/* ── REFERRAL TEASER CARD ───────────────────────────────────── */}
          {isVerified && (
            <Link
              href="/referral"
              className="group flex items-center gap-4 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-200 hover:border-purple-400 rounded-2xl px-5 py-4 mb-5 transition-all duration-200 hover:shadow-md"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                <Gift className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Invite friends, earn bonus stamps</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  You and your friend both get <strong>+2 stamps</strong> when they claim their first deal.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-400 group-hover:text-purple-600 flex-shrink-0 transition-colors" />
            </Link>
          )}

          {/* ── DISCOVER SECTION ──────────────────────────────────────── */}
          {isVerified && discover && (
            <div className="mb-2">
              <DiscoverRow
                title="Trending this week"
                icon={<Flame size={14} className="text-orange-500" />}
                offers={discover.trending}
                emptyMsg=""
              />
              <DiscoverRow
                title="Expiring soon"
                icon={<Clock size={14} className="text-red-500" />}
                offers={discover.expiring_soon}
                emptyMsg=""
              />
              <DiscoverRow
                title="New this week"
                icon={<Zap size={14} className="text-yellow-500" />}
                offers={discover.new_this_week}
                emptyMsg=""
              />
            </div>
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

      {/* ── BIRTHDAY MODAL ─────────────────────────────────────────────── */}
      {showBirthdayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !claimingBirthday && setShowBirthdayModal(false)}
          />

          {/* Card */}
          <div className="relative w-full max-w-sm bg-gradient-to-br from-[#1a1040] to-[#0f0b2e] border border-purple-500/40 rounded-3xl p-7 text-center shadow-2xl">
            {/* Close */}
            {!claimingBirthday && (
              <button
                onClick={() => setShowBirthdayModal(false)}
                className="absolute top-4 right-4 text-purple-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* Cake emoji + confetti stars */}
            <div className="relative mb-4">
              <div className="text-6xl mb-2">🎂</div>
              <div className="flex justify-center gap-2 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">
              Happy Birthday, {firstName}! 🎉
            </h2>
            <p className="text-purple-300 text-sm mb-5">
              {birthdayClaimed
                ? `${birthdayData?.bonus_stamps ?? 3} bonus stamps have been added to your${birthdayData?.top_vendor ? ` ${birthdayData.top_vendor.business_name}` : ''} punch card. Keep collecting!`
                : `You have a birthday gift waiting — ${birthdayData?.bonus_stamps ?? 3} free bonus stamps${birthdayData?.top_vendor ? ` for ${birthdayData.top_vendor.business_name}` : ''}!`}
            </p>

            {!birthdayClaimed ? (
              <button
                onClick={handleClaimBirthday}
                disabled={claimingBirthday}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                {claimingBirthday ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Claiming...</>
                ) : (
                  <><Cake className="w-4 h-4" /> Claim my birthday gift</>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 bg-green-500/15 border border-green-500/30 rounded-xl py-3 text-green-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" /> Stamps credited — enjoy your birthday!
                </div>
                <button
                  onClick={() => setShowBirthdayModal(false)}
                  className="w-full text-purple-400 hover:text-white text-sm py-2 transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {/* Settings nudge */}
            {!birthdayClaimed && (
              <p className="text-xs text-purple-500 mt-4">
                Reward resets automatically each year 🎈
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
