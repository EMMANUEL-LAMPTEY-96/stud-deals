// =============================================================================
// app/for-vendors/page.tsx — "For Businesses" marketing landing page
//
// Public, no auth required.
// Targets Hungarian campus businesses (cafés, bookshops, gyms, etc.)
// explaining why they should join Studeals.
//
// Sections:
//   1. Hero
//   2. Social proof strip
//   3. How it works (3 steps)
//   4. Feature highlights
//   5. Pricing plans (HUF)
//   6. FAQ
//   7. Final CTA
// =============================================================================

import Link from 'next/link';
import type { Metadata } from 'next';
import {
  QrCode, BarChart3, Zap, Users, Star, Shield,
  CheckCircle, ChevronDown, ArrowRight, Coffee,
  Megaphone, Gift, TrendingUp, Clock, MapPin,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'For Businesses — Studeals | Reach verified Hungarian university students',
  description:
    'List your student discounts on Studeals and reach tens of thousands of verified university students near your venue. Free to start. No commission.',
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    title: 'Create your business profile',
    body: 'Sign up in under 5 minutes. Add your business name, location, logo, and a short description. Our team verifies your listing within 24 hours.',
    icon: <Shield size={22} className="text-vendor-600" />,
  },
  {
    n: '02',
    title: 'Publish student offers',
    body: 'Set a discount percentage, fixed amount, or loyalty stamp reward. Add terms, expiry dates, and category tags. Go live instantly.',
    icon: <QrCode size={22} className="text-vendor-600" />,
  },
  {
    n: '03',
    title: 'Students walk in & claim',
    body: 'Verified students browse deals on their phones, tap Claim, and show you the QR voucher at the counter. You confirm in one tap.',
    icon: <Users size={22} className="text-vendor-600" />,
  },
];

const FEATURES = [
  {
    icon: <Gift size={20} className="text-amber-500" />,
    title: 'Loyalty stamp system',
    body: 'Run a punch-card programme — students collect stamps and unlock rewards automatically. No paper cards, no staff effort.',
  },
  {
    icon: <Zap size={20} className="text-orange-500" />,
    title: 'Flash deals',
    body: 'Push a time-limited offer to every student within 2 km of your venue in seconds. Fill quiet periods instantly.',
  },
  {
    icon: <BarChart3 size={20} className="text-blue-500" />,
    title: 'Real analytics',
    body: 'See redemption trends, peak hours, student demographics, and ROI. Know exactly which offers drive the most visits.',
  },
  {
    icon: <Megaphone size={20} className="text-purple-500" />,
    title: 'Direct promotions',
    body: 'Send targeted in-app messages to your loyal or lapsed customers without spending on ads.',
  },
  {
    icon: <MapPin size={20} className="text-green-500" />,
    title: 'Hyper-local targeting',
    body: 'Offers are shown to students at nearby universities first. Your spend reaches the people most likely to walk through your door.',
  },
  {
    icon: <Star size={20} className="text-yellow-500" />,
    title: 'Verified reviews',
    body: 'Only students who actually redeemed at your venue can leave a review. Authentic ratings that build real trust.',
  },
];

interface Plan {
  name: string;
  priceHuf: number;
  period: string;
  badge?: string;
  features: string[];
  cta: string;
  highlight: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    priceHuf: 0,
    period: 'forever',
    features: [
      'Unlimited active offers',
      'QR voucher redemption',
      'Basic loyalty stamp card',
      'Vendor dashboard',
      'Student reviews',
      'Print QR poster',
    ],
    cta: 'Start for free',
    highlight: false,
  },
  {
    name: 'Growth',
    priceHuf: 13990,
    period: 'month',
    badge: 'Most popular',
    features: [
      'Everything in Free',
      'Flash deals (2/day)',
      'Customer directory + CSV export',
      'Send promotions to segments',
      'Advanced analytics & benchmarks',
      'Campaign calendar',
      'Priority listing in search',
    ],
    cta: 'Start 14-day trial',
    highlight: true,
  },
  {
    name: 'Pro',
    priceHuf: 27990,
    period: 'month',
    features: [
      'Everything in Growth',
      'Unlimited flash deals',
      'Multi-location support',
      'Staff PIN system',
      'Offer boost / promoted placement',
      'Dedicated account manager',
      'API access',
    ],
    cta: 'Contact us',
    highlight: false,
  },
];

