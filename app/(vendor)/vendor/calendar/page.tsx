'use client';

// =============================================================================
// app/(vendor)/vendor/calendar/page.tsx — Campaign Calendar
//
// Monthly calendar view of all vendor offers.
// Each offer occupies its active date range (starts_at → expires_at).
// Colour-coded by type:
//   boost      → amber  (offers with [[BOOST: prefix)
//   loyalty    → purple (offers with [[LOYALTY: prefix)
//   scheduled  → blue   (status = 'scheduled' / starts_at in future)
//   active     → green
//   expired    → gray
//   paused     → orange
//
// Features:
//   - Month navigation (prev / next)
//   - Day cell click → slide-out list of offers for that day
//   - "Schedule new offer" link on future-date click
//   - Week row with "today" highlight
//   - List view toggle (flat chronological list)
//
// Offer scheduling (starts_at in future):
//   Setting starts_at to a future date on an offer sets it to 'scheduled' status.
//   This page shows scheduled offers in blue before they go live.
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  ChevronLeft, ChevronRight, Plus, Tag, Gift, Zap, Calendar,
  List, Clock, CheckCircle, X, Loader2, ArrowRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalOffer {
  id: string;
  title: string;
  discount_label: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  terms_and_conditions: string | null;
  offerType: 'boost' | 'loyalty' | 'scheduled' | 'active' | 'expired' | 'paused';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyOffer(o: CalOffer): CalOffer['offerType'] {
  const terms = o.terms_and_conditions ?? '';
  if (terms.startsWith('[[BOOST:'))   return 'boost';
  if (terms.startsWith('[[LOYALTY:')) return 'loyalty';
  if (o.status === 'scheduled' || new Date(o.starts_at) > new Date()) return 'scheduled';
  if (o.status === 'paused')  return 'paused';
  if (o.status === 'expired') return 'expired';
  return 'active';
}

const TYPE_CONFIG: Record<CalOffer['offerType'], { bg: string; text: string; border: string; label: string }> = {
  boost:     { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300',  label: 'Boost'     },
  loyalty:   { bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-300', label: 'Loyalty'   },
  scheduled: { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300',   label: 'Scheduled' },
  active:    { bg: 'bg-green-100',   text: 'text-green-800',   border: 'border-green-300',  label: 'Active'    },
  expired:   { bg: 'bg-gray-100',    text: 'text-gray-500',    border: 'border-gray-200',   label: 'Expired'   },
  paused:    { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-300', label: 'Paused'    },
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isoDate(d: Date) {
  return d.toISOString().slice(0,10);
}

function offersOnDay(offers: CalOffer[], date: Date): CalOffer[] {
  const d = isoDate(date);
  return offers.filter(o => {
    const start = isoDate(new Date(o.starts_at));
    const end   = o.expires_at ? isoDate(new Date(o.expires_at)) : start;
    return d >= start && d <= end;
  });
}

// ── Offer pill ─────────────────────────────────────────────────────────────────

function OfferPill({ offer }: { offer: CalOffer }) {
  const cfg = TYPE_CONFIG[offer.offerType];
  return (
    <div className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md truncate ${cfg.bg} ${cfg.text} max-w-full`}>
      {offer.title.slice(0, 16)}
    </div>
  );
}

// ── Day detail panel ───────────────────────────────────────────────────────────

function DayPanel({
  date,
  offers,
  onClose,
}: {
  date: Date;
  offers: CalOffer[];
  onClose: () => void;
}) {
  const isFuture = date > new Date();
  const label = date.toLocaleDateString('hu-HU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold text-gray-900">{label}</p>
          <p className="text-xs text-gray-400">{offers.length} offer{offers.length !== 1 ? 's' : ''} active</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-4">
          <Calendar size={22} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400 mb-3">No offers on this day.</p>
          {isFuture && (
            <Link
              href="/vendor/offers/create"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-vendor-600 hover:underline"
            >
              <Plus size={12} /> Schedule an offer for this day
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {offers.map(o => {
            const cfg = TYPE_CONFIG[o.offerType];
            return (
              <Link
                key={o.id}
                href={`/vendor/offers/${o.id}`}
                className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border} hover:opacity-90 transition-opacity`}
              >
                <div className={`flex-shrink-0 text-xs font-black px-2 py-1 rounded-lg bg-white/60 ${cfg.text}`}>
                  {o.discount_label?.slice(0,6) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${cfg.text} line-clamp-1`}>{o.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/50 ${cfg.text}`}>
                      {cfg.label}
                    </span>
                    {o.expires_at && (
                      <span className="text-[10px] text-gray-500">
                        ends {new Date(o.expires_at).toLocaleDateString('hu-HU', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight size={13} className={cfg.text} />
              </Link>
            );
          })}
          {isFuture && (
            <Link
              href="/vendor/offers/create"
              className="flex items-center gap-1.5 text-xs font-bold text-vendor-600 hover:underline mt-2"
            >
              <Plus size={12} /> Add another offer
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [offers, setOffers]   = useState<CalOffer[]>([]);
  const [view, setView]       = useState<'month' | 'list'>('month');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year,  setYear]  = useState(today.getFullYear());

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?role=vendor'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (!vp) { router.push('/vendor/profile'); return; }

      const { data } = await supabase
        .from('offers')
        .select('id, title, discount_label, status, starts_at, expires_at, terms_and_conditions')
        .eq('vendor_id', vp.id)
        .neq('status', 'deleted')
        .order('starts_at', { ascending: true })
        .limit(500); // guard against unbounded fetch on high-volume accounts

      const classified = (data ?? []).map(o => ({
        ...o,
        offerType: classifyOffer({ ...o, offerType: 'active' } as CalOffer),
      })) as CalOffer[];

      setOffers(classified);
      setLoading(false);
    } catch (_) { setLoading(false); }
    })();
  }, []);

  // ── Calendar grid ──

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const startDow        = firstDayOfMonth.getDay(); // 0=Sun

  // Build cell array (null = padding)
  const cells: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const selectedOffers = selectedDay ? offersOnDay(offers, selectedDay) : [];

  // List view: all offers sorted by starts_at
  const listOffers = [...offers].sort((a,b) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  if (loading) return (
    <><Navbar /><VendorNav />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-vendor-600" />
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Campaign Calendar</h1>
              <p className="text-gray-500 text-sm mt-0.5">Plan and visualise your offer schedule.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View toggle */}
              <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm">
                <button
                  onClick={() => setView('month')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view==='month'?'bg-vendor-600 text-white':'text-gray-500 hover:text-gray-700'}`}
                >
                  <Calendar size={13} /> Month
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view==='list'?'bg-vendor-600 text-white':'text-gray-500 hover:text-gray-700'}`}
                >
                  <List size={13} /> List
                </button>
              </div>
              <Link href="/vendor/offers/create" className="btn-vendor">
                <Plus size={15} /> New offer
              </Link>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-5">
            {(Object.entries(TYPE_CONFIG) as [CalOffer['offerType'], typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${cfg.bg} border ${cfg.border}`} />
                <span className="text-xs text-gray-500 font-medium">{cfg.label}</span>
              </div>
            ))}
          </div>

          <div className={`grid gap-5 ${selectedDay ? 'lg:grid-cols-3' : ''}`}>
            <div className={selectedDay ? 'lg:col-span-2' : ''}>

              {/* ── Month view ── */}
              {view === 'month' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Month header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <button onClick={prevMonth} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <ChevronLeft size={18} />
                    </button>
                    <h2 className="text-base font-black text-gray-900">
                      {MONTH_NAMES[month]} {year}
                    </h2>
                    <button onClick={nextMonth} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 border-b border-gray-100">
                    {DAY_NAMES.map(d => (
                      <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-2 uppercase tracking-wide">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar cells */}
                  <div className="grid grid-cols-7">
                    {cells.map((date, idx) => {
                      if (!date) {
                        return <div key={`pad-${idx}`} className="min-h-[80px] border-b border-r border-gray-50" />;
                      }
                      const dayOffers = offersOnDay(offers, date);
                      const isToday = isoDate(date) === isoDate(today);
                      const isSelected = selectedDay && isoDate(date) === isoDate(selectedDay);
                      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                      return (
                        <div
                          key={isoDate(date)}
                          onClick={() => setSelectedDay(isSelected ? null : date)}
                          className={`min-h-[80px] p-1.5 border-b border-r border-gray-50 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-vendor-50 border-vendor-200'
                              : isPast
                                ? 'bg-gray-50/50 hover:bg-gray-100/50'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1 ${
                            isToday
                              ? 'bg-vendor-600 text-white'
                              : isPast
                                ? 'text-gray-400'
                                : 'text-gray-700'
                          }`}>
                            {date.getDate()}
                          </div>
                          <div className="space-y-0.5">
                            {dayOffers.slice(0, 2).map(o => (
                              <OfferPill key={o.id} offer={o} />
                            ))}
                            {dayOffers.length > 2 && (
                              <div className="text-[9px] text-gray-400 font-semibold pl-1">
                                +{dayOffers.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── List view ── */}
              {view === 'list' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {listOffers.length === 0 ? (
                    <div className="p-10 text-center">
                      <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-bold text-gray-500 mb-1">No offers yet</p>
                      <Link href="/vendor/offers/create" className="text-xs text-vendor-600 font-semibold hover:underline">
                        Create your first offer →
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {listOffers.map(o => {
                        const cfg = TYPE_CONFIG[o.offerType];
                        const start = new Date(o.starts_at);
                        const end   = o.expires_at ? new Date(o.expires_at) : null;
                        return (
                          <Link
                            key={o.id}
                            href={`/vendor/offers/${o.id}`}
                            className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                              <span className={`text-xs font-black ${cfg.text}`}>{o.discount_label?.slice(0,4) ?? '?'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 line-clamp-1">{o.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {start.toLocaleDateString('hu-HU', { day:'numeric', month:'short' })}
                                  {end ? ` → ${end.toLocaleDateString('hu-HU', { day:'numeric', month:'short' })}` : ' (no expiry)'}
                                </span>
                              </div>
                            </div>
                            <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Day detail panel */}
            {selectedDay && view === 'month' && (
              <div className="lg:col-span-1">
                <DayPanel
                  date={selectedDay}
                  offers={selectedOffers}
                  onClose={() => setSelectedDay(null)}
                />
              </div>
            )}
          </div>

          {/* Tip: scheduling */}
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
            <Clock size={15} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-0.5">Schedule offers in advance</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                When creating an offer, set the <strong>Start date</strong> to a future date and it will automatically go live on that day.
                Great for planning around exam weeks, freshers&apos; week, and university events.
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
