// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
// =============================================================================
// app/vendor/[slug]/page.tsx — Public Vendor Profile (React Server Component)
//
// Publicly accessible (no auth required).
// Converted from 'use client' + useEffect to an async RSC for:
//   • Faster initial page load (HTML is pre-rendered on the server)
//   • Full SEO — Google can index vendor name, city, offers, reviews
//   • No client-side waterfall — all DB queries run in parallel server-side
//
// Slug = vendor_profiles.slug (unique, URL-safe business name).
// Falls back to vendor_profiles.id if no slug is set.
// =============================================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import Navbar from '@/components/shared/Navbar';
import ShareButton from '@/components/vendor/ShareButton';
import { parseLoyaltyConfig } from '@/lib/utils/loyalty';
import { fmtDate } from '@/lib/currency';
import {
  MapPin, Star, Tag, Gift, Clock, ChevronRight,
  Store, CheckCircle, Users, ArrowRight, Zap,
  Coffee, ShoppingBag, Laptop, Dumbbell, Book, Shirt, Sparkles,
} from 'lucide-react';
import type { Metadata } from 'next';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PublicOffer {
  id: string;
  title: string;
  description: string | null;
  discount_label: string;
  category: string;
  terms_and_conditions: string | null;
  expires_at: string | null;
  view_count: number;
  redemption_count: number;
}

interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  vendor_reply: string | null;
  created_at: string;
}

// ── Metadata (SEO) ────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: vp } = await admin
    .from('vendor_profiles')
    .select('business_name, city, description')
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .maybeSingle();

  if (!vp) return { title: 'Vendor not found — Unideals' };

  return {
    title: `${vp.business_name} student deals${vp.city ? ` in ${vp.city}` : ''} — Unideals`,
    description:
      vp.description ??
      `Exclusive student discounts at ${vp.business_name}. Verify your student status and claim deals instantly.`,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  food_drink:       <Coffee size={14} />,
  groceries:        <ShoppingBag size={14} />,
  tech:             <Laptop size={14} />,
  fashion:          <Shirt size={14} />,
  fitness:          <Dumbbell size={14} />,
  books_stationery: <Book size={14} />,
  entertainment:    <Sparkles size={14} />,
};

const CATEGORY_LABEL: Record<string, string> = {
  food_drink:       'Food & Drink',
  groceries:        'Groceries',
  tech:             'Tech',
  fashion:          'Fashion',
  fitness:          'Fitness',
  books_stationery: 'Books',
  entertainment:    'Entertainment',
};

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
        />
      ))}
    </div>
  );
}

function OfferCard({ offer, isLoggedIn }: { offer: PublicOffer; isLoggedIn: boolean }) {
  const loyalty = parseLoyaltyConfig(offer.terms_and_conditions);
  const isLoyalty = loyalty?.mode === 'punch_card' || loyalty?.mode === 'tiered';
  const catIcon = CATEGORY_ICON[offer.category] ?? <Tag size={14} />;
  const catLabel = CATEGORY_LABEL[offer.category] ?? offer.category;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      <div className="relative bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-4">
        <p className="text-2xl font-black text-white leading-tight">{offer.discount_label}</p>
        {isLoyalty && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
            <Gift size={11} className="text-white" />
            <span className="text-[10px] text-white font-bold">Loyalty</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="font-bold text-gray-900 text-sm mb-1 line-clamp-1">{offer.title}</p>
        {offer.description && (
          <p className="text-xs text-gray-400 mb-3 line-clamp-2">{offer.description}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            {catIcon}{catLabel}
          </span>
          {offer.expires_at && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} />
              Expires {fmtDate(offer.expires_at)}
            </span>
          )}
        </div>

        {isLoyalty && loyalty && (
          <div className="mt-3 bg-brand-50 rounded-xl px-3 py-2 flex items-center gap-2">
            <Gift size={13} className="text-brand-600 flex-shrink-0" />
            <p className="text-xs text-brand-700 font-medium">
              Earn {loyalty.required_visits} stamps → {loyalty.reward_label ?? 'Free reward'}
            </p>
          </div>
        )}

        <Link
          href={isLoggedIn ? `/offer/${offer.id}` : `/sign-up?redirect=/offer/${offer.id}`}
          className="mt-3 w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors group-hover:bg-brand-700"
        >
          {isLoggedIn ? 'Claim deal' : 'Sign up to claim'}
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Stars rating={review.rating} />
        <span className="text-xs text-gray-400 ml-1">{fmtDate(review.created_at)}</span>
      </div>
      {review.title && <p className="font-semibold text-gray-900 text-sm mb-1">{review.title}</p>}
      {review.body && <p className="text-xs text-gray-500 leading-relaxed">{review.body}</p>}
      {review.vendor_reply && (
        <div className="mt-3 bg-gray-50 rounded-xl p-3 border-l-2 border-brand-300">
          <p className="text-[11px] font-bold text-brand-600 mb-1">Business reply</p>
          <p className="text-xs text-gray-600">{review.vendor_reply}</p>
        </div>
      )}
    </div>
  );
}

// ── Page (RSC) ────────────────────────────────────────────────────────────────

