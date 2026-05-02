'use client';

// =============================================================================
// app/(vendor)/vendor/customers/page.tsx — Vendor Customer Directory
//
// Shows all students who have earned stamps at this vendor, with:
//   - Name, email (masked if no GDPR consent), institution, stamp count,
//     last visit, rewards earned
//   - Sort controls: Most Stamps / Most Recent / Name A-Z
//   - Segment tabs: All / Loyal (5+ stamps) / Lapsed (30+ days)
//   - Search bar
//   - Send Promotion modal with subject, message, target group
//   - CSV export
//   - GDPR consent banner
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Users, Search, Mail, Building2, Star, Clock, Gift,
  Download, Send, ChevronDown, ChevronUp, Eye, EyeOff,
  Loader2, RefreshCw, X, CheckCircle, AlertCircle,
  TrendingUp, UserX, Crown, Megaphone,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CustomerRecord {
  student_profile_id: string;
  user_id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_masked: boolean;
  institution_name: string | null;
  stamp_count: number;
  rewards_earned: number;
  last_visit_at: string | null;
  first_visit_at: string | null;
  verification_status: string;
}

type SortMode = 'stamps' | 'recent' | 'name';
type Segment = 'all' | 'loyal' | 'lapsed';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('hu-HU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function isLapsed(lastVisit: string | null): boolean {
  if (!lastVisit) return false;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return new Date(lastVisit) < thirtyDaysAgo;
}

