'use client';

/**
 * /vendor/flash — Vendor Flash Deal Tool
 * Send a time-limited offer push to students near your campus.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Zap, Clock, Users, Target, CheckCircle2, AlertTriangle,
  Send, ChevronRight, History, XCircle, Timer
} from 'lucide-react';

interface FlashDeal {
  id: string;
  title: string;
  discount_text: string;
  starts_at: string;
  ends_at: string;
  max_redemptions: number;
  redeemed_count: number;
  is_active: boolean;
  created_at: string;
}

function TimeLeft({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) { setLeft('Expired'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(h > 0 ? `${h}h ${m}m left` : `${m}m ${s}s left`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return <span className="text-xs font-mono">{left}</span>;
}

export default function VendorFlashPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [success, setSuccess] = useState<{ message: string; notified: number } | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [discountText, setDiscountText] = useState('');
  const [description, setDescription] = useState('');
  const [durationMins, setDurationMins] = useState(120);
  const [maxRedemptions, setMaxRedemptions] = useState(30);
  const [radiusKm, setRadiusKm] = useState(2.0);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  async function checkAuthAndLoad() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/sign-in'); return; }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'vendor') { router.push('/dashboard'); return; }
    await loadDeals();
    setLoading(false);
  }

  async function loadDeals() {
    const res = await fetch('/api/vendor/flash-deal');
    if (res.ok) {
      const data = await res.json();
      setDeals(data.deals ?? []);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(null);

    if (!title.trim() || !discountText.trim()) {
      setError('Please fill in the deal title and offer text.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/vendor/flash-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          discount_text: discountText.trim(),
          description: description.trim() || undefined,
          duration_minutes: durationMins,
          max_redemptions: maxRedemptions,
          radius_km: radiusKm,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to send flash deal.'); return; }

      setSuccess({ message: data.message, notified: data.students_notified });
      setTitle(''); setDiscountText(''); setDescription('');
      await loadDeals();
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeDeals = deals.filter(d => d.is_active && new Date(d.ends_at) > new Date());
  const pastDeals = deals.filter(d => !d.is_active || new Date(d.ends_at) <= new Date());

  return (
    <div className="min-h-screen bg-surface-50">
      <VendorNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Flash Deals</h1>
              <p className="text-sm text-gray-500">Push a time-limited offer to students near your location</p>
            </div>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { icon: <Send size={14} />, label: 'You send a flash deal' },
              { icon: <Users size={14} />, label: 'Students near campus get notified instantly' },
              { icon: <Target size={14} />, label: 'They walk in before the timer runs out' },
            ].map((step, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
                <div className="flex items-center justify-center gap-1 text-brand-600 mb-1">
                  {step.icon}
                  <span className="text-xs font-bold">Step {i + 1}</span>
                </div>
                <p className="text-xs text-gray-600">{step.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Active deals */}
        {activeDeals.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Active Flash Deals
            </h2>
            <div className="space-y-2">
              {activeDeals.map(deal => (
                <div key={deal.id} className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{deal.title}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{deal.discount_text}</div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 bg-amber-100 px-2 py-1 rounded-lg">
                      <Timer size={12} />
                      <TimeLeft endsAt={deal.ends_at} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {deal.redeemed_count}/{deal.max_redemptions} redeemed
                    </span>
                    <div className="flex-1 bg-amber-200 rounded-full h-1.5">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, (deal.redeemed_count / deal.max_redemptions) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-green-800 text-sm">{success.message}</div>
              {success.notified === 0 && (
                <div className="text-xs text-green-600 mt-0.5">
                  No students found nearby yet — make sure your location is set in your profile.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Create flash deal form */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <h2 className="font-black text-gray-900 mb-5 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            Send a New Flash Deal
          </h2>

          <form onSubmit={handleSend} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Deal Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Lunch Rush Special"
                maxLength={60}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Offer Text <span className="text-gray-400 font-normal">(what students receive)</span>
              </label>
              <input
                type="text"
                value={discountText}
                onChange={e => setDiscountText(e.target.value)}
                placeholder="e.g. Free coffee upgrade with any sandwich"
                maxLength={100}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Additional Details <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Any extra info students need to know"
                rows={2}
                maxLength={200}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <Clock size={13} className="inline mr-1" />Duration
                </label>
                <select
                  value={durationMins}
                  onChange={e => setDurationMins(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                  <option value={240}>4 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <Users size={13} className="inline mr-1" />Max Students
                </label>
                <select
                  value={maxRedemptions}
                  onChange={e => setMaxRedemptions(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <Target size={13} className="inline mr-1" />Radius
                </label>
                <select
                  value={radiusKm}
                  onChange={e => setRadiusKm(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value={0.5}>500m</option>
                  <option value={1}>1 km</option>
                  <option value={2}>2 km</option>
                  <option value={5}>5 km</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Send Flash Deal
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">Free plan: up to 2 flash deals per 24 hours</p>
            </div>
          </form>
        </div>

        {/* Past deals history */}
        {pastDeals.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
              <History size={14} />
              Past Flash Deals
            </h2>
            <div className="space-y-2">
              {pastDeals.slice(0, 5).map(deal => (
                <div key={deal.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4 opacity-70">
                  <XCircle size={16} className="text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-700 text-sm truncate">{deal.title}</div>
                    <div className="text-xs text-gray-400">{deal.discount_text}</div>
                  </div>
                  <div className="text-right text-xs text-gray-400 flex-shrink-0">
                    <div>{deal.redeemed_count}/{deal.max_redemptions} redeemed</div>
                    <div>{new Date(deal.ends_at).toLocaleDateString('hu-HU')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