export default async function VendorPublicProfilePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Run all data fetches in parallel
  const admin = createAdminClient();
  const supabase = await createClient();

  const [{ data: vp }, { data: { user } }] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('id, business_name, logo_url, cover_photo_url, city, business_type, description, is_verified, slug')
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (!vp) notFound();

  // Fetch offers + reviews in parallel (vendor confirmed to exist)
  const [{ data: offerData }, { data: reviewData }] = await Promise.all([
    admin
      .from('offers')
      .select('id, title, description, discount_label, category, terms_and_conditions, expires_at, view_count, redemption_count')
      .eq('vendor_id', vp.id)
      .eq('status', 'active')
      .order('redemption_count', { ascending: false })
      .limit(6),
    admin
      .from('vendor_reviews')
      .select('id, rating, title, body, vendor_reply, created_at')
      .eq('vendor_id', vp.id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const offers: PublicOffer[] = offerData ?? [];
  const reviews: PublicReview[] = reviewData ?? [];
  const isLoggedIn = !!user;

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  const loyaltyOffer = offers.find(o => parseLoyaltyConfig(o.terms_and_conditions));
  const loyaltyConfig = loyaltyOffer ? parseLoyaltyConfig(loyaltyOffer.terms_and_conditions) : null;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 pb-16 pt-8">
          {vp.cover_photo_url && (
            <img
              src={vp.cover_photo_url}
              alt="cover"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
          )}
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
            <div className="flex items-start gap-4">
              {/* Logo */}
              {vp.logo_url ? (
                <img
                  src={vp.logo_url}
                  alt={vp.business_name}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-white/30 flex-shrink-0 shadow-xl"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-xl">
                  <Store size={32} className="text-white" />
                </div>
              )}

              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl font-black text-white">{vp.business_name}</h1>
                  {vp.is_verified && (
                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {vp.city && (
                    <span className="flex items-center gap-1 text-white/70 text-sm">
                      <MapPin size={13} />{vp.city}
                    </span>
                  )}
                  {vp.business_type && (
                    <span className="text-white/60 text-sm capitalize">{vp.business_type.replace('_', ' ')}</span>
                  )}
                  {avgRating !== null && (
                    <span className="flex items-center gap-1 text-white/80 text-sm font-semibold">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      {avgRating.toFixed(1)} ({reviews.length} reviews)
                    </span>
                  )}
                </div>
                {vp.description && (
                  <p className="text-white/70 text-sm mt-2 line-clamp-2">{vp.description}</p>
                )}
              </div>

              {/* Share button — client component for clipboard access */}
              <ShareButton />
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-5">
              <div className="text-center">
                <p className="text-lg font-black text-white">{offers.length}</p>
                <p className="text-[11px] text-white/60 font-medium">Active deals</p>
              </div>
              {loyaltyConfig && (
                <div className="text-center">
                  <p className="text-lg font-black text-white">{loyaltyConfig.required_visits}</p>
                  <p className="text-[11px] text-white/60 font-medium">Stamps for reward</p>
                </div>
              )}
              {avgRating !== null && (
                <div className="text-center">
                  <p className="text-lg font-black text-white">{avgRating.toFixed(1)}★</p>
                  <p className="text-[11px] text-white/60 font-medium">Avg rating</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-8 pb-12">

          {/* Loyalty teaser */}
          {loyaltyConfig && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-5 mb-6 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Gift size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Loyalty programme available</p>
                  <p className="text-white/80 text-xs mt-0.5">
                    Collect {loyaltyConfig.required_visits} stamps and earn: {loyaltyConfig.reward_label ?? 'a free reward'}
                  </p>
                </div>
                <Link
                  href={isLoggedIn ? `/offer/${loyaltyOffer?.id}` : `/sign-up?redirect=/offer/${loyaltyOffer?.id}`}
                  className="flex-shrink-0 bg-white text-amber-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-amber-50 transition-colors flex items-center gap-1.5"
                >
                  Start earning <ChevronRight size={12} />
                </Link>
              </div>
            </div>
          )}

          {/* Offers */}
          {offers.length > 0 ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black text-gray-900">Active deals</h2>
                <span className="text-xs text-gray-400">{offers.length} available</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {offers.map(offer => (
                  <OfferCard key={offer.id} offer={offer} isLoggedIn={isLoggedIn} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center mb-8">
              <Zap size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No active deals right now</p>
              <p className="text-gray-400 text-xs mt-1">Check back later — new offers are added regularly.</p>
            </div>
          )}

          {/* Sign-up CTA for guests */}
          {!isLoggedIn && (
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 mb-8 text-center">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users size={22} className="text-white" />
              </div>
              <h3 className="text-white font-black text-lg mb-1">Get exclusive student deals</h3>
              <p className="text-white/70 text-sm mb-5">
                Verify your student status once, then claim deals at {vp.business_name} and thousands of other venues.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/sign-up"
                  className="bg-white text-brand-700 font-bold text-sm px-5 py-3 rounded-xl hover:bg-brand-50 transition-colors"
                >
                  Create free account
                </Link>
                <Link
                  href="/sign-in"
                  className="border border-white/30 text-white font-semibold text-sm px-5 py-3 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Already have an account
                </Link>
              </div>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black text-gray-900">Student reviews</h2>
                {avgRating !== null && (
                  <div className="flex items-center gap-2">
                    <Stars rating={avgRating} />
                    <span className="text-sm font-bold text-gray-700">{avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
