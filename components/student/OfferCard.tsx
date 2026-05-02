'use client';

// =============================================================================
// components/student/OfferCard.tsx
// The primary offer tile shown in the student browse grid.
// Clicking opens the Offer Detail page where they can claim a voucher.
// Supports save/favourite toggling with optimistic UI updates.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Heart, Clock, Tag, Coffee, ShoppingBag, Laptop, UtensilsCrossed, Dumbbell, Book, Sparkles } from 'lucide-react';
import type { OfferWithVendor } from '@/lib/types/database.types';

interface OfferCardProps {
  offer: OfferWithVendor;
  isSaved?: boolean;
  onSaveToggle?: (offerId: string, newState: boolean) => void;
}

// Category icon and colour mapping
const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  food_drink:       { icon: <Coffee size={12} />,         color: 'text-amber-700',  bg: 'bg-amber-100' },
  groceries:        { icon: <ShoppingBag size={12} />,    color: 'text-green-700',  bg: 'bg-green-100' },
  tech:             { icon: <Laptop size={12} />,         color: 'text-blue-700',   bg: 'bg-blue-100' },
  fashion:          { icon: <Sparkles size={12} />,       color: 'text-pink-700',   bg: 'bg-pink-100' },
  entertainment:    { icon: <Sparkles size={12} />,       color: 'text-purple-700', bg: 'bg-purple-100' },
  health_beauty:    { icon: <Sparkles size={12} />,       color: 'text-rose-700',   bg: 'bg-rose-100' },
  transport:        { icon: <MapPin size={12} />,         color: 'text-indigo-700', bg: 'bg-indigo-100' },
  books_stationery: { icon: <Book size={12} />,           color: 'text-yellow-700', bg: 'bg-yellow-100' },
  fitness:          { icon: <Dumbbell size={12} />,       color: 'text-teal-700',   bg: 'bg-teal-100' },
  other:            { icon: <Tag size={12} />,            color: 'text-gray-700',   bg: 'bg-gray-100' },
};

export function formatCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    food_drink: 'Food & Drink', groceries: 'Groceries', tech: 'Tech',
    fashion: 'Fashion', entertainment: 'Entertainment', health_beauty: 'Health',
    transport: 'Transport', books_stationery: 'Books', fitness: 'Fitness', other: 'Other',
  };
  return labels[cat] ?? cat;
}

export default function OfferCard({ offer, isSaved = false, onSaveToggle }: OfferCardProps) {
  const [saved, setSaved] = useState(isSaved);
  const [saving, setSaving] = useState(false);

  const catConfig = CATEGORY_CONFIG[offer.category] ?? CATEGORY_CONFIG.other;

  // Compute expiry label
  const expiryLabel = (): string | null => {
    if (!offer.expires_at) return null;
    const diff = new Date(offer.expires_at).getTime() - Date.now();
    if (diff < 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Expires today';
    if (days <= 3) return `${days}d left`;
    return null; // Don't show label if plenty of time
  };

  const urgencyLabel = expiryLabel();

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.preventDefault(); // Don't navigate
    e.stopPropagation();
    if (saving) return;

    const newState = !saved;
    setSaved(newState); // Optimistic update
    setSaving(true);

    try {
      const res = await fetch(`/api/offers/${offer.id}/save`, {
        method: newState ? 'POST' : 'DELETE',
      });
      if (!res.ok) setSaved(!newState); // Revert on failure
      else onSaveToggle?.(offer.id, newState);
    } catch (_) {
      setSaved(!newState);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Link
      href={`/offer/${offer.id}`}
      className="group card-hover flex flex-col overflow-hidden h-full"
    >
      {/* Image area */}
      <div className="relative h-40 bg-gradient-to-br from-brand-100 to-brand-200 overflow-hidden flex-shrink-0">
        {offer.image_url ? (
          <Image
            src={offer.image_url}
            alt={offer.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          // Placeholder with category icon
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-200/60 flex items-center justify-center text-brand-500">
              <span className="scale-150">{catConfig.icon}</span>
            </div>
          </div>
        )}

        {/* Discount badge — always visible */}
        <div className="discount-badge">
          {offer.discount_label}
        </div>

        {/* Urgency label */}
        {urgencyLabel && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-full">
            <Clock size={10} />
            {urgencyLabel}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSaveToggle}
          disabled={saving}
          aria-label={saved ? 'Unsave offer' : 'Save offer'}
          className={`absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 shadow-sm
            ${saved ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-400 hover:text-red-500'}`}
        >
          <Heart size={14} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Content area */}
      <div className="p-4 flex flex-col flex-1">
        {/* Vendor name + category */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {offer.vendor.logo_url ? (
              <Image
                src={offer.vendor.logo_url}
                alt={offer.vendor.business_name}
                width={18}
                height={18}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-4.5 h-4.5 rounded-full bg-gray-200" />
            )}
            <span className="text-xs font-medium text-gray-500 truncate max-w-[100px]">
              {offer.vendor.business_name}
            </span>
          </div>

          {/* Category pill */}
          <span className={`category-badge ${catConfig.bg} ${catConfig.color}`}>
            {catConfig.icon}
            <span className="hidden sm:inline">{formatCategoryLabel(offer.category)}</span>
          </span>
        </div>

        {/* Offer title */}
        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-2 flex-1">
          {offer.title}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 text-gray-400 text-xs mt-auto">
          <MapPin size={11} />
          <span className="truncate">{offer.vendor.address_line1 ? `${offer.vendor.address_line1}, ` : ''}{offer.vendor.city}</span>
        </div>

        {/* Stats row */}
        {offer.view_count > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{offer.view_count.toLocaleString()} views</span>
            {offer.redemption_count > 0 && (
              <span className="text-brand-600 font-medium">{offer.redemption_count} claimed</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
