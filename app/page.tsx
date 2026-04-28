'use client';

// =============================================================================
// app/page.tsx — Public landing page
// Shown to everyone who visits stud-deals.vercel.app before logging in.
// All CTAs link to real routes. Navbar is included so logged-in users can
// navigate straight to their dashboard.
// =============================================================================

import { useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap, Store, QrCode, Shield, TrendingUp, Zap,
  Star, MapPin, Clock, CheckCircle, ArrowRight,
  Search, Tag, Users, BarChart3, Sparkles,
  Coffee, Pizza, Dumbbell, BookOpen, Laptop, ShoppingBag,
  ChevronRight, Menu, X,
} from 'lucide-react';
import Navbar from '@/components/shared/Navbar';

// ─── Static data ──────────────────────────────────────────────────────────────

const STATS = [
  { label: 'Students saving',      value: '47,000+' },
  { label: 'Exclusive deals',       value: '2,400+' },
  { label: 'Partner businesses',   value: '380+' },
  { label: 'Avg. saving per year', value: '£340' },
];

const HOW_STUDENT = [
  {
    icon: <GraduationCap size={24} />,
    step: '01',
    title: 'Verify your student status',
    desc: 'Use your .edu or .ac.uk email for instant verification, or upload your student ID. One-time setup.',
  },
  {
    icon: <Search size={24} />,
    step: '02',
    title: 'Discover local deals',
    desc: 'Browse exclusive student offers from cafés, gyms, bookshops and more near your campus — updated weekly.',
  },
  {
    icon: <QrCode size={24} />,
    step: '03',
    title: 'Claim & redeem in seconds',
    desc: 'Tap claim, get your unique QR code, show it at the counter. No apps to download, no printing needed.',
  },
];

const HOW_VENDOR = [
  {
    icon: <Store size={24} />,
    step: '01',
    title: 'Create your business profile',
    desc: 'List your business, set your student discount, and go live in under 10 minutes. Completely free to start.',
  },
  {
    icon: <Tag size={24} />,
    step: '02',
    title: 'Students discover you',
    desc: 'Your deals appear in front of thousands of verified local students instantly. No ad spend required.',
  },
  {
    icon: <BarChart3 size={24} />,
    step: '03',
    title: 'Track your ROI in real time',
    desc: 'Use the built-in QR scanner to confirm redemptions. Live analytics show footfall, conversions and peak hours.',
  },
];

const FEATURES = [
  {
    icon: <Shield size={22} />,
    title: 'Fraud-proof verification',
    desc: 'Every student is verified via institutional email or photo ID. Vendors never get scammed by non-students.',
  },
  {
    icon: <Zap size={22} />,
    title: 'Instant redemption',
    desc: 'QR codes generate in real-time with a 24-hour expiry window — fast and seamless at the point of sale.',
  },
  {
    icon: <BarChart3 size={22} />,
    title: 'Live analytics dashboard',
    desc: 'See redemption rates, peak hours, and revenue impact. Know exactly which offers are driving foot traffic.',
  },
  {
    icon: <MapPin size={22} />,
    title: 'Hyper-local targeting',
    desc: 'Only students within range of your campus see your deals. Every impression is a relevant local student.',
  },
];

const SAMPLE_DEALS = [
  { emoji: '☕', title: '20% Off All Hot Drinks',      vendor: 'The Coffee House',  badge: '20% OFF',  category: 'Food & Drink', claimed: 89  },
  { emoji: '🍕', title: 'Student Meal Deal — £8',       vendor: 'Pizza Palace',      badge: '£5 OFF',   category: 'Food & Drink', claimed: 201 },
  { emoji: '🏋️', title: 'Free 7-Day Gym Trial',         vendor: 'City Gym',          badge: 'FREE',     category: 'Fitness',      claimed: 387 },
  { emoji: '📚', title: '15% Off All Textbooks',        vendor: 'Chapter & Verse',   badge: '15% OFF',  category: 'Books',        claimed: 134 },
  { emoji: '🍺', title: '30% Off Food — Thursdays',     vendor: 'The Pint & Plate',  badge: '30% OFF',  category: 'Food & Drink', claimed: 223 },
  { emoji: '☕', title: 'Free Pastry with Any Coffee',  vendor: 'The Coffee House',  badge: 'FREE ITEM',category: 'Food & Drink', claimed: 156 },
];

const TESTIMONIALS = [
  {
    quote: "I've saved over £200 this semester just on coffee and lunches near campus. Stud Deals is genuinely the best student app out there.",
    name: 'Priya S.',
    uni: 'UCL, 2nd Year',
    avatar: 'P',
  },
  {
    quote: "We saw a 40% increase in student footfall in the first month. The analytics are brilliant — I can see exactly which offers work.",
    name: 'Marco R.',
    uni: 'Pizza Palace, London',
    avatar: 'M',
    isVendor: true,
  },
  {
    quote: "Verified in 30 seconds with my .ac.uk email. The QR code at the counter is so smooth — staff love it too.",
    name: 'James O.',
    uni: 'King\'s College London, 3rd Year',
    avatar: 'J',
  },
];

