import Link from 'next/link';
import {
  GraduationCap, Store, QrCode, Shield, TrendingUp, Zap,
  Star, MapPin, Clock, CheckCircle, ArrowRight,
  Search, Tag, Users, BarChart3,
  Coffee, Pizza, ShoppingBag, Dumbbell, Laptop, BookOpen,
} from 'lucide-react';

// ─── Static data ──────────────────────────────────────────────────────────────

const STATS = [
  { label: 'Students saving',     value: '47,000+' },
  { label: 'Student deals',       value: '2,400+' },
  { label: 'Partner businesses',  value: '380+' },
  { label: 'Avg. student saving', value: '130 000 Ft/év' },
];

const HOW_STUDENT = [
  { icon: <GraduationCap size={22} />, step: '1', title: 'Verify your student status',      desc: 'Use your .edu email or upload your student ID. One-time setup, instantly reusable.' },
  { icon: <Search size={22} />,        step: '2', title: 'Discover local deals',            desc: 'Browse hundreds of exclusive student offers near your campus, updated weekly.' },
  { icon: <QrCode size={22} />,        step: '3', title: 'Claim & redeem in seconds',       desc: 'Tap claim, show your QR code at the counter — done. No apps to download, no printing.' },
];

const HOW_VENDOR = [
  { icon: <Store size={22} />,    step: '1', title: 'Create your business profile', desc: 'List your business, set your student discount, and go live in under 10 minutes.' },
  { icon: <Tag size={22} />,      step: '2', title: 'Students discover you',        desc: 'Your deals appear in front of thousands of verified local students instantly.' },
  { icon: <BarChart3 size={22} />,step: '3', title: 'Scan, confirm, grow',          desc: 'Use the built-in QR scanner to confirm redemptions. Track ROI with live analytics.' },
];

const FEATURES = [
  { icon: <Shield size={20} />,   title: 'Fraud-proof verification', desc: 'Every student is verified via .edu email or institution ID. Vendors never get scammed.' },
  { icon: <Zap size={20} />,      title: 'Instant redemption',       desc: 'QR codes generate in real-time with a 24-hour expiry. Fast at the point of sale.' },
  { icon: <BarChart3 size={20} />,title: 'Live analytics dashboard',  desc: 'See redemption rates, peak hours, and revenue impact — all connected to your POS workflow.' },
  { icon: <MapPin size={20} />,   title: 'Hyper-local targeting',    desc: 'Only students near your campus see your deals. No wasted impressions.' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* ── Nav bar ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
              <GraduationCap size={17} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base">
              Stud<span className="text-brand-600">Deals</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">How it works</a>
            <a href="#for-vendors" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">For businesses</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-semibold text-gray-700 hover:text-brand-600 transition-colors px-3 py-1.5">
              Log in
            </Link>
            <Link href="/sign-up" className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-sm transition-colors">
              <Zap size={14} /> Get student deals
            </Link>
          </div>
        </div>
      </header>

      <div className="pt-16">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative bg-[#1e1b4b] text-white overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-brand-600/30 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-56 h-56 bg-purple-400/20 rounded-full blur-2xl" />

          <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm mb-8">
              <Zap size={14} className="text-yellow-400" />
              <span>Trusted by 47,000+ verified students</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-black leading-[1.1] mb-6 max-w-3xl mx-auto">
              Student deals that{' '}
              <span className="text-gradient-brand">actually work</span>
            </h1>
            <p className="text-xl text-purple-200 max-w-xl mx-auto mb-10 leading-relaxed">
              The hyper-local marketplace connecting verified students with exclusive discounts from campus businesses — no cards, no printing, just a QR code.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 bg-white text-brand-700 hover:bg-brand-50 font-bold text-base px-8 py-3 rounded-2xl shadow-lg transition-colors"
              >
                I&apos;m a Student <ArrowRight size={18} />
              </Link>
              <Link
                href="/sign-up?role=vendor"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-2xl border-2 border-white/30 text-white font-bold text-base hover:bg-white/10 transition-all"
              >
                I&apos;m a Business <Store size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Stats bar ───────────────────────────────────────────────────── */}
        <section className="bg-brand-800 border-t border-brand-700">
          <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-brand-300 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works — Students ─────────────────────────────────────── */}
        <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <span className="category-badge mb-3">For Students</span>
            <h2 className="text-3xl font-black text-gray-900">Save money in 3 steps</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {HOW_STUDENT.map(s => (
              <div key={s.step} className="card p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-4 text-brand-600">
                  {s.icon}
                </div>
                <div className="text-xs font-black text-brand-500 uppercase tracking-widest mb-2">Step {s.step}</div>
                <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works — Vendors ──────────────────────────────────────── */}
        <section id="for-vendors" className="bg-white border-t border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <div className="text-center mb-10">
              <span className="category-badge mb-3">For Businesses</span>
              <h2 className="text-3xl font-black text-gray-900">Reach campus, grow revenue</h2>
              <p className="text-gray-500 mt-2 text-sm">Avg. vendor sees +34% foot traffic in the first month</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {HOW_VENDOR.map(s => (
                <div key={s.step} className="card p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-vendor-100 flex items-center justify-center mx-auto mb-4 text-vendor-600">
                    {s.icon}
                  </div>
                  <div className="text-xs font-black text-vendor-600 uppercase tracking-widest mb-2">Step {s.step}</div>
                  <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-black text-gray-900 text-center mb-10">Built for the real world</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="card p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-brand-600 to-brand-900 text-white py-16 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-black mb-4">Ready to launch?</h2>
            <p className="text-brand-200 mb-8 text-lg">Join thousands of students and businesses already on the platform.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 bg-white text-brand-700 hover:bg-brand-50 font-bold text-base px-8 py-3 rounded-2xl transition-colors"
              >
                Start Saving — It&apos;s Free
              </Link>
              <Link
                href="/sign-up?role=vendor"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-2xl border-2 border-white/40 font-bold text-base hover:bg-white/10 transition-all"
              >
                List Your Business
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="bg-gray-900 text-gray-400 py-8 px-6 text-center text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <GraduationCap size={18} className="text-brand-400" />
            <span className="text-white font-bold text-base">StudDeals</span>
          </div>
          <p>© 2026 StudDeals. The student marketplace that just works.</p>
          <div className="flex items-center justify-center gap-6 mt-3">
            <Link href="/sign-in" className="hover:text-gray-200 transition-colors">Log in</Link>
            <Link href="/sign-up" className="hover:text-gray-200 transition-colors">Sign up</Link>
            <Link href="/sign-up?role=vendor" className="hover:text-gray-200 transition-colors">For businesses</Link>
          </div>
        </footer>

      </div>
    </div>
  );
}
