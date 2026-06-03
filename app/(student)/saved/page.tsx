'use client';

// =============================================================================
// app/(student)/saved/page.tsx — Saved Offers (Bookmarks)
//
// Shows all offers the authenticated student has bookmarked.
// - Groups by category
// - Each card links to /offer/[id]
// - Unsave button with optimistic UI
// - Empty state with CTA to explore
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Heart, Tag, Store, Clock, Loader2, Sparkles,
  ChevronRight, Trash2, MapPin,
} from 'lucide-react';
import { fmtDate } from '@/lib/currency';

interface SavedOffer {
  id: string;          // saved_offers.id
  saved_at: string;
  offer: {
    id: string;
    title: string;
    discount_label: string;
    category: string;
    expires_at: string | null;
    status: string;
    vendor: {
      business_name: string;
      city: string;
      logo_url: string | null;
    };
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  food_drink: 'Food & Drink', groceries: 'Groceries', tech: 'Tech',
  fashion: 'Fashion', fitness: 'Fitness', books_stationery: 'Books',
  entertainment: 'Entertainment', health_beauty: 'Health & Beauty',
  transport: 'Transport', other: 'Other',
};

export default function SavedPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading]   = useState(true);
  const [saved, setSaved]       = useState<SavedOffer[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in?redirect=/saved'); return; }

      const { data: sp } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!sp) { setLoading(false); return; }

      const { data: rows } = await supabase
        .from('saved_offers')
        .select(`
          id,
          saved_at,
          offer:offers (
            id, title, discount_label, category, expires_at, status,
            vendor:vendor_profiles ( business_name, city, logo_url )
          )
        `)
        .eq('student_id', sp.id)
        .order('saved_at', { ascending: false });

      // Filter out any saved rows where the offer was deleted / is inactive
      const valid = (rows ?? []).filter(
        (r: any) => r.offer && r.offer.status !== 'deleted'
      ) as SavedOffer[];

      setSaved(valid);
      setLoading(false);
    })();
  }, []);

  const handleUnsave = async (savedId: string, offerId: string) => {
    setRemoving(prev => new Set(prev).add(savedId));
    // Optimistic
    setSaved(prev => prev.filter(s => s.id !== savedId));
    await fetch(`/api/offers/${offerId}/save`, { method: 'POST' });
    setRemoving(prev => { const n = new Set(prev); n.delete(savedId); return n; });
  };

  const active   = saved.filter(s => s.offer.status === 'active');
  const expired  = saved.filter(s => s.offer.status !== 'active');

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <Heart size={18} className="text-red-500 fill-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Saved Deals</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {saved.length === 0 ? 'No saved offers yet' : `${active.length} active · ${expired.length} expired`}
              </p>
            </div>
          </div>

          {saved.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Heart size={28} className="text-red-300" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Nothing saved yet</h2>
              <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
                Tap the heart icon on any deal to save it for later.
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors"
              >
                <Sparkles size={15} />
                Browse deals
                <ChevronRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="space-y-8">

              {/* Active offers */}
              {active.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                    Active ({active.length})
                  </h2>
                  <div className="space-y-3">
                    {active.map(s => (
                      <SavedCard
                        key={s.id}
                        item={s}
                        removing={removing.has(s.id)}
                        onUnsave={() => handleUnsave(s.id, s.offer.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Expired / paused offers */}
              {expired.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Expired / unavailable ({expired.length})
                  </h2>
                  <div className="space-y-3 opacity-60">
                    {expired.map(s => (
                      <SavedCard
                        key={s.id}
                        item={s}
                        removing={removing.has(s.id)}
                        onUnsave={() => handleUnsave(s.id, s.offer.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SavedCard({
  item, removing, onUnsave,
}: {
  item: SavedOffer;
  removing: boolean;
  onUnsave: () => void;
}) {
  const { offer } = item;
  const isActive = offer.status === 'active';
  const catLabel = CATEGORY_LABELS[offer.category] ?? offer.category;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex">
      {/* Discount band */}
      <div className={`w-2 flex-shrink-0 ${isActive ? 'bg-brand-500' : 'bg-gray-200'}`} />

      <div className="flex-1 p-4 flex items-center gap-4 min-w-0">
        {/* Logo */}
        {offer.vendor.logo_url ? (
          <img
            src={offer.vendor.logo_url}
            alt={offer.vendor.business_name}
            className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border border-gray-100"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
            <Store size={18} className="text-brand-600" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-black text-brand-600 text-sm">{offer.discount_label}</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{catLabel}</span>
          </div>
          <p className="font-semibold text-gray-900 text-sm truncate">{offer.title}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <MapPin size={10} />{offer.vendor.business_name} · {offer.vendor.city}
            </span>
            {offer.expires_at && isActive && (
              <span className="flex items-center gap-1">
                <Clock size={10} />Expires {fmtDate(offer.expires_at)}
              </span>
            )}
            {!isActive && (
              <span className="text-red-400 font-semibold">Expired</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isActive && (
            <Link
              href={`/offer/${offer.id}`}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              Claim
            </Link>
          )}
          <button
            onClick={onUnsave}
            disabled={removing}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            aria-label="Remove from saved"
          >
            {removing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
