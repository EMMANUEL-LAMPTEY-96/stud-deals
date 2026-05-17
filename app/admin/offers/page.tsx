// @ts-nocheck
'use client';

// =============================================================================
// /admin/offers — Offer Moderation
// Admin can view, pause, activate, or delete any offer platform-wide.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminNav from '@/components/admin/AdminNav';
import {
  Tag, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Search, Pause, Play, Trash2, AlertTriangle, X,
} from 'lucide-react';

interface Offer {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  discount_value: number | null;
  discount_type: string | null;
  created_at: string;
  vendor_id: string;
  business_name: string | null;
  city: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  draft:    'bg-yellow-100 text-yellow-700',
};

const LIMIT = 50;

function ConfirmModal({
  offer, action, onConfirm, onCancel, loading,
}: {
  offer: Offer;
  action: 'pause' | 'activate' | 'delete';
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const labels = {
    pause:    { title: 'Pause offer',    desc: `"${offer.title}" will be set to inactive and hidden from students.`, btn: 'Pause offer',    color: 'bg-yellow-500 hover:bg-yellow-600' },
    activate: { title: 'Activate offer', desc: `"${offer.title}" will be set to active and visible to students.`,    btn: 'Activate offer', color: 'bg-green-600 hover:bg-green-700' },
    delete:   { title: 'Delete offer',   desc: `"${offer.title}" will be permanently deleted. This cannot be undone.`, btn: 'Delete offer',   color: 'bg-red-600 hover:bg-red-700' },
  };
  const cfg = labels[action];
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-orange-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-gray-900">{cfg.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{cfg.desc}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${cfg.color} disabled:opacity-60`}
          >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : cfg.btn}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminOffersPage() {
  const router = useRouter();
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState(false);
  const [offers, setOffers]       = useState<Offer[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter]     = useState('');
  const [search, setSearch]             = useState('');
  const [confirm, setConfirm] = useState<{ offer: Offer; action: 'pause' | 'activate' | 'delete' } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/sign-in');
    });
  }, [router]);

  const fetchOffers = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage), limit: String(LIMIT), status: statusFilter,
      });
      if (cityFilter) params.set('city', cityFilter);
      if (search)     params.set('search', search);
      const res  = await fetch(`/api/admin/offers?${params}`);
      const data = await res.json();
      setOffers(data.offers ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.total_pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, cityFilter, search]);

  useEffect(() => { fetchOffers(1); }, [fetchOffers]);

  const handleAction = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      await fetch(`/api/admin/offers/${confirm.offer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirm.action }),
      });
      setConfirm(null);
      fetchOffers(page);
    } finally {
      setActing(false);
    }
  };

  const goPage = (p: number) => { setPage(p); fetchOffers(p); };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav active="/admin/offers" />
      {confirm && (
        <ConfirmModal
          offer={confirm.offer}
          action={confirm.action}
          onConfirm={handleAction}
          onCancel={() => setConfirm(null)}
          loading={acting}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Tag size={22} className="text-purple-600" />
              Offer Moderation
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Pause, activate, or remove any offer platform-wide.</p>
          </div>
          <button
            onClick={() => fetchOffers(page)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchOffers(1)}
              placeholder="Search offers…"
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status */}
          <div className="flex gap-1.5">
            {['all', 'active', 'inactive', 'draft'].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${statusFilter === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* City */}
          <div className="flex gap-1.5">
            {['', 'Budapest', 'Szeged'].map((c) => (
              <button
                key={c}
                onClick={() => { setCityFilter(c); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${cityFilter === c ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {c || 'All cities'}
              </button>
            ))}
          </div>

          {total > 0 && <span className="ml-auto text-xs text-gray-400">{total} offers</span>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={28} className="animate-spin text-purple-400" />
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-24">
              <Tag size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No offers found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Offer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Vendor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">City</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Discount</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {offers.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-gray-800 truncate max-w-xs">{o.title}</div>
                      {o.category && <div className="text-xs text-gray-400">{o.category}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{o.business_name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{o.city ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">
                      {o.discount_value != null
                        ? o.discount_type === 'percentage'
                          ? `${o.discount_value}%`
                          : `${o.discount_value} HUF`
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {o.status === 'active' ? (
                          <button
                            onClick={() => setConfirm({ offer: o, action: 'pause' })}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-semibold hover:bg-yellow-100 transition-colors"
                          >
                            <Pause size={11} /> Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirm({ offer: o, action: 'activate' })}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
                          >
                            <Play size={11} /> Activate
                          </button>
                        )}
                        <button
                          onClick={() => setConfirm({ offer: o, action: 'delete' })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Page {page} of {totalPages} · {total} offers</span>
              <div className="flex gap-2">
                <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
