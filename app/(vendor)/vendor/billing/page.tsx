'use client';

// =============================================================================
// app/(vendor)/vendor/billing/page.tsx
//
// Vendor billing & subscription management page.
// Shows current plan status, monthly/annual pricing toggle, upgrade CTAs,
// and links to the Stripe customer portal for active subscribers.
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  CreditCard, Zap, Star, CheckCircle2, Clock, AlertTriangle,
  ExternalLink, Crown, XCircle, ChevronRight, Loader2, X,
} from 'lucide-react';
import type { PlanTier, PlanStatus } from '@/lib/utils/plan-tier';
import { PLAN_PRICES_HUF, trialDaysRemaining } from '@/lib/utils/plan-tier';
import { fmtHUF } from '@/lib/currency';

interface VendorPlan {
  plan_tier:    PlanTier;
  plan_status:  PlanStatus;
  trial_ends_at: string | null;
}

// ── Annual pricing (2 months free = ~17% off) ─────────────────────────────────
const ANNUAL_PRICES_HUF: Record<'growth' | 'pro', number> = {
  growth: 139_900,
  pro:    279_900,
};

// ── Plan status badge ─────────────────────────────────────────────────────────
function PlanBadge({ status, tier }: { status: PlanStatus; tier: PlanTier }) {
  const configs: Record<PlanStatus, { label: string; cls: string }> = {
    active:    { label: 'Active',    cls: 'bg-green-100 text-green-700 border-green-200' },
    trialing:  { label: 'Trial',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    past_due:  { label: 'Past due',  cls: 'bg-red-100 text-red-700 border-red-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    free:      { label: 'Free',      cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  };
  const { label, cls } = configs[status] ?? configs.free;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

// ── Status banner ─────────────────────────────────────────────────────────────
function StatusBanner({ plan }: { plan: VendorPlan }) {
  const days = trialDaysRemaining(plan);

  if (plan.plan_status === 'trialing') {
    const urgent = days <= 7;
    return (
      <div className={`rounded-2xl p-4 mb-6 flex items-start gap-3 border ${urgent ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
        <Clock className={`w-5 h-5 mt-0.5 flex-shrink-0 ${urgent ? 'text-orange-500' : 'text-blue-500'}`} />
        <div>
          <p className={`font-semibold text-sm ${urgent ? 'text-orange-800' : 'text-blue-800'}`}>
            {days > 0 ? `${days} day${days !== 1 ? 's' : ''} left in your free trial` : 'Your free trial has expired'}
          </p>
          <p className={`text-sm mt-0.5 ${urgent ? 'text-orange-600' : 'text-blue-600'}`}>
            {days > 0
              ? 'All Growth features are active. Subscribe before the trial ends to keep full access.'
              : 'Subscribe now to restore access to Growth features.'}
          </p>
        </div>
      </div>
    );
  }

  if (plan.plan_status === 'active') {
    return (
      <div className="rounded-2xl p-4 mb-6 flex items-start gap-3 bg-green-50 border border-green-200">
        <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-500" />
        <div>
          <p className="font-semibold text-sm text-green-800">Subscription active</p>
          <p className="text-sm mt-0.5 text-green-600">
            You&apos;re on the <strong>{plan.plan_tier === 'pro' ? 'Pro' : 'Growth'}</strong> plan.
            {' '}Manage or cancel anytime from the billing portal below.
          </p>
        </div>
      </div>
    );
  }

  if (plan.plan_status === 'past_due') {
    return (
      <div className="rounded-2xl p-4 mb-6 flex items-start gap-3 bg-red-50 border border-red-200">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-500" />
        <div>
          <p className="font-semibold text-sm text-red-800">Payment failed — action required</p>
          <p className="text-sm mt-0.5 text-red-600">
            We couldn&apos;t charge your card. Open the billing portal to update your payment method.
            Your features will be paused if payment isn&apos;t resolved within 7 days.
          </p>
        </div>
      </div>
    );
  }

  if (plan.plan_status === 'cancelled') {
    return (
      <div className="rounded-2xl p-4 mb-6 flex items-start gap-3 bg-gray-50 border border-gray-200">
        <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400" />
        <div>
          <p className="font-semibold text-sm text-gray-700">Subscription cancelled</p>
          <p className="text-sm mt-0.5 text-gray-500">
            You&apos;re now on the Free plan. Your data and offers are safe — subscribe to restore full access.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Feature lists ─────────────────────────────────────────────────────────────
const FREE_FEATURES    = ['1 active offer', 'Basic stamp card', 'QR scanner', 'Email support'];
const GROWTH_FEATURES  = ['Up to 10 active offers', 'Full analytics & ROI calculator', 'Flash deals & Boost tool', 'Staff PIN login', 'Customer directory', 'Offer template library', 'Advanced loyalty config', 'Priority email support'];
const PRO_FEATURES     = ['Everything in Growth', 'Unlimited active offers', 'Priority placement in feed', 'Monthly PDF performance report', 'Configurable cooldown (1–24h)', 'Dedicated onboarding support', 'Early access to new features'];

// ── Pricing card ─────────────────────────────────────────────────────────────
interface PricingCardProps {
  tier: 'growth' | 'pro';
  currentTier: PlanTier;
  currentStatus: PlanStatus;
  annual: boolean;
  onUpgrade: (tier: 'growth' | 'pro', annual: boolean) => void;
  loading: boolean;
}

function PricingCard({ tier, currentTier, currentStatus, annual, onUpgrade, loading }: PricingCardProps) {
  const isGrowth  = tier === 'growth';
  const isCurrent = currentTier === tier && (currentStatus === 'active' || currentStatus === 'trialing' || currentStatus === 'past_due');
  const isUpgrade = currentTier === 'growth' && tier === 'pro';
  const canSubscribe = !isCurrent;

  const monthlyPrice = PLAN_PRICES_HUF[tier];
  const annualPrice  = ANNUAL_PRICES_HUF[tier];
  const annualMonthlyEq = Math.round(annualPrice / 12);
  const savingsMonths = 2;

  const features = isGrowth ? GROWTH_FEATURES : PRO_FEATURES;

  return (
    <div className={`rounded-2xl border p-6 flex flex-col relative ${
      isCurrent
        ? isGrowth ? 'border-blue-400 ring-2 ring-blue-200 bg-white' : 'border-purple-400 ring-2 ring-purple-200 bg-white'
        : isGrowth ? 'border-blue-200 bg-white' : 'border-gray-200 bg-white'
    }`}>
      {/* Current plan badge */}
      {isCurrent && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold ${
          isGrowth ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
        }`}>
          Your plan
        </div>
      )}
      {!isCurrent && isGrowth && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold bg-vendor-600 text-white">
          Most popular
        </div>
      )}

      <div className="flex items-center gap-2 mb-1 mt-2">
        {isGrowth
          ? <Zap className="w-5 h-5 text-blue-500" />
          : <Crown className="w-5 h-5 text-purple-500" />}
        <h3 className="text-lg font-bold text-gray-900">{isGrowth ? 'Growth' : 'Pro'}</h3>
      </div>

      <p className="text-gray-500 text-sm mb-4">
        {isGrowth ? 'For active campus businesses' : 'For chains & high-volume venues'}
      </p>

      {/* Price */}
      <div className="mb-1">
        <span className="text-3xl font-black text-gray-900">
          {fmtHUF(annual ? annualMonthlyEq : monthlyPrice)}
        </span>
        <span className="text-gray-400 text-sm"> / month</span>
      </div>
      {annual ? (
        <p className="text-xs text-green-600 font-semibold mb-1">
          {fmtHUF(annualPrice)} billed annually — save {savingsMonths} months free 🎉
        </p>
      ) : (
        <p className="text-xs text-gray-400 mb-1">billed monthly</p>
      )}
      <p className="text-[11px] text-gray-300 mb-5">Az árak ÁFÁ-t tartalmaznak</p>

      <ul className="space-y-2 mb-6 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onUpgrade(tier, annual)}
        disabled={loading || isCurrent}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
          ${isCurrent
            ? isGrowth ? 'bg-blue-100 text-blue-500 cursor-default' : 'bg-purple-100 text-purple-500 cursor-default'
            : isGrowth
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
            : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg'
          }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? 'Redirecting…'
          : isCurrent ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Current plan
            </>
          )
          : isUpgrade ? (
            <>Upgrade to Pro <ChevronRight className="w-4 h-4" /></>
          )
          : (
            <>Subscribe now <ChevronRight className="w-4 h-4" /></>
          )}
      </button>
    </div>
  );
}

