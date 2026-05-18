// @ts-nocheck
'use client';

// =============================================================================
// /admin/vendors/[id] — Vendor 360° Deep-Dive
//
// Shows: business details, plan tier + manual override, all offers with loyalty
// configs, redemption stats, active stamp card count, top students, stamp
// override tool, and a link to view their redemptions.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AdminNav from '@/components/admin/AdminNav';
import {
  Store, ArrowLeft, MapPin, Mail, Globe, Phone, Shield,
  Tag, Loader2, RefreshCw, CheckCircle, XCircle, Clock,
  Crown, Gift, Stamp, Users, TrendingUp, AlertTriangle,
  ChevronDown, Minus, Plus, Activity, Key,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface VendorDetail {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string | null;
  description: string | null;
  city: string;
  business_email: string | null;
  business_phone: string | null;
  website_url: string | null;
  logo_url: string | null;
  is_verified: boolean;
  verified_at: string | null;
  rejection_notes: string | null;
  created_at: string;
  email: string | null;
  staff_pin: string | null;
  approval_status: string;
  plan_tier: string | null;
  plan_status: string | null;
  trial_ends_at: string | null;
}

interface OfferDetail {
  id: string;
  title: string;
  category: string | null;
  status: string;
  discount_value: number | null;
  discount_type: string | null;
  created_at: string;
  loyalty_config: Record<string, unknown> | null;
}

interface TopStudent {
  id: string;
  name: string;
  stamps: number;
}

interface VendorData {
  vendor: VendorDetail;
  offers: OfferDetail[];
  redemption_summary: {
    all_time:     { stamps: number; claims: number; rewards: number; total: number };
    last_30_days: { stamps: number; claims: number; rewards: number; total: number };
  };
  active_stamp_cards: number;
  top_students: TopStudent[];
}

const PLAN_COLORS: Record<string, string> = {
  free:   'bg-gray-100 text-gray-600',
  growth: 'bg-purple-100 text-purple-700',
  pro:    'bg-amber-100 text-amber-700',
};
const STATUS_COLORS: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  canceled: 'bg-red-100 text-red-700',
  past_due: 'bg-orange-100 text-orange-700',
};

