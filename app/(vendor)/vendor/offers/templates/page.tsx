'use client';

// =============================================================================
// app/(vendor)/vendor/offers/templates/page.tsx — Offer Templates Library
//
// A curated library of pre-built offer templates grouped by business type.
// Vendors can preview a template and clone it into the create-offer flow
// with one click — pre-filling all form fields.
//
// Template data is static (no DB required). The clone action passes
// parameters via URL query string to /vendor/offers/create.
//
// Template types covered:
//   - Standard discount (%, fixed, BOGO)
//   - Punch card loyalty (various stamp counts)
//   - First visit bonus
//   - Flash / time-limited deals
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  ChevronLeft, Copy, ArrowRight, Search, Sparkles,
  Coffee, UtensilsCrossed, ShoppingBag, Dumbbell,
  Book, Shirt, Tag, Zap, Gift, Star, Trophy,
  Clock, Users, Percent, Stamp,
} from 'lucide-react';

// ── Template definitions ──────────────────────────────────────────────────────

interface OfferTemplate {
  id: string;
  title: string;
  description: string;
  type: 'standard' | 'punch_card' | 'first_visit' | 'milestone';
  category: string;
  businessTypes: string[];
  tag: string;
  tagColor: string;
  icon: React.ReactNode;
  highlight: string;
  params: Record<string, string>;
}