// ── Free plan summary ─────────────────────────────────────────────────────────
function FreePlanCard({ isCurrent }: { isCurrent: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 bg-white flex flex-col ${isCurrent ? 'border-gray-300 ring-2 ring-gray-200' : 'border-gray-100'}`}>
      {isCurrent && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
            Current plan
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <Star className="w-5 h-5 text-gray-400" />
        <h3 className="text-base font-bold text-gray-500">Free</h3>
      </div>
      <p className="text-gray-400 text-sm mb-3">Get started at no cost</p>
      <div className="text-2xl font-black text-gray-400 mb-4">0 Ft <span className="text-sm font-normal">/ month</span></div>
      <ul className="space-y-1.5">
        {FREE_FEATURES.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
            <CheckCircle2 className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [plan, setPlan]                   = useState<VendorPlan | null>(null);
  const [loading, setLoading]             = useState(true);
  const [annual, setAnnual]               = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading]   = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }
      const { data: billingRaw } = await supabase
        .from('vendor_profiles')
        .select('plan_tier, plan_status, trial_ends_at')
        .eq('user_id', user.id as string)
        .maybeSingle();
      if (billingRaw) setPlan((billingRaw as unknown) as VendorPlan);
      setLoading(false);
    })();

    // Success / cancelled flash from Stripe redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('success'))   setToast({ msg: '🎉 Subscription activated! Welcome to Studeals paid.', ok: true });
    if (params.get('cancelled')) setToast({ msg: 'Checkout cancelled. You can subscribe anytime below.', ok: false });
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleUpgrade = async (tier: 'growth' | 'pro', isAnnual: boolean) => {
    setCheckoutLoading(true);
    try {
      const priceId = isAnnual
        ? (tier === 'growth'
          ? process.env.NEXT_PUBLIC_STRIPE_GROWTH_ANNUAL_PRICE_ID
          : process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID)
        : (tier === 'growth'
          ? process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID
          : process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID);

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (e: any) {
      setToast({ msg: e.message ?? 'Something went wrong. Please try again.', ok: false });
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch {
      setToast({ msg: 'Could not open billing portal. Please try again.', ok: false });
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <VendorNav />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-vendor-500" />
        </div>
      </>
    );
  }

  const currentPlan = plan ?? { plan_tier: 'free' as PlanTier, plan_status: 'free' as PlanStatus, trial_ends_at: null };
  const isFreeOrCancelled = currentPlan.plan_status === 'free' || currentPlan.plan_status === 'cancelled';
  const isManageable = currentPlan.plan_status === 'active' || currentPlan.plan_status === 'past_due';

  return (
    <>
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          {/* Toast */}
          {toast && (
            <div className={`mb-5 px-5 py-3.5 rounded-2xl flex items-center justify-between gap-4 text-sm font-semibold shadow-sm ${
              toast.ok ? 'bg-green-600 text-white' : 'bg-gray-900 text-white'
            }`}>
              <span>{toast.msg}</span>
              <button onClick={() => setToast(null)} className="text-white/70 hover:text-white flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <CreditCard className="w-6 h-6 text-gray-500" />
                <h1 className="text-2xl font-black text-gray-900">Billing</h1>
              </div>
              <div className="flex items-center gap-2 ml-9">
                <span className="text-sm text-gray-500 capitalize font-medium">{currentPlan.plan_tier} plan</span>
                <PlanBadge status={currentPlan.plan_status} tier={currentPlan.plan_tier} />
              </div>
            </div>

            {isManageable && (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {portalLoading ? 'Opening…' : 'Billing portal'}
              </button>
            )}
          </div>

          {/* Status banner */}
          <StatusBanner plan={currentPlan} />

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className={`text-sm font-semibold ${!annual ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${annual ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-semibold ${annual ? 'text-gray-900' : 'text-gray-400'}`}>
              Annual
              <span className="ml-1.5 text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Save 2 months</span>
            </span>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 items-start">
            <FreePlanCard isCurrent={isFreeOrCancelled} />
            <PricingCard
              tier="growth"
              currentTier={currentPlan.plan_tier}
              currentStatus={currentPlan.plan_status}
              annual={annual}
              onUpgrade={handleUpgrade}
              loading={checkoutLoading}
            />
            <PricingCard
              tier="pro"
              currentTier={currentPlan.plan_tier}
              currentStatus={currentPlan.plan_status}
              annual={annual}
              onUpgrade={handleUpgrade}
              loading={checkoutLoading}
            />
          </div>

          {/* Portal CTA for past_due */}
          {currentPlan.plan_status === 'past_due' && (
            <div className="mb-8 border border-red-200 rounded-2xl p-5 bg-red-50">
              <h2 className="font-bold text-red-900 mb-1">Update your payment method</h2>
              <p className="text-sm text-red-700 mb-4">
                Your last payment failed. Open the billing portal to fix your card before your features are paused.
              </p>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {portalLoading ? 'Opening…' : 'Fix payment'}
              </button>
            </div>
          )}

          {/* FAQ */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Frequently asked questions</h2>
            {[
              ['Can I cancel anytime?', 'Yes. Cancel from the billing portal and you keep access until the end of your billing period. No questions asked.'],
              ['What happens when my trial ends?', 'Your account moves to the Free plan (1 offer, no analytics). All your data stays intact — subscribe anytime to restore full access.'],
              ['Is annual billing really 2 months free?', 'Yes. Annual Growth is 139 900 Ft vs 167 880 Ft if paid monthly (12 × 13 990 Ft) — a saving of 27 980 Ft, equivalent to 2 months free.'],
              ['Is there a founding vendor discount?', 'Vendors who subscribed within the first 2 months of launch get 25% off for the lifetime of their subscription. Applied automatically via promo code at checkout.'],
              ['Do prices include VAT?', 'Yes — all prices shown include Hungarian ÁFA (27%). You\'ll receive a VAT invoice for each billing cycle.'],
            ].map(([q, a]) => (
              <div key={q} className="bg-white border border-gray-100 rounded-2xl p-5">
                <p className="text-sm font-bold text-gray-900 mb-1.5">{q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
