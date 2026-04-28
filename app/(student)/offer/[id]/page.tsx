'use client';

// =============================================================================
// app/(student)/offer/[id]/page.tsx — Offer Detail & Claim
// Full offer info page. Student sees all details then taps "Get Voucher"
// which hits POST /api/redemptions/claim and shows the QR voucher modal.
// =============================================================================

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VoucherModal from '@/components/student/VoucherModal';
import {
  ArrowLeft, MapPin, Clock, Tag, Store, Shield, Heart,
  AlertCircle, Loader2, CheckCircle, Sparkles, QrCode,
  Calendar, Users, Star, Coffee, ShoppingBag, Laptop,
  Dumbbell, Book, Shirt,
} from 'lucide-react';
import type { OfferWithVendor, ClaimOfferResponse } from '@/lib/types/database.types';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  food_drink:       { label: 'Food & Drink',    icon: <Coffee size={14} />,     color: 'text-amber-700',  bg: 'bg-amber-100' },
  groceries:        { label: 'Groceries',        icon: <ShoppingBag size={14} />,color: 'text-green-700',  bg: 'bg-green-100' },
  tech:             { label: 'Tech',             icon: <Laptop size={14} />,     color: 'text-blue-700',   bg: 'bg-blue-100' },
  fashion:          { label: 'Fashion',          icon: <Shirt size={14} />,      color: 'text-pink-700',   bg: 'bg-pink-100' },
  fitness:          { label: 'Fitness',          icon: <Dumbbell size={14} />,   color: 'text-teal-700',   bg: 'bg-teal-100' },
  books_stationery: { label: 'Books',            icon: <Book size={14} />,       color: 'text-yellow-700', bg: 'bg-yellow-100' },
  entertainment:    { label: 'Entertainment',    icon: <Sparkles size={14} />,   color: 'text-purple-700', bg: 'bg-purple-100' },
  health_beauty:    { label: 'Health & Beauty',  icon: <Sparkles size={14} />,   color: 'text-rose-700',   bg: 'bg-rose-100' },
  other:            { label: 'Other',            icon: <Tag size={14} />,        color: 'text-gray-700',   bg: 'bg-gray-100' },
};