const TEMPLATES: OfferTemplate[] = [
  // ── Coffee / Café ──────────────────────────────────────────────────────────
  {
    id: 'coffee-punch-5',
    title: 'Buy 5 Coffees, Get 1 Free',
    description: 'The classic café loyalty card. Students earn a stamp with every coffee purchase and get their 6th free.',
    type: 'punch_card',
    category: 'food_drink',
    businessTypes: ['cafe', 'coffee_shop', 'food_drink'],
    tag: '⭐ Most popular',
    tagColor: 'bg-amber-100 text-amber-700',
    icon: <Coffee size={20} className="text-amber-600" />,
    highlight: '2.4× more repeat visits',
    params: {
      mode: 'punch_card',
      title: 'Buy 5 Coffees, Get 1 Free',
      required_visits: '5',
      reward_type: 'free_item',
      reward_label: 'Free coffee of your choice',
      category: 'food_drink',
    },
  },
  {
    id: 'cafe-10-off-student',
    title: '10% Student Discount',
    description: 'Simple and effective — every verified student gets 10% off. Works for any purchase, easy to communicate.',
    type: 'standard',
    category: 'food_drink',
    businessTypes: ['cafe', 'coffee_shop', 'restaurant', 'food_drink'],
    tag: 'Quick setup',
    tagColor: 'bg-blue-100 text-blue-700',
    icon: <Percent size={20} className="text-blue-600" />,
    highlight: 'Easy for staff to apply',
    params: {
      mode: 'standard',
      title: '10% Student Discount',
      discount_type: 'percentage',
      discount_value: '10',
      category: 'food_drink',
    },
  },
  {
    id: 'cafe-first-visit',
    title: 'Free Cake Slice on First Visit',
    description: 'Welcome new students with a free treat. Low cost, high impression — great for getting students through the door.',
    type: 'first_visit',
    category: 'food_drink',
    businessTypes: ['cafe', 'bakery', 'food_drink'],
    tag: 'New customer magnet',
    tagColor: 'bg-green-100 text-green-700',
    icon: <Gift size={20} className="text-green-600" />,
    highlight: 'Best for new venues',
    params: {
      mode: 'first_visit',
      title: 'Free Cake Slice on Your First Visit',
      reward_type: 'free_item',
      reward_label: 'Free slice of cake',
      category: 'food_drink',
    },
  },
  {
    id: 'restaurant-bogo',
    title: 'Buy One Main, Get One 50% Off',
    description: 'Great for lunch/dinner duos — encourages students to bring friends and increases average basket size.',
    type: 'standard',
    category: 'food_drink',
    businessTypes: ['restaurant', 'food_drink'],
    tag: 'Group friendly',
    tagColor: 'bg-purple-100 text-purple-700',
    icon: <UtensilsCrossed size={20} className="text-purple-600" />,
    highlight: 'Drives group visits',
    params: {
      mode: 'standard',
      title: 'Buy One Main, Get One 50% Off',
      discount_type: 'percentage',
      discount_value: '50',
      category: 'food_drink',
    },
  },

  // ── Retail / Fashion ───────────────────────────────────────────────────────
  {
    id: 'retail-15-off',
    title: '15% Off for Students',
    description: 'Attractive student discount for clothes, accessories, or general retail. Boosts footfall during term time.',
    type: 'standard',
    category: 'fashion',
    businessTypes: ['retail', 'fashion', 'clothing'],
    tag: 'High conversion',
    tagColor: 'bg-pink-100 text-pink-700',
    icon: <Shirt size={20} className="text-pink-600" />,
    highlight: 'Top pick for fashion stores',
    params: {
      mode: 'standard',
      title: '15% Student Discount',
      discount_type: 'percentage',
      discount_value: '15',
      category: 'fashion',
    },
  },
  {
    id: 'retail-spend-reward',
    title: 'Spend 10,000 HUF, Get 1,000 HUF Off',
    description: 'Milestone reward that drives higher basket sizes. Students work toward a spending goal and earn a cashback reward.',
    type: 'milestone',
    category: 'fashion',
    businessTypes: ['retail', 'fashion', 'general'],
    tag: 'Increases basket size',
    tagColor: 'bg-indigo-100 text-indigo-700',
    icon: <Trophy size={20} className="text-indigo-600" />,
    highlight: 'Lifts avg. order value',
    params: {
      mode: 'milestone',
      title: 'Spend 10,000 HUF, Get 1,000 HUF Off',
      spend_threshold: '10000',
      reward_type: 'fixed_amount',
      reward_value: '1000',
      reward_label: '1,000 HUF off your next visit',
      category: 'fashion',
    },
  },

  // ── Fitness / Gym ──────────────────────────────────────────────────────────
  {
    id: 'gym-punch-10',
    title: '10 Visits, Get 1 Free Session',
    description: 'Loyalty punch card for gyms and fitness studios. Keeps students consistent and coming back.',
    type: 'punch_card',
    category: 'fitness',
    businessTypes: ['gym', 'fitness', 'sport'],
    tag: 'Builds habit',
    tagColor: 'bg-orange-100 text-orange-700',
    icon: <Dumbbell size={20} className="text-orange-600" />,
    highlight: 'Ideal for membership venues',
    params: {
      mode: 'punch_card',
      title: '10 Visits, Get 1 Free Session',
      required_visits: '10',
      reward_type: 'free_item',
      reward_label: 'Free gym session or class',
      category: 'fitness',
    },
  },
  {
    id: 'gym-20-off',
    title: '20% Off Monthly Membership',
    description: 'Student membership discount. Ideal for gyms wanting to grow recurring revenue from local university students.',
    type: 'standard',
    category: 'fitness',
    businessTypes: ['gym', 'fitness', 'sport'],
    tag: 'Recurring revenue',
    tagColor: 'bg-teal-100 text-teal-700',
    icon: <Zap size={20} className="text-teal-600" />,
    highlight: 'Best for monthly memberships',
    params: {
      mode: 'standard',
      title: '20% Off Monthly Membership',
      discount_type: 'percentage',
      discount_value: '20',
      category: 'fitness',
    },
  },

  // ── Books / Stationery ─────────────────────────────────────────────────────
  {
    id: 'books-10-off',
    title: '10% Off All Stationery',
    description: 'Essential student discount for bookshops and stationery stores — especially popular at term start.',
    type: 'standard',
    category: 'books_stationery',
    businessTypes: ['bookshop', 'stationery', 'education'],
    tag: 'Back-to-term boost',
    tagColor: 'bg-cyan-100 text-cyan-700',
    icon: <Book size={20} className="text-cyan-600" />,
    highlight: 'Peaks in Sept & Jan',
    params: {
      mode: 'standard',
      title: '10% Off All Stationery',
      discount_type: 'percentage',
      discount_value: '10',
      category: 'books_stationery',
    },
  },
  {
    id: 'books-punch-5',
    title: 'Buy 5 Books, Get 1 Free',
    description: 'A reading loyalty reward — encourages students to keep coming back for their reading list and study materials.',
    type: 'punch_card',
    category: 'books_stationery',
    businessTypes: ['bookshop', 'education'],
    tag: 'Loyalty builder',
    tagColor: 'bg-emerald-100 text-emerald-700',
    icon: <Stamp size={20} className="text-emerald-600" />,
    highlight: 'Great for independent bookshops',
    params: {
      mode: 'punch_card',
      title: 'Buy 5 Books, Get 1 Free',
      required_visits: '5',
      reward_type: 'free_item',
      reward_label: 'Free book (up to 3,000 HUF value)',
      category: 'books_stationery',
    },
  },

  // ── Flash / Boost ──────────────────────────────────────────────────────────
  {
    id: 'flash-lunch-deal',
    title: 'Flash Lunch Deal — 25% Off 12–2pm',
    description: 'Time-limited discount during quiet hours. Drives footfall exactly when you need it most.',
    type: 'standard',
    category: 'food_drink',
    businessTypes: ['cafe', 'restaurant', 'food_drink'],
    tag: '⚡ Flash deal',
    tagColor: 'bg-yellow-100 text-yellow-700',
    icon: <Clock size={20} className="text-yellow-600" />,
    highlight: 'Fill quiet lunch slots',
    params: {
      mode: 'standard',
      title: 'Flash Lunch Deal — 25% Off 12–2pm',
      discount_type: 'percentage',
      discount_value: '25',
      category: 'food_drink',
    },
  },
  {
    id: 'general-punch-8',
    title: 'Classic 8-Stamp Loyalty Card',
    description: 'Versatile punch card that works for almost any business. Buy 8, get 1 free — simple enough that staff can explain it in seconds.',
    type: 'punch_card',
    category: 'other',
    businessTypes: ['general', 'other'],
    tag: 'Universal',
    tagColor: 'bg-gray-100 text-gray-700',
    icon: <Star size={20} className="text-gray-500" />,
    highlight: 'Works for any business type',
    params: {
      mode: 'punch_card',
      title: '8-Stamp Loyalty Card — 1 Free on Completion',
      required_visits: '8',
      reward_type: 'free_item',
      reward_label: 'Free item of your choice',
      category: 'other',
    },
  },
];