function daysSince(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StampDots({ count, max = 10 }: { count: number; max?: number }) {
  const displayMax = Math.min(max, 10);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: displayMax }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i < count ? 'bg-vendor-500' : 'bg-gray-200'
          }`}
        />
      ))}
      {count > displayMax && (
        <span className="text-xs text-gray-400 ml-1">+{count - displayMax}</span>
      )}
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-green-600 font-semibold">
        <CheckCircle size={10} /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-gray-400 font-medium">
      <AlertCircle size={10} /> Unverified
    </span>
  );
}

function CustomerRow({
  customer,
  selected,
  onSelect,
}: {
  customer: CustomerRecord;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const loyal = customer.stamp_count >= 5;
  const lapsed = isLapsed(customer.last_visit_at);

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${
        selected ? 'bg-vendor-50' : ''
      }`}
      onClick={() => onSelect(customer.student_profile_id)}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          selected
            ? 'bg-vendor-600 border-vendor-600'
            : 'border-gray-300 hover:border-vendor-400'
        }`}
        onClick={(e) => { e.stopPropagation(); onSelect(customer.student_profile_id); }}
      >
        {selected && <CheckCircle size={12} className="text-white" />}
      </div>

      {/* Avatar */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
        loyal ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
      }`}>
        {customer.display_name[0]?.toUpperCase() ?? 'S'}
        {loyal && <Crown size={8} className="absolute -top-1 -right-1 text-amber-500" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="font-bold text-gray-900 text-sm truncate">{customer.display_name}</span>
          {loyal && (
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Crown size={9} /> Loyal
            </span>
          )}
          {lapsed && (
            <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <UserX size={9} /> Lapsed
            </span>
          )}
          <VerificationBadge status={customer.verification_status} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {customer.email_masked ? (
            <span className="flex items-center gap-1 italic">
              <EyeOff size={10} /> Email hidden (no consent)
            </span>
          ) : customer.email ? (
            <span className="flex items-center gap-1">
              <Mail size={10} className="text-vendor-400" />{customer.email}
            </span>
          ) : null}
          {customer.institution_name && (
            <span className="flex items-center gap-1">
              <Building2 size={10} />{customer.institution_name}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-5 text-xs text-gray-500 flex-shrink-0">
        <div className="text-center">
          <div className="flex items-center gap-1 font-black text-gray-900 text-sm justify-center">
            <Star size={11} className="text-vendor-500" />
            {customer.stamp_count}
          </div>
          <StampDots count={customer.stamp_count} />
          <div className="text-gray-400 mt-0.5">stamps</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="font-bold text-gray-900 text-sm flex items-center gap-1 justify-center">
            <Gift size={11} className="text-brand-400" />
            {customer.rewards_earned}
          </div>
          <div className="text-gray-400">rewards</div>
        </div>
        <div className="text-center hidden md:block">
          <div className="font-bold text-gray-700 text-sm">{daysSince(customer.last_visit_at)}</div>
          <div className="text-gray-400">last visit</div>
        </div>
      </div>
    </div>
  );
}

// ── Promotion Modal ────────────────────────────────────────────────────────────
function PromotionModal({
  customers,
  selectedIds,
  onClose,
}: {
  customers: CustomerRecord[];
  selectedIds: string[];
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'loyal' | 'lapsed' | 'selected'>(
    selectedIds.length > 0 ? 'selected' : 'all'
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ count: number } | null>(null);
  const [error, setError] = useState('');

  const targetOptions: { value: typeof target; label: string; desc: string }[] = [
    { value: 'all',      label: 'All Customers',       desc: `${customers.length} students` },
    { value: 'loyal',    label: 'Loyal (5+ stamps)',   desc: `${customers.filter(c => c.stamp_count >= 5).length} students` },
    { value: 'lapsed',   label: 'Lapsed (30+ days)',   desc: `${customers.filter(c => isLapsed(c.last_visit_at)).length} students` },
    { value: 'selected', label: 'Selected Students',   desc: `${selectedIds.length} selected` },
  ];

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Subject and message are required.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const bodyTarget = target === 'selected' ? selectedIds : target;
      const res = await fetch('/api/vendor/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), target: bodyTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to send promotion.');
      } else {
        setSent({ count: data.sent_to });
      }
    } catch (_) {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-vendor-100 flex items-center justify-center">
              <Megaphone size={18} className="text-vendor-600" />
            </div>
            <div>
              <h3 className="font-black text-gray-900">Send Promotion</h3>
              <p className="text-xs text-gray-400">Delivered as in-app notification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div className="px-6 py-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <h4 className="font-black text-gray-900 text-lg mb-1">Promotion sent!</h4>
            <p className="text-sm text-gray-500 mb-6">
              Delivered to <strong>{sent.count}</strong> student{sent.count !== 1 ? 's' : ''} as an in-app notification.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-vendor-600 text-white font-bold rounded-xl text-sm hover:bg-vendor-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="px-6 py-5 space-y-5">
            {/* Target */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Send to
              </label>
              <div className="grid grid-cols-2 gap-2">
                {targetOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTarget(opt.value)}
                    disabled={opt.value === 'selected' && selectedIds.length === 0}
                    className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
                      target === opt.value
                        ? 'border-vendor-500 bg-vendor-50 text-vendor-800'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="font-bold">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Exclusive offer just for you!"
                maxLength={100}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-vendor-400 transition-colors"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your promotion message here…"
                rows={4}
                maxLength={500}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-vendor-400 transition-colors resize-none"
              />
              <div className="text-right text-xs text-gray-400 mt-1">{message.length}/500</div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !message.trim()}
                className="flex-1 py-2.5 bg-vendor-600 text-white font-bold rounded-xl text-sm hover:bg-vendor-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send Promotion
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VendorCustomersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('stamps');
  const [segment, setSegment] = useState<Segment>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPromoModal, setShowPromoModal] = useState(false);

  // Auth guard
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.role !== 'vendor' && profile?.role !== 'admin') { router.push('/dashboard'); return; }
    };
    check();
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/customers?sort=${sort}`);
      if (!res.ok) {
        setFetchError('Failed to load customers. Please refresh the page.');
        setLoading(false);
        return;
      }
      setFetchError(null);
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Filter by segment + search
  const filtered = customers.filter((c) => {
    if (segment === 'loyal' && c.stamp_count < 5) return false;
    if (segment === 'lapsed' && !isLapsed(c.last_visit_at)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.display_name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.institution_name ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalStamps = customers.reduce((s, c) => s + c.stamp_count, 0);
  const consentedCount = customers.filter((c) => !c.email_masked).length;
  const loyalCount = customers.filter((c) => c.stamp_count >= 5).length;
  const lapsedCount = customers.filter((c) => isLapsed(c.last_visit_at)).length;

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.student_profile_id)));
    }
  };

  // CSV export
  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Institution', 'Stamps', 'Rewards', 'Last Visit', 'Verified'],
      ...filtered.map((c) => [
        c.display_name,
        c.email_masked ? '(hidden)' : (c.email ?? ''),
        c.institution_name ?? '',
        String(c.stamp_count),
        String(c.rewards_earned),
        c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('hu-HU') : '',
        c.verification_status,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <VendorNav />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Users size={22} className="text-vendor-600" />
              Customer Directory
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Students who have earned stamps at your venue
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCustomers}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              onClick={() => setShowPromoModal(true)}
              disabled={customers.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-vendor-600 text-white text-sm font-bold hover:bg-vendor-700 transition-colors disabled:opacity-50"
            >
              <Megaphone size={14} />
              Promote
            </button>
          </div>
        </div>

        {/* ── Fetch error banner ── */}
        {fetchError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span className="flex-1">{fetchError}</span>
            <button
              onClick={() => { setFetchError(null); fetchCustomers(); }}
              className="font-bold underline hover:no-underline flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            {
              label: 'Total Students',
              value: customers.length,
              icon: <Users size={16} />,
              bg: 'bg-vendor-50',
              color: 'text-vendor-600',
            },
            {
              label: 'Loyal Members',
              value: loyalCount,
              icon: <Crown size={16} />,
              bg: 'bg-amber-50',
              color: 'text-amber-600',
            },
            {
              label: 'Stamps Earned',
              value: totalStamps,
              icon: <Star size={16} />,
              bg: 'bg-green-50',
              color: 'text-green-600',
            },
            {
              label: 'Email Consented',
              value: consentedCount,
              icon: <Mail size={16} />,
              bg: 'bg-blue-50',
              color: 'text-blue-600',
            },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} rounded-2xl p-4`}>
              <div className={`${kpi.color} mb-2`}>{kpi.icon}</div>
              <div className="text-2xl font-black text-gray-900">{kpi.value}</div>
              <div className="text-xs text-gray-500 font-medium mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* ── GDPR notice ── */}
        {customers.length > 0 && consentedCount < customers.length && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-sm text-blue-700">
            <EyeOff size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>{customers.length - consentedCount} student{customers.length - consentedCount !== 1 ? 's have' : ' has'}</strong> not consented to share their email with vendors (GDPR). Their details are masked. You can still send them in-app notifications.
            </span>
          </div>
        )}

        {/* ── Filters row ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or university…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-vendor-400"
            />
          </div>

          {/* Segment tabs */}
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden flex-shrink-0">
            {(
              [
                { value: 'all',    label: `All (${customers.length})` },
                { value: 'loyal',  label: `Loyal (${loyalCount})` },
                { value: 'lapsed', label: `Lapsed (${lapsedCount})` },
              ] as { value: Segment; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSegment(opt.value)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  segment === opt.value
                    ? 'bg-vendor-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden flex-shrink-0">
            {(
              [
                { value: 'stamps', label: 'Most Stamps' },
                { value: 'recent', label: 'Recent' },
                { value: 'name',   label: 'Name A–Z' },
              ] as { value: SortMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  sort === opt.value
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Selection bar ── */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-vendor-50 border border-vendor-200 rounded-xl px-4 py-3 mb-4 text-sm">
            <span className="font-bold text-vendor-800">
              {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-vendor-600 font-semibold hover:underline text-xs"
              >
                Clear selection
              </button>
              <button
                onClick={() => setShowPromoModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-vendor-600 text-white font-bold rounded-lg text-xs hover:bg-vendor-700 transition-colors"
              >
                <Send size={11} />
                Send Promotion
              </button>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-colors ${
                  selectedIds.size === filtered.length && filtered.length > 0
                    ? 'bg-vendor-600 border-vendor-600'
                    : 'border-gray-300'
                }`}
                onClick={toggleSelectAll}
              >
                {selectedIds.size === filtered.length && filtered.length > 0 && (
                  <CheckCircle size={12} className="text-white" />
                )}
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                {filtered.length} student{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-vendor-400" />
              <p className="text-sm text-gray-400">Loading your customers…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                {search || segment !== 'all'
                  ? <Search size={22} className="text-gray-400" />
                  : <Users size={22} className="text-gray-400" />}
              </div>
              <p className="font-bold text-gray-700 mb-1">
                {search
                  ? 'No students match your search'
                  : segment === 'loyal'
                  ? 'No loyal customers yet'
                  : segment === 'lapsed'
                  ? 'No lapsed customers'
                  : 'No customers yet'}
              </p>
              <p className="text-sm text-gray-400">
                {search
                  ? 'Try a different name or email'
                  : segment !== 'all'
                  ? 'Switch to "All" to see everyone'
                  : "When students earn stamps here, they'll appear in this list"}
              </p>
            </div>
          ) : (
            <div>
              {filtered.map((c) => (
                <CustomerRow
                  key={c.student_profile_id}
                  customer={c}
                  selected={selectedIds.has(c.student_profile_id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer note ── */}
        {!loading && customers.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Customer data is subject to GDPR. Only students who consented to share their contact details are shown in full.
          </p>
        )}
      </div>

      {/* ── Promotion Modal ── */}
      {showPromoModal && (
        <PromotionModal
          customers={customers}
          selectedIds={Array.from(selectedIds)}
          onClose={() => { setShowPromoModal(false); }}
        />
      )}
    </div>
  );
}
