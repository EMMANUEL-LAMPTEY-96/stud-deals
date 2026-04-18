'use client';

import { useState } from 'react';
import {
  GraduationCap, Store, QrCode, Shield, TrendingUp, Zap,
  Star, MapPin, Clock, Heart, CheckCircle, ArrowRight,
  Bell, Search, ChevronDown, Tag, Users, BarChart3,
  Coffee, Pizza, ShoppingBag, Dumbbell, Laptop, BookOpen,
  X, Copy, RotateCcw, Loader2,
} from 'lucide-react';

// ─── Mock data ────────────────────────────────────────────────────────────────
const OFFERS = [
  { id:1, title:'30% off all meals',   vendor:'The Library Café', category:'Food & Drink', discount:'30% OFF', img:'🍕', distance:'0.2 mi', expiry:'2 days', saves:142, claimed:89  },
  { id:2, title:'Buy 1 Get 1 Free',    vendor:'Campus Grounds',   category:'Coffee',       discount:'BOGO',    img:'☕', distance:'0.1 mi', expiry:'5 days', saves:98,  claimed:211 },
  { id:3, title:'20% student discount',vendor:'UniBooks',         category:'Retail',       discount:'20% OFF', img:'📚', distance:'0.4 mi', expiry:'30 days',saves:67,  claimed:55  },
  { id:4, title:'Free class trial',    vendor:'FitZone Gym',      category:'Fitness',      discount:'FREE',    img:'🏋️', distance:'0.6 mi', expiry:'7 days', saves:203, claimed:178 },
  { id:5, title:'15% off all software',vendor:'TechGear Store',   category:'Tech',         discount:'15% OFF', img:'💻', distance:'0.3 mi', expiry:'14 days',saves:89,  claimed:42  },
  { id:6, title:'£2 off any pizza',    vendor:'Pizza Republic',   category:'Food & Drink', discount:'£2 OFF',  img:'🍕', distance:'0.5 mi', expiry:'1 day',  saves:31,  claimed:19  },
];

const CATEGORIES = ['All', 'Food & Drink', 'Coffee', 'Retail', 'Fitness', 'Tech', 'Entertainment'];

const STATS = [
  { label:'Students saving', value:'47,000+' },
  { label:'Campus deals', value:'2,400+' },
  { label:'Partner businesses', value:'380+' },
  { label:'Avg. student saving', value:'£340/yr' },
];

const HOW_STUDENT = [
  { icon:<GraduationCap size={22}/>, step:'1', title:'Verify your student status', desc:'Use your .edu email or upload your student ID. One-time setup, instantly reusable.' },
  { icon:<Search size={22}/>, step:'2', title:'Discover local deals', desc:'Browse hundreds of exclusive student offers near your campus, updated weekly.' },
  { icon:<QrCode size={22}/>, step:'3', title:'Claim & redeem in seconds', desc:'Tap claim, show your QR code at the counter — done. No apps to download, no printing.' },
];

const HOW_VENDOR = [
  { icon:<Store size={22}/>, step:'1', title:'Create your business profile', desc:'List your business, set your student discount, and go live in under 10 minutes.' },
  { icon:<Tag size={22}/>, step:'2', title:'Students discover you', desc:'Your deals appear in front of thousands of verified local students instantly.' },
  { icon:<BarChart3 size={22}/>, step:'3', title:'Scan, confirm, grow', desc:'Use the built-in QR scanner to confirm redemptions. Track ROI with live analytics.' },
];

const FEATURES = [
  { icon:<Shield size={20}/>, title:'Fraud-proof verification', desc:'Every student is verified via .edu email or institution ID. Vendors never get scammed.' },
  { icon:<Zap size={20}/>, title:'Instant redemption', desc:'QR codes generate in real-time with a 24-hour expiry. Fast at the point of sale.' },
  { icon:<BarChart3 size={20}/>, title:'Live analytics dashboard', desc:'See redemption rates, peak hours, and revenue impact — all connected to your POS workflow.' },
  { icon:<MapPin size={20}/>, title:'Hyper-local targeting', desc:'Only students near your campus see your deals. No wasted impressions.' },
];