// ── Stamp Override Modal ───────────────────────────────────────────────────────
function StampOverrideModal({
  vendor,
  offers,
  onClose,
}: {
  vendor: VendorDetail;
  offers: OfferDetail[];
  onClose: () => void;
}) {
  const loyaltyOffers = offers.filter((o) => o.loyalty_config);
  const [selectedOffer, setSelectedOffer] = useState(loyaltyOffers[0]?.id ?? '');
  const [studentId, setStudentId] = useState('');
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!studentId.trim()) { setErr('Enter a student ID'); return; }
    if (!reason.trim() || reason.trim().length < 5) { setErr('Reason must be at least 5 characters'); return; }
    if (!selectedOffer) { setErr('Select an offer'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stamp-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId.trim(),
          vendor_id:  vendor.id,
          offer_id:   selectedOffer,
          delta,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? 'Failed'); return; }
      setDone(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="font-black text-gray-900 text-lg mb-1">Manual Stamp Override</h3>
        <p className="text-sm text-gray-500 mb-5">
          Credit or debit stamps for a specific student at <strong>{vendor.business_name}</strong>. Every adjustment is audit-logged and the student is notified.
        </p>

        {done ? (
          <div className="text-center py-6">
            <CheckCircle size={36} className="text-green-500 mx-auto mb-3" />
            <p className="font-bold text-gray-900">Override applied</p>
            <p className="text-sm text-gray-500 mt-1">Student notified · Logged to audit trail</p>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Loyalty offer</label>
              {loyaltyOffers.length === 0 ? (
                <p className="text-sm text-gray-400">This vendor has no loyalty (punch card) offers.</p>
              ) : (
                <select
                  value={selectedOffer}
                  onChange={(e) => setSelectedOffer(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                >
                  {loyaltyOffers.map((o) => (
                    <option key={o.id} value={o.id}>{o.title}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Student ID (UUID)</label>
              <input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. 3f7b2c1d-…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Find in Users → copy student's profile ID</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Stamp adjustment</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDelta((d) => Math.max(-20, d - 1))}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                >
                  <Minus size={14} />
                </button>
                <span className={`text-2xl font-black w-16 text-center ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
                <button
                  onClick={() => setDelta((d) => Math.min(20, d + 1))}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                >
                  <Plus size={14} />
                </button>
                <span className="text-xs text-gray-400 ml-2">stamps {delta >= 0 ? '(credit)' : '(debit)'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Reason <span className="text-red-500">*</span></label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Scanner malfunction on 2026-05-18, student reported missed stamp."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
              />
            </div>

            {err && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={13} />{err}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={loading || loyaltyOffers.length === 0 || delta === 0}
                className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Apply override'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan Override Panel ────────────────────────────────────────────────────────
function PlanPanel({ vendor, onUpdated }: { vendor: VendorDetail; onUpdated: () => void }) {
  const [tier, setTier]       = useState(vendor.plan_tier ?? 'free');
  const [status, setStatus]   = useState(vendor.plan_status ?? 'active');
  const [trialDays, setTrialDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);

  const save = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const body: Record<string, unknown> = { plan_tier: tier, plan_status: status };
      if (trialDays > 0) body.extend_trial_days = trialDays;
      const res = await fetch(`/api/admin/vendors/${vendor.id}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setSaved(true); onUpdated(); setTimeout(() => setSaved(false), 3000); }
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
        <Crown size={14} className="text-amber-500" /> Plan Management
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Tier</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
          >
            <option value="free">Free</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
          >
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="canceled">Canceled</option>
            <option value="past_due">Past due</option>
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Extend trial by (days)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={365}
            value={trialDays}
            onChange={(e) => setTrialDays(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
          {vendor.trial_ends_at && (
            <span className="text-xs text-gray-400">
              Current trial ends: {new Date(vendor.trial_ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={save}
        disabled={loading}
        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
          saved ? 'bg-green-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
        } disabled:opacity-50`}
      >
        {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : saved ? '✓ Saved & logged' : 'Save plan changes'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VendorDeepDivePage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = params.id as string;

  const [data, setData]           = useState<VendorData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showStampModal, setShowStampModal] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/sign-in');
    });
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/vendors/${vendorId}`);
      if (!res.ok) { router.push('/admin/vendors'); return; }
      const json = await res.json();
      setData(json);
    } finally { setLoading(false); }
  }, [vendorId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-purple-400" />
    </div>
  );
  if (!data) return null;

  const { vendor, offers, redemption_summary: rs, active_stamp_cards, top_students } = data;

  const approvalColor =
    vendor.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
    vendor.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
    'bg-amber-100 text-amber-700';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav active="/admin/vendors" />
      {showStampModal && (
        <StampOverrideModal
          vendor={vendor}
          offers={offers}
          onClose={() => setShowStampModal(false)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/vendors" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-semibold">
            <ArrowLeft size={15} /> Vendors
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-bold text-gray-700">{vendor.business_name}</span>
          <button onClick={fetchData} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-5">

            {/* Business card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {vendor.logo_url
                    ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" />
                    : <Store size={24} className="text-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h1 className="text-xl font-black text-gray-900">{vendor.business_name}</h1>
                      <p className="text-sm text-gray-500">{vendor.business_type ?? 'Business'}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${approvalColor}`}>
                        {vendor.approval_status === 'approved' ? '✓ Approved' :
                         vendor.approval_status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                      </span>
                      {vendor.plan_tier && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_COLORS[vendor.plan_tier] ?? 'bg-gray-100 text-gray-600'}`}>
                          {vendor.plan_tier.charAt(0).toUpperCase() + vendor.plan_tier.slice(1)}
                        </span>
                      )}
                      {vendor.plan_status && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[vendor.plan_status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {vendor.plan_status}
                        </span>
                      )}
                    </div>
                  </div>

                  {vendor.description && (
                    <p className="text-sm text-gray-600 mt-2">{vendor.description}</p>
                  )}

                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><MapPin size={11} />{vendor.city}</span>
                    {vendor.email && <span className="flex items-center gap-1"><Mail size={11} />{vendor.email}</span>}
                    {vendor.business_email && vendor.business_email !== vendor.email && (
                      <span className="flex items-center gap-1"><Mail size={11} />{vendor.business_email}</span>
                    )}
                    {vendor.business_phone && <span className="flex items-center gap-1"><Phone size={11} />{vendor.business_phone}</span>}
                    {vendor.website_url && (
                      <a href={vendor.website_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:underline">
                        <Globe size={11} />{vendor.website_url.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {vendor.staff_pin && (
                      <span className="flex items-center gap-1"><Key size={11} />PIN: {vendor.staff_pin}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={11} />Joined {new Date(vendor.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {vendor.trial_ends_at && (
                      <span className="flex items-center gap-1 text-blue-500">
                        <Crown size={11} />Trial ends {new Date(vendor.trial_ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Redemption KPIs */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                <Activity size={14} className="text-purple-500" /> Redemption Summary
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Stamps (30d)',  value: rs.last_30_days.stamps,  icon: <Stamp  size={16} />, color: 'bg-purple-50 text-purple-600' },
                  { label: 'Claims (30d)',  value: rs.last_30_days.claims,  icon: <Tag    size={16} />, color: 'bg-blue-50   text-blue-600' },
                  { label: 'Rewards (30d)', value: rs.last_30_days.rewards, icon: <Gift   size={16} />, color: 'bg-amber-50  text-amber-600' },
                  { label: 'Active stamp cards', value: active_stamp_cards,  icon: <Users  size={16} />, color: 'bg-green-50  text-green-600' },
                ].map((kpi) => (
                  <div key={kpi.label} className={`${kpi.color.split(' ')[0]} rounded-xl p-4`}>
                    <div className={kpi.color.split(' ')[1]}>{kpi.icon}</div>
                    <div className="text-2xl font-black text-gray-900 mt-2">{kpi.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center text-xs">
                <div><div className="font-black text-gray-900 text-lg">{rs.all_time.stamps}</div><div className="text-gray-400">Total stamps</div></div>
                <div><div className="font-black text-gray-900 text-lg">{rs.all_time.rewards}</div><div className="text-gray-400">Total rewards</div></div>
                <div><div className="font-black text-gray-900 text-lg">{rs.all_time.claims}</div><div className="text-gray-400">Total claims</div></div>
              </div>
            </div>

            {/* Offers */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                <Tag size={14} className="text-blue-500" /> Offers ({offers.length})
              </h2>
              {offers.length === 0 ? (
                <p className="text-sm text-gray-400">No offers created yet.</p>
              ) : (
                <div className="space-y-3">
                  {offers.map((o) => (
                    <div key={o.id} className="flex items-start justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{o.title}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">{o.category ?? '—'}</span>
                          {o.discount_value != null && (
                            <span className="text-xs text-gray-500">
                              {o.discount_type === 'percentage' ? `${o.discount_value}%` : `${o.discount_value} HUF`}
                            </span>
                          )}
                          {o.loyalty_config && (
                            <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-semibold">
                              Punch card · {(o.loyalty_config as any).required_visits ?? '?'} stamps
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        o.status === 'active' ? 'bg-green-100 text-green-700' :
                        o.status === 'draft'  ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{o.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top students */}
            {top_students.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-500" /> Top Students by Stamps
                </h2>
                <div className="space-y-2">
                  {top_students.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-gray-400">{i + 1}.</span>
                      <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">
                        {s.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="flex-1 text-sm font-semibold text-gray-700 truncate">{s.name}</span>
                      <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        {s.stamps} stamps
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">
            {/* Plan management */}
            <PlanPanel vendor={vendor} onUpdated={fetchData} />

            {/* Stamp override */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-2 flex items-center gap-2">
                <Stamp size={14} className="text-purple-500" /> Stamp Override
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Manually credit or debit stamps for a student. Required for scanner failures and dispute resolution.
              </p>
              <button
                onClick={() => setShowStampModal(true)}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Open override tool
              </button>
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-wide mb-3">Quick links</h2>
              <div className="space-y-2">
                <Link
                  href={`/admin/offers?vendor_id=${vendor.id}`}
                  className="flex items-center justify-between text-sm text-purple-600 hover:text-purple-800 font-semibold py-1"
                >
                  View all offers <Tag size={13} />
                </Link>
                <Link
                  href={`/admin/users?q=${encodeURIComponent(vendor.business_name)}`}
                  className="flex items-center justify-between text-sm text-purple-600 hover:text-purple-800 font-semibold py-1"
                >
                  Find in users <Users size={13} />
                </Link>
                <Link
                  href={`/admin/audit-log`}
                  className="flex items-center justify-between text-sm text-purple-600 hover:text-purple-800 font-semibold py-1"
                >
                  Audit log <Activity size={13} />
                </Link>
              </div>
            </div>

            {/* Vendor ID */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Vendor profile ID</p>
              <p className="text-xs font-mono text-gray-600 break-all">{vendor.id}</p>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 mt-2">Auth user ID</p>
              <p className="text-xs font-mono text-gray-600 break-all">{vendor.user_id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