function timeUntil(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days < 7) return `${days} days left`;
  return `Expires ${new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [offer, setOffer]               = useState<OfferWithVendor | null>(null);
  const [loading, setLoading]           = useState(true);
  const [claiming, setClaiming]         = useState(false);
  const [claimError, setClaimError]     = useState('');
  const [voucher, setVoucher]           = useState<ClaimOfferResponse | null>(null);
  const [isSaved, setIsSaved]           = useState(false);
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<string>('unverified');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      // Fetch offer with vendor info
      const { data } = await supabase
        .from('offers')
        .select(`
          *,
          vendor:vendor_profiles (
            id, business_name, city, state, address_line1,
            logo_url, cover_image_url, is_verified, description,
            business_type, website_url
          )
        `)
        .eq('id', id)
        .single();

      if (!data) { router.push('/dashboard'); return; }
      setOffer(data as unknown as OfferWithVendor);

      if (user) {
        // Check saved status
        const { data: saved } = await supabase
          .from('saved_offers')
          .select('id')
          .eq('user_id', user.id)
          .eq('offer_id', id)
          .maybeSingle();
        setIsSaved(!!saved);

        // Check verification status
        const { data: sp } = await supabase
          .from('student_profiles')
          .select('verification_status')
          .eq('user_id', user.id)
          .maybeSingle();
        setVerifyStatus(sp?.verification_status ?? 'unverified');
      }

      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    if (!isLoggedIn) { router.push('/login'); return; }
    const newState = !isSaved;
    setIsSaved(newState);
    if (newState) {
      await supabase.from('saved_offers').insert({ offer_id: id });
    } else {
      await supabase.from('saved_offers').delete().eq('offer_id', id);
    }
  };

  const handleClaim = async () => {
    if (!isLoggedIn) { router.push(`/login?redirect=/offer/${id}`); return; }
    setClaiming(true);
    setClaimError('');

    try {
      const res = await fetch('/api/redemptions/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setVoucher(data as ClaimOfferResponse);
      }
    } catch {
      setClaimError('Network error. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </>
    );
  }

  if (!offer) return null;

  const cat = CATEGORY_CONFIG[offer.category] ?? CATEGORY_CONFIG.other;
  const vendor = offer.vendor as OfferWithVendor['vendor'];
  const isExpired = offer.expires_at ? new Date(offer.expires_at) < new Date() : false;
  const isActive  = offer.status === 'active' && !isExpired;

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-gray-50">

        {/* Hero / cover */}
        <div className="relative h-52 sm:h-64 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 overflow-hidden">
          {vendor?.cover_image_url && (
            <img src={vendor.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Back button */}
          <div className="absolute top-4 left-4">
            <button onClick={() => router.back()} className="w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors">
              <ArrowLeft size={18} />
            </button>
          </div>

          {/* Save button */}
          <div className="absolute top-4 right-4">
            <button onClick={handleSave} className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
              isSaved ? 'bg-red-500 text-white' : 'bg-black/30 text-white hover:bg-black/50'
            }`}>
              <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Discount badge */}
          <div className="absolute bottom-4 left-4">
            <div className="inline-flex items-center gap-2 bg-purple-600 text-white text-lg font-black px-4 py-2 rounded-2xl shadow-lg">
              <Tag size={18} />
              {offer.discount_label}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-4 pb-32">

          {/* Main card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">

            {/* Vendor header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {vendor?.logo_url
                  ? <img src={vendor.logo_url} alt={vendor?.business_name} className="w-full h-full object-cover" />
                  : <Store size={22} className="text-purple-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-gray-900 text-sm truncate">{vendor?.business_name}</p>
                  {vendor?.is_verified && <CheckCircle size={13} className="text-green-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={10} />
                  {vendor?.city}{vendor?.state ? `, ${vendor.state}` : ''}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cat.bg} ${cat.color}`}>
                {cat.icon} {cat.label}
              </span>
            </div>

            {/* Offer content */}
            <div className="px-5 py-5">
              <h1 className="text-xl font-black text-gray-900 mb-2">{offer.title}</h1>
              {offer.description && (
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{offer.description}</p>
              )}

              {/* Meta badges */}
              <div className="flex flex-wrap gap-2 mb-5">
                {offer.expires_at && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
                    isExpired ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Clock size={12} /> {timeUntil(offer.expires_at)}
                  </span>
                )}
                {offer.max_uses_per_student && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg">
                    <Users size={12} /> Max {offer.max_uses_per_student}× per student
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg">
                  <QrCode size={12} /> Show QR at till
                </span>
                {vendor?.is_verified && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-50 text-green-600 px-2.5 py-1.5 rounded-lg">
                    <Shield size={12} /> Verified business
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-gray-900">{offer.redemption_count ?? 0}</p>
                  <p className="text-xs text-gray-500">Redemptions</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-black text-gray-900">{offer.view_count ?? 0}</p>
                  <p className="text-xs text-gray-500">Students viewed</p>
                </div>
              </div>

              {/* Terms */}
              {offer.terms_and_conditions && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Shield size={12} /> Terms & Conditions
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">{offer.terms_and_conditions}</p>
                </div>
              )}

              {/* Verification nudge */}
              {isLoggedIn && verifyStatus !== 'verified' && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Verify your student status to claim</p>
                    <Link href="/verification" className="text-xs text-amber-700 underline underline-offset-2">
                      Verify now →
                    </Link>
                  </div>
                </div>
              )}

              {/* Error */}
              {claimError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">{claimError}</p>
                </div>
              )}
            </div>
          </div>

          {/* About the vendor */}
          {vendor?.description && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Store size={14} className="text-gray-500" /> About {vendor.business_name}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">{vendor.description}</p>
              {vendor.website_url && (
                <a href={vendor.website_url} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-purple-600 font-medium hover:underline flex items-center gap-1">
                  Visit website →
                </a>
              )}
            </div>
          )}

          {/* Location */}
          {vendor?.address_line1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
              <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <MapPin size={14} className="text-gray-500" /> Location
              </h2>
              <p className="text-sm text-gray-600">{vendor.address_line1}</p>
              {vendor.city && <p className="text-sm text-gray-600">{vendor.city}{vendor.state ? `, ${vendor.state}` : ''}</p>}
            </div>
          )}
        </div>

        {/* ── STICKY BOTTOM CTA ──────────────────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-4 py-4 safe-bottom">
          <div className="max-w-2xl mx-auto">
            {!isLoggedIn ? (
              <div className="flex gap-3">
                <Link href={`/login?redirect=/offer/${id}`} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl text-center text-sm transition-colors">
                  Sign in to claim
                </Link>
                <Link href="/sign-up/student" className="flex-1 border border-purple-200 hover:border-purple-400 text-purple-700 font-bold py-3.5 rounded-xl text-center text-sm transition-colors">
                  Create account
                </Link>
              </div>
            ) : !isActive ? (
              <button disabled className="w-full bg-gray-200 text-gray-500 font-bold py-3.5 rounded-xl text-sm cursor-not-allowed">
                {isExpired ? 'This offer has expired' : 'Offer unavailable'}
              </button>
            ) : (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
              >
                {claiming ? (
                  <><Loader2 size={16} className="animate-spin" /> Generating voucher...</>
                ) : (
                  <><QrCode size={16} /> Get voucher — {offer.discount_label}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Voucher modal */}
      {voucher && <VoucherModal voucher={voucher} onClose={() => setVoucher(null)} />}
    </>
  );
}