const VENDOR_METRICS = [
  { label:'Total Redemptions', value:'1,247', delta:'+18%', color:'text-vendor-600' },
  { label:'Unique Students', value:'834', delta:'+12%', color:'text-blue-600' },
  { label:'Avg. Basket Value', value:'£14.80', delta:'+£2.10', color:'text-purple-600' },
  { label:'Conversion Rate', value:'34.2%', delta:'+4.1pp', color:'text-amber-600' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function OfferCard({ offer, onClaim }: { offer: typeof OFFERS[0]; onClaim: (o: typeof OFFERS[0]) => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="card-hover overflow-hidden group">
      {/* Image area */}
      <div className="relative h-36 bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-5xl">
        {offer.img}
        <span className="absolute top-3 left-3 discount-badge">{offer.discount}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setSaved(s => !s); }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all ${saved ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-500 hover:text-red-400'}`}
        >
          <Heart size={14} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      {/* Body */}
      <div className="p-4">
        <span className="category-badge mb-2 inline-block">{offer.category}</span>
        <h3 className="font-bold text-gray-900 text-sm leading-tight mb-0.5">{offer.title}</h3>
        <p className="text-xs text-gray-500 mb-3">{offer.vendor}</p>
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
          <span className="flex items-center gap-1"><MapPin size={11}/>{offer.distance}</span>
          <span className="flex items-center gap-1"><Clock size={11}/>Expires in {offer.expiry}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 flex items-center gap-1"><Users size={11}/>{offer.claimed} claimed</span>
          <button onClick={() => onClaim(offer)} className="btn-primary py-1.5 px-3 text-xs rounded-lg">
            Claim Deal
          </button>
        </div>
      </div>
    </div>
  );
}

function VoucherModal({ offer, onClose }: { offer: typeof OFFERS[0] | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!offer) return null;
  const code = 'STUD-X7K2-M3P9';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X size={20}/>
          </button>
          <div className="text-4xl mb-2">{offer.img}</div>
          <h2 className="font-black text-lg mb-1">{offer.title}</h2>
          <p className="text-brand-200 text-sm">{offer.vendor}</p>
          <div className="mt-3 inline-block bg-white/20 rounded-xl px-4 py-1.5 text-2xl font-black">{offer.discount}</div>
        </div>
        {/* QR */}
        <div className="p-6 text-center">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Your Voucher Code</p>
          {/* SVG QR placeholder */}
          <div className="qr-container mx-auto mb-4" style={{width:160,height:160}}>
            <svg width="144" height="144" viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
              <rect width="144" height="144" fill="white"/>
              {/* Top-left finder */}
              <rect x="8" y="8" width="40" height="40" rx="4" fill="#1e1b4b"/>
              <rect x="14" y="14" width="28" height="28" rx="2" fill="white"/>
              <rect x="20" y="20" width="16" height="16" rx="1" fill="#1e1b4b"/>
              {/* Top-right finder */}
              <rect x="96" y="8" width="40" height="40" rx="4" fill="#1e1b4b"/>
              <rect x="102" y="14" width="28" height="28" rx="2" fill="white"/>
              <rect x="108" y="20" width="16" height="16" rx="1" fill="#1e1b4b"/>
              {/* Bottom-left finder */}
              <rect x="8" y="96" width="40" height="40" rx="4" fill="#1e1b4b"/>
              <rect x="14" y="102" width="28" height="28" rx="2" fill="white"/>
              <rect x="20" y="108" width="16" height="16" rx="1" fill="#1e1b4b"/>
              {/* Data modules */}
              {[56,64,72,80,88].map(x => [56,64,72,80,88].map(y =>
                Math.sin(x*y) > 0 ? <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" fill="#1e1b4b"/> : null
              ))}
              {[56,72,88].map(x => [8,16,24,32,40].map(y =>
                (x+y)%16===0 ? <rect key={`d${x}-${y}`} x={x} y={y} width="6" height="6" fill="#1e1b4b"/> : null
              ))}
              {[8,16,24,32,40].map(x => [56,72,88].map(y =>
                (x+y)%14===0 ? <rect key={`e${x}-${y}`} x={x} y={y} width="6" height="6" fill="#1e1b4b"/> : null
              ))}
            </svg>
          </div>
          {/* Code */}
          <div className="flex items-center justify-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-4">
            <span className="font-mono font-black text-lg tracking-[0.18em] text-gray-900">{code}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(code).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
              className={`ml-1 p-1.5 rounded-lg transition-colors ${copied ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-brand-600 hover:bg-brand-50'}`}
            >
              {copied ? <CheckCircle size={15}/> : <Copy size={15}/>}
            </button>
          </div>
          {/* Timer */}
          <div className="flex items-center justify-center gap-1.5 text-amber-600 text-xs font-semibold mb-4">
            <Clock size={13}/> Expires in 23:47:12
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">Show this QR code or read out the code to the vendor at the point of sale. Valid for one use only.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'landing'|'student'|'vendor'>('landing');
  const [category, setCategory] = useState('All');
  const [claimedOffer, setClaimedOffer] = useState<typeof OFFERS[0] | null>(null);
  const [scanState, setScanState] = useState<'idle'|'loading'|'success'>('idle');
  const [codeInput, setCodeInput] = useState('');

  const filteredOffers = category === 'All' ? OFFERS : OFFERS.filter(o => o.category === category);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* ── Preview Tab Bar ───────────────────────────────────────────── */}
      <div className="fixed top-0 inset-x-0 z-40 flex justify-center pt-3 pb-2 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['landing','student','vendor'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab === 'landing' ? '🏠 Landing' : tab === 'student' ? '🎓 Student' : '🏪 Vendor'}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-14">

        {/* ════════════════════════════════════════════════════════════════
            LANDING PAGE
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'landing' && (
          <div>
            {/* Hero */}
            <section className="relative bg-[#1e1b4b] text-white overflow-hidden">
              {/* Grid texture */}
              <div className="absolute inset-0 opacity-10"
                style={{backgroundImage:'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)',backgroundSize:'40px 40px'}}/>
              {/* Glow orbs */}
              <div className="absolute top-20 left-1/4 w-72 h-72 bg-brand-600/30 rounded-full blur-3xl"/>
              <div className="absolute bottom-10 right-1/4 w-56 h-56 bg-purple-400/20 rounded-full blur-2xl"/>

              <div className="relative max-w-5xl mx-auto px-6 py-20 text-center">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm mb-8">
                  <Zap size={14} className="text-yellow-400"/>
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
                  <button onClick={() => setActiveTab('student')}
                    className="btn-primary bg-white text-brand-700 hover:bg-brand-50 text-base px-8 py-3 rounded-2xl shadow-lg">
                    I&apos;m a Student <ArrowRight size={18}/>
                  </button>
                  <button onClick={() => setActiveTab('vendor')}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl border-2 border-white/30 text-white font-bold text-base hover:bg-white/10 transition-all">
                    I&apos;m a Business <Store size={18}/>
                  </button>
                </div>
              </div>
            </section>

            {/* Stats bar */}
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

            {/* How it works — Students */}
            <section className="max-w-4xl mx-auto px-6 py-16">
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

            {/* How it works — Vendors */}
            <section className="bg-white border-t border-b border-gray-100">
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

            {/* Features */}
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

            {/* CTA */}
            <section className="bg-gradient-to-br from-brand-600 to-brand-900 text-white py-16 px-6">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-4xl font-black mb-4">Ready to launch?</h2>
                <p className="text-brand-200 mb-8 text-lg">Join thousands of students and businesses already on the platform.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button onClick={() => setActiveTab('student')}
                    className="btn-primary bg-white text-brand-700 hover:bg-brand-50 text-base px-8 py-3 rounded-2xl">
                    Start Saving — It&apos;s Free
                  </button>
                  <button onClick={() => setActiveTab('vendor')}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl border-2 border-white/40 font-bold text-base hover:bg-white/10 transition-all">
                    List Your Business
                  </button>
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-8 px-6 text-center text-sm">
              <div className="flex items-center justify-center gap-2 mb-2">
                <GraduationCap size={18} className="text-brand-400"/>
                <span className="text-white font-bold text-base">Stud-deals</span>
              </div>
              <p>© 2026 Stud-deals. The student marketplace that just works.</p>
            </footer>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STUDENT DASHBOARD
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'student' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            {/* Navbar */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-gray-400">Good afternoon,</p>
                <h2 className="text-lg font-black text-gray-900">Emmanuel 👋</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="status-verified"><CheckCircle size={11}/> Verified</div>
                <button className="relative w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                  <Bell size={16} className="text-gray-600"/>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-600 rounded-full"/>
                </button>
                <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-sm">E</div>
              </div>
            </div>

            {/* Savings chip */}
            <div className="card bg-gradient-to-r from-brand-50 to-purple-50 border-brand-200 p-4 flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0">
                <Star size={18} className="text-white"/>
              </div>
              <div>
                <p className="text-xs text-gray-500">Your total savings this term</p>
                <p className="text-xl font-black text-brand-700">£127.40 saved</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-brand-400"/>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-brand-400 shadow-sm"
                placeholder="Search deals near campus…"
              />
            </div>

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-5">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={category === c ? 'filter-pill-active' : 'filter-pill-inactive'}
                >
                  {c === 'Food & Drink' && <Pizza size={12}/>}
                  {c === 'Coffee' && <Coffee size={12}/>}
                  {c === 'Retail' && <ShoppingBag size={12}/>}
                  {c === 'Fitness' && <Dumbbell size={12}/>}
                  {c === 'Tech' && <Laptop size={12}/>}
                  {c === 'Entertainment' && <BookOpen size={12}/>}
                  {c}
                </button>
              ))}
            </div>

            {/* Offers grid */}
            <div className="grid grid-cols-2 gap-3">
              {filteredOffers.map(offer => (
                <OfferCard key={offer.id} offer={offer} onClaim={setClaimedOffer}/>
              ))}
            </div>

            {/* Voucher modal */}
            {claimedOffer && <VoucherModal offer={claimedOffer} onClose={() => setClaimedOffer(null)}/>}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            VENDOR DASHBOARD
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'vendor' && (
          <div className="max-w-2xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-gray-400">Vendor Dashboard</p>
                <h2 className="text-lg font-black text-gray-900">The Library Café ☕</h2>
              </div>
              <div className="status-verified"><CheckCircle size={11}/> Business Verified</div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {VENDOR_METRICS.map(m => (
                <div key={m.label} className="card p-4">
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-green-600 font-semibold mt-1">{m.delta} this month</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                onClick={() => setScanState('idle')}
                className="btn-vendor py-3 rounded-2xl w-full text-base"
              >
                <QrCode size={18}/> Scan Code
              </button>
              <button className="btn-primary py-3 rounded-2xl w-full text-base">
                <Tag size={18}/> New Offer
              </button>
            </div>

            {/* Scanner panel */}
            <div className="card p-5 mb-5">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">Redemption Scanner</h3>

              {scanState === 'success' ? (
                <div className="text-center py-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-vendor-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={36} className="text-vendor-600"/>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-1">Voucher Accepted!</h3>
                  <p className="text-gray-500 text-sm mb-4">Apply the discount for this customer.</p>
                  <div className="bg-vendor-50 border-2 border-vendor-200 rounded-2xl p-4 mb-4 text-left">
                    <div className="text-2xl font-black text-vendor-700 mb-1">30% OFF</div>
                    <div className="text-sm font-semibold text-gray-700">All meals — dine-in & takeaway</div>
                    <div className="mt-3 pt-3 border-t border-vendor-200 flex justify-between text-sm">
                      <span className="text-gray-500">Student</span>
                      <span className="font-bold">Emmanuel A.</span>
                    </div>
                  </div>
                  <button onClick={() => { setScanState('idle'); setCodeInput(''); }} className="btn-vendor w-full">
                    <RotateCcw size={15}/> Scan another code
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mode toggle */}
                  <div className="flex rounded-xl bg-gray-100 p-1">
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold bg-white text-gray-900 shadow-sm">
                      ⌨️ Enter code
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-700">
                      📷 Scan QR
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Student voucher code
                    </label>
                    <input
                      type="text"
                      value={codeInput}
                      onChange={e => {
                        const clean = e.target.value.replace(/[^A-Z0-9]/gi,'').toUpperCase();
                        let fmt = clean;
                        if (clean.length > 4) fmt = `${clean.slice(0,4)}-${clean.slice(4)}`;
                        if (clean.length > 8) fmt = `${clean.slice(0,4)}-${clean.slice(4,8)}-${clean.slice(8,12)}`;
                        setCodeInput(fmt);
                      }}
                      placeholder="STUD-XXXX-XXXX"
                      maxLength={14}
                      className="w-full text-center text-2xl font-black tracking-[0.2em] font-mono bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-vendor-400 focus:bg-white transition-colors placeholder:text-gray-300 placeholder:text-lg"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (codeInput.length < 14) return;
                      setScanState('loading');
                      setTimeout(() => setScanState('success'), 1500);
                    }}
                    disabled={codeInput.length < 14 || scanState === 'loading'}
                    className={`w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all ${
                      codeInput.length < 14
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-vendor-600 text-white hover:bg-vendor-700 shadow-sm'
                    }`}
                  >
                    {scanState === 'loading'
                      ? <><Loader2 size={18} className="animate-spin"/> Validating…</>
                      : <><CheckCircle size={18}/> Confirm Voucher</>
                    }
                  </button>
                  <p className="text-center text-xs text-gray-400">
                    Type the code from the student&apos;s screen, or switch to QR scan mode.
                  </p>
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="card p-5">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">Recent Redemptions (24h)</h3>
              <div className="space-y-3">
                {[
                  { name:'Student M.', discount:'30% OFF', time:'2 min ago', code:'STUD-4F2X-9K1M' },
                  { name:'Student A.', discount:'30% OFF', time:'18 min ago', code:'STUD-7R3P-2N8Q' },
                  { name:'Student J.', discount:'BOGO',    time:'1 hr ago',  code:'STUD-K5W1-8C4T' },
                  { name:'Student B.', discount:'30% OFF', time:'2 hr ago',  code:'STUD-M2L6-5J9V' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-vendor-100 flex items-center justify-center text-xs font-bold text-vendor-700">
                        {r.name[8]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{r.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="discount-badge text-[10px] px-2 py-0.5">{r.discount}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{r.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
