'use client';

// =============================================================================
// /admin/redemptions — Redemption Void Panel
//
// Lists all platform redemptions. Admin can void any with a mandatory reason.
// Filter by status, search by student / vendor name.
// Full audit trail on every void.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminNav from '@/components/admin/AdminNav';
import {
  Receipt, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Search, XCircle, AlertTriangle, CheckCircle, Stamp, Tag,
  Gift, X,
} from 'lucide-react';

interface RedemptionRow {
  id: string;
  student_id: string;
  vendor_id: string;
  offer_id: string | null;
  status: string;
  redemption_code: string | null;
  created_at: string;
  student_name: string;
  vendor_name: string;
  offer_title: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  stamp:         'bg-purple-100 text-purple-700',
  reward_earned: 'bg-amber-100 text-amber-700',
  tier_reward:   'bg-amber-100 text-amber-700',
  claimed:       'bg-blue-100 text-blue-700',
  confirmed:     'bg-green-100 text-green-700',
  voided:        'bg-gray-100 text-gray-400 line-through',
  admin_void:    'bg-gray-100 text-gray-400 line-through',
};

const STATUS_OPTIONS = ['', 'stamp', 'claimed', 'confirmed', 'reward_earned', 'voided', 'admin_void'];
const LIMIT = 50;

function VoidModal({
  row, onConfirm, onCancel, loading,
}: {
  row: RedemptionRow;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-orange-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-gray-900">Void redemption</h3>
            <p className="text-sm text-gray-500 mt-1">
              This will cancel <strong>{row.student_name}</strong>'s <em>{row.status}</em> at <strong>{row.vendor_name}</strong>. The student will be notified.
            </p>
          </div>
        </div>
        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Reason <span className="text-red-500">*</span></label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Fraudulent voucher sharing — multiple accounts confirmed."
          rows={2}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:border-red-300 resize-none"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading || reason.trim().length < 5}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Void it'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminRedemptionsPage() {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [voiding, setVoiding]   = useState(false);
  const [rows, setRows]         = useState<RedemptionRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]     = useState('');
  const [confirm, setConfirm]   = useState<RedemptionRow | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/sign-in');
    });
  }, [router]);

  const fetchRows = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(LIMIT) });
      if (statusFilter) params.set('status', statusFilter);
      const res  = await fetch(`/api/admin/redemptions?${params}`);
      const data = await res.json();
      setRows(data.redemptions ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.total_pages ?? 1);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchRows(1); }, [fetchRows]);

  const handleVoid = async (reason: string) => {
    if (!confirm) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/admin/redemptions/${confirm.id}/void`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setRows((prev) => prev.map((r) => r.id === confirm.id ? { ...r, status: 'voided' } : r));
        setConfirm(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Void failed: ${err.error ?? 'Unknown error'}`);
      }
    } finally { setVoiding(false); }
  };

  const filtered = search
    ? rows.filter((r) =>
        r.student_name.toLowerCase().includes(search.toLowerCase()) ||
        r.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.offer_title ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const goPage = (p: number) => { setPage(p); fetchRows(p); };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav active="/admin/redemptions" />
      {confirm && (
        <VoidModal
          row={confirm}
          onConfirm={handleVoid}
          onCancel={() => setConfirm(null)}
          loading={voiding}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Receipt size={22} className="text-purple-600" /> Redemptions
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">View and void any stamp, claim, or reward platform-wide.</p>
          </div>
          <button
            onClick={() => fetchRows(page)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
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
              placeholder="Search student, vendor, offer…"
              className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-52 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status chips */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  statusFilter === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {total > 0 && <span className="ml-auto text-xs text-gray-400">{total} redemptions</span>}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={28} className="animate-spin text-purple-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <Receipt size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No redemptions found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Vendor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Offer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => {
                  const isVoided = ['voided', 'admin_void'].includes(r.status);
                  return (
                    <tr key={r.id} className={`transition-colors ${isVoided ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="px-5 py-3 font-medium text-gray-800">{r.student_name}</td>
                      <td className="px-5 py-3 text-gray-600">{r.vendor_name}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs max-w-[180px] truncate">{r.offer_title ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('hu-HU', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!isVoided && (
                          <button
                            onClick={() => setConfirm(r)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors ml-auto"
                          >
                            <XCircle size={11} /> Void
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Page {page} of {totalPages} · {total} redemptions</span>
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