// ─── Sample deal card (static, for landing preview) ───────────────────────────
function PreviewDealCard({ deal }: { deal: typeof SAMPLE_DEALS[0] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="h-32 bg-gradient-to-br from-brand-50 to-purple-50 flex items-center justify-center text-5xl relative">
        {deal.emoji}
        <span className="absolute top-3 left-3 bg-brand-600 text-white text-xs font-black px-2.5 py-1 rounded-lg">
          {deal.badge}
        </span>
      </div>
      <div className="p-4">
        <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full mb-2">
          {deal.category}
        </span>
        <h3 className="font-bold text-gray-900 text-sm leading-tight mb-0.5">{deal.title}</h3>
        <p className="text-xs text-gray-500 mb-3">{deal.vendor}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Users size={11} /> {deal.claimed} claimed
          </span>
          <Link
            href="/sign-up/student"
            className="bg-brand-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
          >
            Claim Deal
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#1e1b4b] text-white overflow-hidden">
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute top-20 left-1/4 w-80 h-80 bg-brand-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-60 h-60 bg-purple-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm mb-8">
            <Zap size={14} className="text-yellow-400" />
            <span>Trusted by 47,000+ verified students across the UK</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-black leading-[1.1] mb-6 max-w-3xl mx-auto">
            Student deals that{' '}
            <span
              style={{
                background: 'linear-gradient(135deg,#a78bfa,#8b5cf6,#6d28d9)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              actually work
            </span>
          </h1>

          <p className="text-xl text-purple-200 max-w-xl mx-auto mb-10 leading-relaxed">
            The hyper-local marketplace connecting verified students with exclusive discounts from campus businesses. No cards, no printing — just a QR code.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up/student"
              className="inline-flex items-center justify-center gap-2 bg-white text-brand-700 font-bold text-base px-8 py-3.5 rounded-2xl hover:bg-brand-50 transition-colors shadow-lg"
            >
              <GraduationCap size={20} />
              I&apos;m a Student — It&apos;s Free
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/sign-up/vendor"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl border-2 border-white/30 text-white font-bold text-base hover:bg-white/10 transition-colors"
            >
              <Store size={18} />
              List My Business
            </Link>
          </div>

          <p className="mt-5 text-purple-300 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-white underline underline-offset-2 hover:text-purple-200">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-brand-800 border-t border-brand-700">
        <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-brand-300 text-xs mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FEATURED DEALS PREVIEW
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full mb-3">
              Live Deals
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              What's available right now
            </h2>
            <p className="text-gray-500 max-w-md mx-auto text-sm">
              These are real live deals from verified businesses near London campuses. Sign up to unlock them all.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {SAMPLE_DEALS.map((deal) => (
              <PreviewDealCard key={deal.title} deal={deal} />
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/sign-up/student"
              className="inline-flex items-center gap-2 bg-brand-600 text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-brand-700 transition-colors shadow-sm"
            >
              <Sparkles size={18} />
              Sign up free to unlock all deals
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS — STUDENTS
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
              For Students
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Save money in 3 steps</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {HOW_STUDENT.map((s) => (
              <div key={s.step} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-4 text-brand-600">
                  {s.icon}
                </div>
                <div className="text-xs font-black text-brand-500 uppercase tracking-widest mb-2">
                  Step {s.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/sign-up/student"
              className="inline-flex items-center gap-2 bg-brand-600 text-white font-bold px-7 py-3 rounded-xl hover:bg-brand-700 transition-colors"
            >
              <GraduationCap size={18} />
              Get Started — Free Forever
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HOW IT WORKS — VENDORS
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 border-t border-b border-gray-100 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
              For Businesses
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Reach campus, grow revenue</h2>
            <p className="text-gray-500 mt-2 text-sm">Average vendor sees +34% student foot traffic in the first month</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {HOW_VENDOR.map((s) => (
              <div key={s.step} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4 text-green-700">
                  {s.icon}
                </div>
                <div className="text-xs font-black text-green-600 uppercase tracking-widest mb-2">
                  Step {s.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/sign-up/vendor"
              className="inline-flex items-center gap-2 bg-green-600 text-white font-bold px-7 py-3 rounded-xl hover:bg-green-700 transition-colors"
            >
              <Store size={18} />
              List Your Business Free
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6" id="how-it-works">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Built for the real world</h2>
            <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
              Every feature designed around one goal: making student discounts effortless for both sides.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-4 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 border-t border-gray-100 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-gray-900">What people are saying</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed flex-1 mb-5">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${t.isVendor ? 'bg-green-600' : 'bg-brand-600'}`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.uni}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm mb-8">
            <CheckCircle size={14} className="text-green-400" />
            Free to join · No credit card required
          </div>
          <h2 className="text-4xl sm:text-5xl font-black mb-5">
            Ready to start saving?
          </h2>
          <p className="text-brand-200 mb-10 text-lg max-w-lg mx-auto leading-relaxed">
            Join 47,000 students already saving with Stud Deals. Sign up in 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up/student"
              className="inline-flex items-center justify-center gap-2 bg-white text-brand-700 font-bold text-base px-8 py-3.5 rounded-2xl hover:bg-brand-50 transition-colors shadow-lg"
            >
              <GraduationCap size={20} />
              Start Saving — It&apos;s Free
            </Link>
            <Link
              href="/sign-up/vendor"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl border-2 border-white/40 font-bold text-base hover:bg-white/10 transition-colors"
            >
              <Store size={18} />
              List Your Business
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer className="bg-gray-950 text-gray-400 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
                <GraduationCap size={17} className="text-white" />
              </div>
              <span className="text-white font-black text-lg">
                Stud<span className="text-brand-400">Deals</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/sign-up/student" className="hover:text-white transition-colors">For Students</Link>
              <Link href="/sign-up/vendor"  className="hover:text-white transition-colors">For Businesses</Link>
              <Link href="/#how-it-works"   className="hover:text-white transition-colors">How it Works</Link>
              <Link href="/login"           className="hover:text-white transition-colors">Sign In</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
            © {new Date().getFullYear()} StudDeals. The student marketplace that just works.
          </div>
        </div>
      </footer>
    </div>
  );
}