const FAQS = [
  {
    q: 'Is there a commission on each redemption?',
    a: 'No. Studeals charges a flat monthly fee (or nothing on the Free plan). You keep 100% of what students spend at your venue.',
  },
  {
    q: 'How do I know students are actually verified?',
    a: 'Every student completes a verification step — university email, student ID upload, or institutional email domain check — before they can claim any deal. Unverified accounts cannot access offers.',
  },
  {
    q: 'What types of businesses work best on Studeals?',
    a: 'Cafés, restaurants, bookshops, gyms, beauty salons, pharmacies, electronics stores, and any business within walking distance of a university campus. If students walk past your door, Studeals can send them inside.',
  },
  {
    q: 'How long does verification take?',
    a: 'Our team reviews new business applications within 24 hours on weekdays. You\'ll receive an email once your listing is live.',
  },
  {
    q: 'Can I run multiple locations?',
    a: 'Multi-location management is available on the Pro plan. Each location gets its own QR code, offer set, and analytics dashboard.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no long-term contracts. Cancel at any time and your account reverts to the Free plan at the end of the billing period.',
  },
];

function fmtHUF(n: number) {
  return n.toLocaleString('hu-HU') + ' Ft';
}

// ─── Components ───────────────────────────────────────────────────────────────

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border border-gray-200 rounded-2xl overflow-hidden">
      <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none font-semibold text-gray-900 text-sm hover:bg-gray-50 transition-colors">
        {q}
        <ChevronDown
          size={16}
          className="text-gray-400 flex-shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
        {a}
      </div>
    </details>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForVendorsPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Simple top nav ── */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-lg text-gray-900">
            <div className="w-7 h-7 bg-vendor-600 rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            Studeals
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/sign-up/vendor"
              className="bg-vendor-600 hover:bg-vendor-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              Start for free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-vendor-700 via-vendor-800 to-gray-900 text-white">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
            <Coffee size={14} className="text-amber-300" />
            Built for campus businesses in Hungary
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-6">
            Fill your venue with{' '}
            <span className="text-amber-300">verified students</span>.
            <br />No commission. Ever.
          </h1>

          <p className="text-lg sm:text-xl text-white/75 max-w-2xl mx-auto mb-10">
            Studeals connects Hungarian campus businesses with tens of thousands of verified
            university students — through QR vouchers, loyalty stamps, and targeted flash deals.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up/vendor"
              className="inline-flex items-center justify-center gap-2 bg-white text-vendor-700 font-bold px-8 py-4 rounded-2xl hover:bg-vendor-50 transition-colors text-base shadow-xl"
            >
              Create your free listing
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/10 transition-colors text-base"
            >
              Already have an account
            </Link>
          </div>

          <p className="text-white/50 text-sm mt-6">
            Free forever · No credit card required · Live in 24 hours
          </p>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: '47,000+', label: 'Verified students' },
              { value: '2,400+',  label: 'Active deals' },
              { value: '18',      label: 'Universities covered' },
              { value: '0%',      label: 'Commission charged' },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-2xl sm:text-3xl font-black text-vendor-700">{stat.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <p className="text-vendor-600 font-bold text-sm uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Up and running in 5 minutes
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map(step => (
            <div key={step.n} className="relative bg-white border border-gray-100 rounded-3xl p-7 shadow-sm">
              <div className="text-5xl font-black text-gray-100 absolute top-5 right-6 leading-none select-none">
                {step.n}
              </div>
              <div className="w-11 h-11 bg-vendor-50 rounded-2xl flex items-center justify-center mb-5">
                {step.icon}
              </div>
              <h3 className="font-black text-gray-900 text-base mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-vendor-600 font-bold text-sm uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
              Everything your venue needs to convert students into regulars
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <p className="text-vendor-600 font-bold text-sm uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
            Simple, transparent plans
          </h2>
          <p className="text-gray-500 text-base mt-3 max-w-lg mx-auto">
            Start free, upgrade when you grow. No hidden fees, no contracts, no commission on sales.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-3xl p-7 flex flex-col ${
                plan.highlight
                  ? 'bg-vendor-700 text-white shadow-2xl ring-2 ring-vendor-500 scale-[1.02]'
                  : 'bg-white border border-gray-100 shadow-sm'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-4 py-1 rounded-full shadow">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <p className={`font-black text-lg mb-1 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </p>
                <div className="flex items-end gap-1">
                  <span className={`text-4xl font-black ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                    {plan.priceHuf === 0 ? 'Ingyenes' : fmtHUF(plan.priceHuf)}
                  </span>
                  {plan.priceHuf > 0 && (
                    <span className={`text-sm pb-1 ${plan.highlight ? 'text-white/60' : 'text-gray-400'}`}>
                      /{plan.period}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle
                      size={15}
                      className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-amber-300' : 'text-vendor-500'}`}
                    />
                    <span className={plan.highlight ? 'text-white/85' : 'text-gray-600'}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.name === 'Pro' ? 'mailto:hello@studeals.app?subject=Pro plan enquiry' : '/sign-up/vendor'}
                className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-2xl transition-colors text-sm ${
                  plan.highlight
                    ? 'bg-white text-vendor-700 hover:bg-vendor-50'
                    : 'bg-vendor-600 text-white hover:bg-vendor-700'
                }`}
              >
                {plan.cta}
                <ArrowRight size={15} />
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          All prices exclude 27% Hungarian VAT (ÁFA). Billed monthly. Cancel anytime.
        </p>
      </section>

      {/* ── Testimonial placeholder ── */}
      <section className="bg-vendor-700 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-1 mb-5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={20} className="fill-amber-400 text-amber-400" />
            ))}
          </div>
          <blockquote className="text-white text-xl sm:text-2xl font-black leading-snug mb-6">
            &ldquo;Since joining Studeals, Tuesday lunch covers are up 40%. The flash deal tool fills every slow shift.&rdquo;
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-white">
              KM
            </div>
            <div className="text-left">
              <p className="text-white font-semibold text-sm">Kővári Máté</p>
              <p className="text-white/60 text-xs">Owner, Kávézó az Egyetemnél · Budapest</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-10">
          <p className="text-vendor-600 font-bold text-sm uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-3xl font-black text-gray-900">Common questions</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map(faq => (
            <FAQ key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-gray-50 border-t border-gray-100 py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-14 h-14 bg-vendor-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <TrendingUp size={24} className="text-vendor-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
            Ready to grow your student customer base?
          </h2>
          <p className="text-gray-500 text-base mb-8 max-w-md mx-auto">
            Join hundreds of campus businesses already on Studeals.
            Free to list, live in 24 hours, no commission.
          </p>
          <Link
            href="/sign-up/vendor"
            className="inline-flex items-center gap-2 bg-vendor-600 hover:bg-vendor-700 text-white font-bold px-8 py-4 rounded-2xl transition-colors text-base shadow-lg"
          >
            Create your free business listing
            <ArrowRight size={18} />
          </Link>
          <p className="text-gray-400 text-xs mt-4 flex items-center justify-center gap-1.5">
            <Clock size={11} /> Verified within 24 hours · No credit card needed
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} Studeals · studeals.app</p>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <Link href="/dashboard" className="hover:text-gray-600 transition-colors">Student sign-in</Link>
            <Link href="mailto:hello@studeals.app" className="hover:text-gray-600 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
