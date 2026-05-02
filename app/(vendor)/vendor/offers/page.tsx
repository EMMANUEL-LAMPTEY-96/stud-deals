'use client';

// =============================================================================
// app/(vendor)/vendor/offers/page.tsx — Offers Management
//
// The full offer list for a vendor. Features:
//   - Status tabs: All | Active | Draft | Paused | Expired | Depleted
//   - Sortable columns: Views, Redemptions, Conversion Rate, Expiry
//   - Per-row actions: Edit, Pause/Resume, Duplicate, Delete
//   - Confirm-delete modal with safety prompt
//   - "Create offer" CTA always visible
//   - Empty state with onboarding prompt
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Plus, Tag, Eye, CheckCircle, TrendingUp, MoreVertical,
  Edit3, Pause, Play, Copy, Trash2, Sparkles, AlertCircle,
  ChevronUp, ChevronDown, Search, X, Loader2,
} from 'lucide-react';
import type { Offer, VendorProfile } from '@/lib/types/database.types';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'draft' | 'paused' | 'expired' | 'depleted';
type SortField = 'title' | 'view_count' | 'redemption_count' | 'conversion' | 'expires_at' | 'created_at';
type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function convRate(views: number, redem: number): string {
  if (views === 0) return '—';
  return `${((redem / views) * 100).toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'No expiry';
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active:   { label: 'Active',   dot: 'bg-vendor-500', bg: 'bg-vendor-50',  text: 'text-vendor-700'  },
  paused:   { label: 'Paused',   dot: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700'  },
  draft:    { label: 'Draft',    dot: 'bg-gray-400',   bg: 'bg-gray-100',  text: 'text-gray-600'    },
  expired:  { label: 'Expired',  dot: 'bg-red-400',    bg: 'bg-red-50',    text: 'text-red-600'     },
  depleted: { label: 'Depleted', dot: 'bg-orange-400', bg: 'bg-orange-50', text: 'text-orange-700'  },
};

const CATEGORY_LABELS: Record<string, string> = {
  food_drink: '🍕 Food & Drink', groceries: '🛒 Groceries', tech: '💻 Tech',
  fashion: '👗 Fashion', health_beauty: '💆 Health & Beauty',
  entertainment: '🎬 Entertainment', transport: '🚗 Transport',
  books_stationery: '📚 Books', fitness: '🏋️ Fitness', other: '🏷️ Other',
};

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({
  offer,
  onConfirm,
  onCancel,
  loading,
}: {
  offer: Offer;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
          <Trash2 size={22} className="text-red-600" />
        </div>
        <h2 className="text-lg font-black text-gray-900 mb-1">Delete offer?</h2>
        <p className="text-sm text-gray-500 mb-1">
          <span className="font-semibold text-gray-700">{offer.title}</span> will be permanently removed.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Historical redemption data is preserved for analytics. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Offer Row ─────────────────────────────────────────────────────────────────
function OfferRow({
  offer,
  onStatusChange,
  onDelete,
  onDuplicate,
}: {
  offer: Offer;
  onStatusChange: (id: string, status: 'active' | 'paused') => void;
  onDelete: (offer: Offer) => void;
  onDuplicate: (offer: Offer) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sc = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG.draft;
  const rate = convRate(offer.view_count, offer.redemption_count);
  const expLabel = fmtDate(offer.expires_at);
  const expIsSoon =
    offer.expires_at &&
    new Date(offer.expires_at).getTime() - Date.now() < 2 * 86400000 &&
    offer.status === 'active';

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-5 py-4 hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0">
      {/* Left: offer info */}
      <div className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-4 min-w-0">
        {/* Title + status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 text-brand-700 text-xs font-black text-center leading-tight px-1">
            {offer.discount_label.length > 6 ? offer.discount_label.slice(0, 6) : offer.discount_label}
          </div>
          <div className="min-w-0">
            <Link
              href={`/vendor/offers/${offer.id}`}
              className="text-sm font-semibold text-gray-900 hover:text-brand-700 truncate block transition-colors"
            >
              {offer.title}
            </Link>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
              <span className="text-xs text-gray-400">{CATEGORY_LABELS[offer.category] ?? offer.category}</span>
            </div>
          </div>
        </div>

        {/* Views */}
        <div className="hidden sm:block text-center">
          <p className="text-sm font-bold text-gray-900">{fmtNum(offer.view_count)}</p>
          <p className="text-xs text-gray-400">Views</p>
        </div>

        {/* Redemptions */}
        <div className="hidden sm:block text-center">
          <p className="text-sm font-bold text-gray-900">{fmtNum(offer.redemption_count)}</p>
          <p className="text-xs text-gray-400">Redeemed</p>
        </div>

        {/* Conversion */}
        <div className="hidden sm:block text-center">
          <p className={`text-sm font-bold ${offer.view_count > 0 ? 'text-vendor-600' : 'text-gray-400'}`}>
            {rate}
          </p>
          <p className="text-xs text-gray-400">Conv.</p>
        </div>

        {/* Expiry */}
        <div className="hidden sm:block text-center">
          <p className={`text-sm font-semibold ${expIsSoon ? 'text-amber-600' : 'text-gray-700'}`}>
            {expIsSoon && '⚠️ '}{expLabel}
          </p>
          <p className="text-xs text-gray-400">Expiry</p>
        </div>
      </div>

      {/* Right: actions menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <MoreVertical size={16} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-9 z-20 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-fade-in">
              <Link
                href={`/vendor/offers/${offer.id}`}
                className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <Edit3 size={14} className="text-gray-400" />
                Edit offer
              </Link>
              {(offer.status === 'active' || offer.status === 'paused') && (
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => { setMenuOpen(false); onStatusChange(offer.id, offer.status === 'active' ? 'paused' : 'active'); }}
                >
                  {offer.status === 'active'
                    ? <><Pause size={14} className="text-yellow-500" /> Pause offer</>
                    : <><Play size={14} className="text-vendor-500" /> Resume offer</>
                  }
                </button>
              )}
              <button
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => { setMenuOpen(false); onDuplicate(offer); }}
              >
                <Copy size={14} className="text-gray-400" />
                Duplicate
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => { setMenuOpen(false); onDelete(offer); }}
              >
                <Trash2 size={14} />
                Delete offer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sort header ───────────────────────────────────────────────────────────────
function SortHeader({
  label, field, active, dir, onClick,
}: {
  label: string; field: SortField; active: SortField; dir: SortDir; onClick: (f: SortField) => void;
}) {
  const isActive = field === active;
  return (
    <button
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
        isActive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
      }`}
      onClick={() => onClick(field)}
    >
      {label}
      {isActive ? (dir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OffersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (!vp) { router.push('/vendor'); return; }
      setVendorId(vp.id);

      const { data } = await supabase
        .from('offers').select('*')
        .eq('vendor_id', vp.id)
        .order('created_at', { ascending: false });
      setAllOffers(data ?? []);
      setLoading(false);
    } catch (_) { setLoading(false); }
    })();
  }, []);

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(async (id: string, newStatus: 'active' | 'paused') => {
    setAllOffers((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
    const { error } = await supabase.from('offers').update({ status: newStatus }).eq('id', id);
    if (error) {
      setAllOffers((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus === 'active' ? 'paused' : 'active' } : o));
      flash('error', 'Failed to update offer status.');
    } else {
      flash('success', newStatus === 'active' ? 'Offer resumed.' : 'Offer paused.');
    }
  }, [supabase]);

  // ── Duplicate ──────────────────────────────────────────────────────────────
  const handleDuplicate = useCallback(async (offer: Offer) => {
    if (!vendorId) return;
    const { id, created_at, updated_at, view_count, redemption_count, save_count, ...rest } = offer;
    const { data, error } = await supabase.from('offers').insert({
      ...rest,
      vendor_id: vendorId,
      title: `${offer.title} (copy)`,
      status: 'draft',
      view_count: 0,
      redemption_count: 0,
      save_count: 0,
    }).select().maybeSingle();
    if (error) { flash('error', 'Failed to duplicate offer.'); return; }
    if (data) {
      setAllOffers((prev) => [data, ...prev]);
      flash('success', 'Offer duplicated as draft.');
    }
  }, [vendorId, supabase]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error } = await supabase.from('offers').delete().eq('id', deleteTarget.id);
    setDeleteLoading(false);
    if (error) { flash('error', 'Failed to delete offer.'); return; }
    setAllOffers((prev) => prev.filter((o) => o.id !== deleteTarget.id));
    setDeleteTarget(null);
    flash('success', 'Offer deleted.');
  }, [deleteTarget, supabase]);

  // ── Flash message ──────────────────────────────────────────────────────────
  const flash = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 3500);
  };

  // ── Toggle sort ────────────────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (field === sortField) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = allOffers
    .filter((o) => statusFilter === 'all' || o.status === statusFilter)
    .filter((o) => !search || o.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortField === 'view_count')       { av = a.view_count;       bv = b.view_count; }
      else if (sortField === 'redemption_count') { av = a.redemption_count; bv = b.redemption_count; }
      else if (sortField === 'conversion')  { av = a.view_count > 0 ? a.redemption_count / a.view_count : 0; bv = b.view_count > 0 ? b.redemption_count / b.view_count : 0; }
      else if (sortField === 'expires_at')  { av = a.expires_at ?? ''; bv = b.expires_at ?? ''; }
      else if (sortField === 'created_at')  { av = a.created_at; bv = b.created_at; }
      else if (sortField === 'title')       { av = a.title; bv = b.title; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  // ── Tab counts ─────────────────────────────────────────────────────────────
  const counts: Record<StatusFilter, number> = {
    all: allOffers.length,
    active: allOffers.filter((o) => o.status === 'active').length,
    draft: allOffers.filter((o) => o.status === 'draft').length,
    paused: allOffers.filter((o) => o.status === 'paused').length,
    expired: allOffers.filter((o) => o.status === 'expired').length,
    depleted: allOffers.filter((o) => o.status === 'depleted').length,
  };

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'active',   label: 'Active' },
    { key: 'draft',    label: 'Draft' },
    { key: 'paused',   label: 'Paused' },
    { key: 'expired',  label: 'Expired' },
    { key: 'depleted', label: 'Depleted' },
  ];

  return (
    <>
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Offers</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {counts.all} offer{counts.all !== 1 ? 's' : ''} · {counts.active} active
              </p>
            </div>
            <Link href="/vendor/offers/create" className="btn-vendor flex-shrink-0">
              <Plus size={16} />
              Create offer
            </Link>
          </div>

          {/* ── Flash message ────────────────────────────────────────────── */}
          {actionMsg && (
            <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium mb-4 animate-fade-in ${
              actionMsg.type === 'success'
                ? 'bg-vendor-50 border border-vendor-200 text-vendor-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {actionMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {actionMsg.text}
            </div>
          )}

          {/* ── Main card ────────────────────────────────────────────────── */}
          <div className="card overflow-hidden">

            {/* Tabs + search row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-gray-100">
              {/* Status tabs */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">
                {STATUS_TABS.filter((t) => t.key === 'all' || counts[t.key] > 0).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      statusFilter === tab.key
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {counts[tab.key]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search offers…"
                  className="pl-8 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-400 focus:bg-white transition-colors w-full sm:w-48"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <SortHeader label="Offer" field="title" active={sortField} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Views" field="view_count" active={sortField} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Redeemed" field="redemption_count" active={sortField} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Conv." field="conversion" active={sortField} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Expiry" field="expires_at" active={sortField} dir={sortDir} onClick={toggleSort} />
              <div className="w-8" />
            </div>

            {/* Rows */}
            {loading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                      <div className="h-2 bg-gray-100 rounded w-1/3" />
                    </div>
                    <div className="hidden sm:flex gap-8">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j} className="space-y-1 text-center">
                          <div className="h-3 bg-gray-100 rounded w-10" />
                          <div className="h-2 bg-gray-100 rounded w-8" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <div className="inline-flex w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center mb-4">
                  {search ? <Search size={28} className="text-gray-400" /> : <Sparkles size={28} className="text-gray-400" />}
                </div>
                <p className="text-sm font-bold text-gray-700 mb-1">
                  {search ? 'No matching offers' : 'No offers yet'}
                </p>
                <p className="text-xs text-gray-400 mb-5">
                  {search ? `No offers match "${search}". Try a different search.` : 'Create your first student discount to start driving foot traffic.'}
                </p>
                {!search && (
                  <Link href="/vendor/offers/create" className="btn-vendor inline-flex text-sm">
                    <Plus size={14} />
                    Create first offer
                  </Link>
                )}
              </div>
            ) : (
              filtered.map((offer) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  onStatusChange={handleStatusChange}
                  onDelete={setDeleteTarget}
                  onDuplicate={handleDuplicate}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          offer={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </>
  );
}