const FILTER_GROUPS = [
  { label: 'All templates', value: 'all', icon: <Sparkles size={14} /> },
  { label: 'Food & Drink',  value: 'food_drink', icon: <Coffee size={14} /> },
  { label: 'Fitness',       value: 'fitness', icon: <Dumbbell size={14} /> },
  { label: 'Fashion',       value: 'fashion', icon: <Shirt size={14} /> },
  { label: 'Books',         value: 'books_stationery', icon: <Book size={14} /> },
  { label: 'Other',         value: 'other', icon: <Tag size={14} /> },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  punch_card:   { label: 'Loyalty Card', color: 'bg-purple-100 text-purple-700' },
  standard:     { label: 'Discount',     color: 'bg-blue-100 text-blue-700' },
  first_visit:  { label: 'First Visit',  color: 'bg-green-100 text-green-700' },
  milestone:    { label: 'Milestone',    color: 'bg-indigo-100 text-indigo-700' },
};

export default function OfferTemplatesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const filtered = TEMPLATES.filter(t => {
    const matchCat  = filter === 'all' || t.category === filter;
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleUseTemplate = (t: OfferTemplate) => {
    const params = new URLSearchParams(t.params);
    router.push(`/vendor/offers/create?${params.toString()}`);
  };

  const preview = TEMPLATES.find(t => t.id === previewId);

  return (
    <>
      <Navbar/>
      <VendorNav/>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
              <ChevronLeft size={20}/>
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900">Offer Templates</h1>
              <p className="text-xs text-gray-400 mt-0.5">Pick a template and launch an offer in under 60 seconds</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-vendor-500"
            />
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
            {FILTER_GROUPS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  filter === f.value
                    ? 'bg-vendor-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-vendor-300'
                }`}
              >
                {f.icon}{f.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              >
                <div className="p-5 flex-1">
                  {/* Type + tag badges */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_LABELS[t.type].color}`}>
                      {TYPE_LABELS[t.type].label}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.tagColor}`}>
                      {t.tag}
                    </span>
                  </div>

                  {/* Icon + title */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                      {t.icon}
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 leading-snug">{t.title}</h3>
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed mb-4">{t.description}</p>

                  {/* Highlight stat */}
                  <div className="bg-vendor-50 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Sparkles size={12} className="text-vendor-600 flex-shrink-0"/>
                    <span className="text-[11px] font-semibold text-vendor-700">{t.highlight}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-50 p-4 flex gap-2">
                  <button
                    onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                    className="flex-1 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors hover:border-gray-300"
                  >
                    {previewId === t.id ? 'Hide' : 'Preview'}
                  </button>
                  <button
                    onClick={() => handleUseTemplate(t)}
                    className="flex-1 py-2 text-xs font-bold text-white bg-vendor-600 hover:bg-vendor-700 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Copy size={12}/>Use template
                  </button>
                </div>

                {/* Inline preview panel */}
                {previewId === t.id && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 text-xs text-gray-600 space-y-2">
                    <p className="font-bold text-gray-800 mb-2">What will be pre-filled:</p>
                    {Object.entries(t.params)
                      .filter(([k]) => k !== 'mode')
                      .map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-semibold text-gray-700 text-right ml-4 truncate max-w-[180px]">{val}</span>
                        </div>
                      ))
                    }
                    <button
                      onClick={() => handleUseTemplate(t)}
                      className="w-full mt-3 py-2.5 text-xs font-bold text-white bg-vendor-600 hover:bg-vendor-700 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      Start with this template <ArrowRight size={12}/>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-gray-400">
                <Tag size={32} className="mx-auto mb-3 opacity-40"/>
                <p className="font-semibold">No templates match your search</p>
                <p className="text-xs mt-1">Try a different category or create an offer from scratch</p>
                <Link href="/vendor/offers/create" className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-vendor-600 hover:text-vendor-700">
                  Create from scratch <ArrowRight size={12}/>
                </Link>
              </div>
            )}
          </div>

          {/* Create from scratch CTA */}
          <div className="mt-8 bg-gradient-to-r from-vendor-600 to-emerald-700 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1">
              <p className="font-bold mb-1">Don't see what you need?</p>
              <p className="text-sm text-white/70">Build a fully custom offer from scratch — all offer types, loyalty configs, and scheduling available.</p>
            </div>
            <Link
              href="/vendor/offers/create"
              className="flex-shrink-0 flex items-center gap-2 bg-white text-vendor-700 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-vendor-50 transition-colors"
            >
              Create custom offer <ArrowRight size={14}/>
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
