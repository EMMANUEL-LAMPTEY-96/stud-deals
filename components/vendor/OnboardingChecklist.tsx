'use client';

// =============================================================================
// components/vendor/OnboardingChecklist.tsx
//
// Shown on the vendor dashboard for vendors who haven't completed setup.
// 5 steps:  1. Complete profile   2. Add logo
//           3. Create first offer  4. Set up loyalty card
//           5. Launch first boost
//
// Each step links directly to the relevant page.
// Dismissed state stored in localStorage — "onboarding_dismissed_{vendorId}".
// Collapses once all 5 steps are complete (auto-hides after 5 s).
// =============================================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CheckCircle, Circle, ChevronRight, X, Sparkles,
  User, Image, Tag, Gift, Zap,
} from 'lucide-react';

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  done: boolean;
}

export default function OnboardingChecklist({ vendorId }: { vendorId: string }) {
  const supabase = createClient();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const storageKey = `onboarding_dismissed_${vendorId}`;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem(storageKey) === '1') {
        setDismissed(true);
        setLoading(false);
        return;
      }
    }
    load();
  }, [vendorId]);

  const load = async () => {
    // 1. Profile: has description + city
    const { data: vp } = await supabase
      .from('vendor_profiles')
      .select('description, city, logo_url, business_name')
      .eq('id', vendorId)
      .single();

    const profileDone = !!(vp?.description && vp.city && vp.business_name);
    const logoDone    = !!vp?.logo_url;

    // 2. Any active offer
    const { count: offerCount } = await supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendorId)
      .eq('status', 'active');

    const offerDone = (offerCount ?? 0) > 0;

    // 3. A loyalty / punch card offer
    const { data: loyaltyOffers } = await supabase
      .from('offers')
      .select('terms_and_conditions')
      .eq('vendor_id', vendorId)
      .like('terms_and_conditions', '[[LOYALTY:%')
      .limit(1);

    const loyaltyDone = (loyaltyOffers?.length ?? 0) > 0;

    // 4. At least one boost ever launched
    const { count: boostCount } = await supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_id', vendorId)
      .like('terms_and_conditions', '[[BOOST:%');

    const boostDone = (boostCount ?? 0) > 0;

    const built: Step[] = [
      {
        id: 'profile',
        label: 'Complete your profile',
        description: 'Add your business name, description, and location.',
        href: '/vendor/profile',
        icon: <User size={16} />,
        done: profileDone,
      },
      {
        id: 'logo',
        label: 'Upload your logo',
        description: 'A logo helps students recognise your brand instantly.',
        href: '/vendor/profile',
        icon: <Image size={16} />,
        done: logoDone,
      },
      {
        id: 'offer',
        label: 'Create your first offer',
        description: 'Publish a live discount or special deal for students.',
        href: '/vendor/offers/create',
        icon: <Tag size={16} />,
        done: offerDone,
      },
      {
        id: 'loyalty',
        label: 'Set up a loyalty card',
        description: 'Punch cards keep students coming back — 2.4× repeat visits.',
        href: '/vendor/offers/create',
        icon: <Gift size={16} />,
        done: loyaltyDone,
      },
      {
        id: 'boost',
        label: 'Launch your first boost',
        description: 'Flash campaigns drive same-day footfall when you need it.',
        href: '/vendor/boost',
        icon: <Zap size={16} />,
        done: boostDone,
      },
    ];

    setSteps(built);
    setLoading(false);

    // If all done, collapse after 5 s then auto-dismiss
    if (built.every(s => s.done)) {
      setTimeout(() => {
        setCollapsed(true);
        setTimeout(() => handleDismiss(), 3000);
      }, 800);
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  if (loading || dismissed) return null;

  const doneCount  = steps.filter(s => s.done).length;
  const total      = steps.length;
  const pct        = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone    = doneCount === total;
  const nextStep   = steps.find(s => !s.done);

  if (collapsed && allDone) {
    return (
      <div className="flex items-center gap-3 bg-vendor-50 border border-vendor-200 rounded-2xl px-5 py-3.5 mb-6 animate-fade-in">
        <CheckCircle size={18} className="text-vendor-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-vendor-800 flex-1">
          🎉 All set! Your business is fully configured and live on Stud Deals.
        </p>
        <button onClick={handleDismiss} className="text-vendor-400 hover:text-vendor-700">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-vendor-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">Get started with Stud Deals</p>
            <span className="text-xs font-bold text-vendor-600 bg-vendor-50 px-2 py-0.5 rounded-full">
              {doneCount}/{total}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-vendor-500 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          title="Dismiss checklist"
        >
          <X size={15} />
        </button>
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-50">
        {steps.map((step, i) => (
          <Link
            key={step.id}
            href={step.done ? '#' : step.href}
            className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
              step.done
                ? 'opacity-50 cursor-default'
                : 'hover:bg-gray-50 cursor-pointer'
            }`}
            onClick={step.done ? (e) => e.preventDefault() : undefined}
          >
            {/* Status icon */}
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
              step.done
                ? 'bg-vendor-100 text-vendor-600'
                : step.id === nextStep?.id
                  ? 'bg-gradient-to-br from-vendor-500 to-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400'
            }`}>
              {step.done ? <CheckCircle size={14} /> : step.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${step.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{step.description}</p>
              )}
            </div>

            {/* Arrow for next step */}
            {!step.done && step.id === nextStep?.id && (
              <ChevronRight size={16} className="text-vendor-500 flex-shrink-0" />
            )}
          </Link>
        ))}
      </div>

      {/* Footer CTA */}
      {nextStep && (
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100">
          <Link
            href={nextStep.href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-vendor-700 hover:text-vendor-900 transition-colors"
          >
            <span>Next: {nextStep.label}</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
