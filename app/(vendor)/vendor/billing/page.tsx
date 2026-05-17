'use client';

// =============================================================================
// app/(vendor)/vendor/billing/page.tsx
//
// Vendor billing & subscription management page.
// Shows current plan, trial countdown, pricing cards, and upgrade/portal CTAs.
// =============================================================================

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import VendorNav from '@/components/vendor/VendorNav';
import {
  CreditCard, Zap, Star, CheckCircle2, Clock, AlertTriangle,
  ExternalLink, Crown,
} from 'lucide-react';
import type { PlanTier, PlanStatus } from '@/lib/utils/plan-tier';
import { PLAN_PRICES_HUF, trialDaysRemaining } from '@/lib/utils/plan-tier';
import { fmtHUF } from '@/lib/currency';

interface VendorPlan {
  plan_tier:    PlanTier;
  plan_status:  PlanStatus;
  trial_ends_at: string | null;
}

// ── Status banner ─────────────────────────────────────────────────────────────
function StatusBanner({ plan }: { plan: VendorPlan }) {
  const days = trialDaysRemaining(plan);

  if (plan.plan_status === 'trialing') {
    const urgent = days <= 7;
    return (
      <div className={`rounded-xl p-4 mb-6 flex items-start gap-3 ${urgent ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}>
        <Clock className={`w-5 h-5 mt-0.5 flex-shrink-0 ${urgent ? 'text-orange-500' : 'text-blue-500'}`} />
        <div>
          <p className={`font-medium text-sm ${urgent ? 'text-orange-800' : 'text-blue-800'}`}>
            {days > 0 ? `${days} day${days !== 1 ? 's' : ''} left in your free trial` : 'Your free trial has expired'}
          </p>
          <p className={`text-sm mt-0.5 ${urgent ? 'text-orange-600' : 'text-blue-600'}`}>
            {days > 0
              ? 'You\'re on Growth features. Subscribe before the trial ends to keep everything.'
              : 'Subscribe now to restore access to Growth features.'}
          </p>
        </div>
      </div>
    );
  }

  if (plan.plan_status === 'active') {
    return (
      <div className="rounded-xl p-4 mb-6 flex items-start gap-3 bg-green-50 border border-green-200">
        <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-500" />
        <div>
          <p className="font-medium text-sm text-green-800">Subscription active</p>
          <p className="text-sm mt-0.5 text-green-600">
            You&apos;re on the {plan.plan_tier === 'pro' ? 'Pro' : 'Growth'} plan. Manage or cancel anytime via the portal.
          </p>
        </div>
      </div>
    );
  }

  if (plan.plan_status === 'past_due') {
    return (
      <div className="rounded-xl p-4 mb-6 flex items-start gap-3 bg-red-50 border border-red-200">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-500" />
        <div>
          <p className="font-medium text-sm text-red-800">Payment failed</p>
          <p className="text-sm mt-0.5 text-red-600">
            We couldn&apos;t charge your card. Please update your payment method to keep your features.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Pricing card ─────────────────────────────────────────────────────────────
interface PricingCardProps {
  tier: 'growth' | 'pro';
  currentTier: PlanTier;
  currentStatus: PlanStatus;
  onUpgrade: (tier: 'growth' | 'pro') => void;
  loading: boolean;
}

function PricingCard({ tier, currentTier, currentStatus, onUpgrade, loading }: PricingCardProps) {
  const isGrowth   = tier === 'growth';
  const isCurrent  = currentTier === tier && (currentStatus === 'active' || currentStatus === 'trialing');
  const isDowngrade = currentTier === 'pro' && tier === 'growth';

  const features = isGrowth
    ? [
        '10 active offers',
        'Full analytics & ROI calculator',
        'Flash deals & boost tool',
        'Staff PIN login',
        'Customer directory',
        'Offer templates library',
        'Advanced loyalty config',
      ]
    : [
        'Everything in Growth',
        'Unlimited active offers',
        'Priority placement in student feed',
        'Monthly PDF report (auto-emailed)',
        'Configurable cooldown hours (1–24h)',
        'Dedicated onboarding support',
        'Early access to new features',
      ];

  return (
    <div className={`rounded-2xl border p-6 flex flex-col ${isGrowth ? 'border-blue-300 ring-2 ring-blue-200' : 'border-gray-200'} bg-white`}>
      <div className="flex items-center gap-2 mb-1">
        {isGrowth
          ? <Zap className="w-5 h-5 text-blue-500" />
          : <Crown className="w-5 h-5 text-purple-500" />}
        <h3 className="text-lg font-medium text-gray-900">{isGrowth ? 'Growth' : 'Pro'}</h3>
        {isGrowth && (
          <span className="ml-auto text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Most popular</span>
        )}
      </div>

      <p className="text-gray-500 text-sm mb-4">
        {isGrowth ? 'For active campus businesses' : 'For chains and high-volume venues'}
      </p>

      <div className="mb-1">
        <span className="text-3xl font-medium text-gray-900">{fmtHUF(PLAN_PRICES_HUF[tier])}</span>
        <span className="text-gray-400 text-sm"> / month</span>
      </div>
      <p className="text-gray-400 text-xs mb-5">≈ €{isGrowth ? '35' : '70'} · billed monthly</p>

      <ul className="space-y-2 mb-6 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onUpgrade(tier)}
        disabled={loading || isCurrent || isDowngrade}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all
          ${isCurrent
            ? 'bg-gray-100 text-gray-400 cursor-default'
            : isDowngrade
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : isGrowth
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
      >
        {loading ? 'Redirecting…'
          : isCurrent ? 'Current plan'
          : isDowngrade ? 'Manage via portal'
          : 'Subscribe now'}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const supabase = createClient();
  const [plan, setPlan]     = useState<VendorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading]     = useState(false);
  const [toast, setToast]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Cast required: plan_status + trial_ends_at added in migration 010_billing
      // after last type regeneration. Safe — columns exist in DB.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('vendor_profiles') as any)
        .select('plan_tier, plan_status, trial_ends_at')
        .eq('user_id', user.id)
        .maybeSingle() as { data: { plan_tier: string; plan_status: string; trial_ends_at: string | null } | null };
      if (data) setPlan(data as VendorPlan);
      setLoading(false);
    })();

    // Show success / cancelled flash
    const params = new URLSearchParams(window.location.search);
    if (params.get('success'))   setToast('🎉 Subscription activated! Welcome to Studeals paid.');
    if (params.get('cancelled')) setToast('Checkout cancelled. You can subscribe anytime.');
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleUpgrade = async (tier: 'growth' | 'pro') => {
    setCheckoutLoading(true);
    try {
      const priceId = tier === 'growth'
        ? process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID
        : process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (e) {
      setToast('Something went wrong. Please try again.');
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
      setToast('Could not open billing portal. Please try again.');
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <VendorNav />
        <div className="max-w-3xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  const currentPlan = plan ?? { plan_tier: 'free' as PlanTier, plan_status: 'free' as PlanStatus, trial_ends_at: null };

  return (
    <div className="min-h-screen bg-gray-50">
      <VendorNav />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Toast */}
        {toast && (
          <div className="mb-4 p-3 bg-gray-900 text-white text-sm rounded-lg flex items-center justify-between gap-4">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-gray-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-6 h-6 text-gray-600" />
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Billing</h1>
            <p className="text-sm text-gray-500">
              Current plan: <span className="font-medium capitalize">{currentPlan.plan_tier}</span>
              <span className="ml-2 text-xs text-gray-400">({currentPlan.plan_status})</span>
            </p>
          </div>
        </div>

        {/* Status banner */}
        <StatusBanner plan={currentPlan} />

        {/* Free tier notice */}
        {currentPlan.plan_status === 'free' || currentPlan.plan_status === 'cancelled' ? (
          <div className="mb-6 p-4 bg-gray-100 rounded-xl text-sm text-gray-600">
            <Star className="inline w-4 h-4 mr-1.5 text-gray-400" />
            You&apos;re on the <strong>Free plan</strong> — 1 active offer, basic stamp card, no analytics.
            Subscribe to unlock the full platform.
          </div>
        ) : null}

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <PricingCard
            tier="growth"
            currentTier={currentPlan.plan_tier}
            currentStatus={currentPlan.plan_status}
            onUpgrade={handleUpgrade}
            loading={checkoutLoading}
          />
          <PricingCard
            tier="pro"
            currentTier={currentPlan.plan_tier}
            currentStatus={currentPlan.plan_status}
            onUpgrade={handleUpgrade}
            loading={checkoutLoading}
          />
        </div>

        {/* Manage subscription */}
        {(currentPlan.plan_status === 'active' || currentPlan.plan_status === 'past_due') && (
          <div className="border border-gray-200 rounded-xl p-5 bg-white">
            <h2 className="font-medium text-gray-900 mb-1">Manage subscription</h2>
            <p className="text-sm text-gray-500 mb-4">
              Update your payment method, download invoices, or cancel via the Stripe customer portal.
            </p>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <ExternalLink className="w-4 h-4" />
              {portalLoading ? 'Opening…' : 'Open billing portal'}
            </button>
          </div>
        )}

        {/* FAQ */}
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">FAQ</h2>
          {[
            ['Can I cancel anytime?', 'Yes. Cancel from the billing portal and you keep access until the end of your billing period.'],
            ['What happens when my trial ends?', 'Your account moves to the Free plan (1 offer, no analytics). Your data stays intact — subscribe to restore access.'],
            ['Do you offer annual billing?', 'Yes — annual billing saves you 2 months. Contact us at hello@studeals.app to set it up.'],
            ['Is there a founding vendor discount?', 'Vendors who subscribed within the first 2 months get 25% off for the lifetime of their subscription. Applied automatically via promo code.'],
          ].map(([q, a]) => (
            <div key={q} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-900 mb-1">{q}</p>
              <p className="text-sm text-gray-500">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
