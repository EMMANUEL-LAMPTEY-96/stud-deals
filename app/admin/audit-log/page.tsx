'use client';

// =============================================================================
// /admin/audit-log — Admin Audit Log Viewer
// Shows every admin action (ban, approve, reject, verify) with actor + target.
// Supports action-type filter, date range filter, and CSV export.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminNav from '@/components/admin/AdminNav';
import {
  BookOpen, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  ShieldCheck, ShieldX, UserX, UserCheck, Store, XCircle,
  CheckCircle, Filter, Download, Calendar,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('hu-HU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('hu-HU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  student_verified:    { label: 'Student Verified',    color: 'bg-green-100 text-green-700',   icon: <ShieldCheck size={12} /> },
  student_rejected:    { label: 'Student Rejected',    color: 'bg-red-100 text-red-700',       icon: <ShieldX    size={12} /> },
  vendor_approved:     { label: 'Vendor Approved',     color: 'bg-blue-100 text-blue-700',     icon: <Store      size={12} /> },
  vendor_rejected:     { label: 'Vendor Rejected',     color: 'bg-orange-100 text-orange-700', icon: <XCircle    size={12} /> },
  user_banned:         { label: 'User Banned',         color: 'bg-red-100 text-red-700',       icon: <UserX      size={12} /> },
  user_unbanned:       { label: 'User Unbanned',       color: 'bg-green-100 text-green-700',   icon: <UserCheck  size={12} /> },
  offer_paused:        { label: 'Offer Paused',        color: 'bg-yellow-100 text-yellow-700', icon: <XCircle    size={12} /> },
  offer_activated:     { label: 'Offer Activated',     color: 'bg-green-100 text-green-700',   icon: <CheckCircle size={12} /> },
  offer_deleted:       { label: 'Offer Deleted',       color: 'bg-red-100 text-red-700',       icon: <XCircle    size={12} /> },
  review_deleted:      { label: 'Review Deleted',      color: 'bg-red-100 text-red-700',       icon: <XCircle    size={12} /> },
  announcement_sent:   { label: 'Announcement Sent',   color: 'bg-purple-100 text-purple-700', icon: <CheckCircle size={12} /> },
  config_updated:      { label: 'Config Updated',      color: 'bg-indigo-100 text-indigo-700', icon: <CheckCircle size={12} /> },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_LABELS[action] ?? { label: action, color: 'bg-gray-100 text-gray-600', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

const ACTION_OPTIONS = [
  'all',
  'student_verified', 'student_rejected',
  'vendor_approved',  'vendor_rejected',
  'user_banned',      'user_unbanned',
  'offer_paused',     'offer_activated', 'offer_deleted',
  'review_deleted',   'announcement_sent', 'config_updated',
];

const LIMIT = 50;

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const router = useRouter();
  const [loading, setLoading]           = useState(true);
  const [entries, setEntries]           = useState<AuditEntry[]>([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/sign-in');
    });
  }, [router]);

  const fetchEntries = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), limit: String(LIMIT) });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (startDate) params.set('start', new Date(startDate).toISOString());
      if (endDate)   params.set('end',   new Date(endDate + 'T23:59:59').toISOString());

      const res  = await fetch(`/api/admin/audit-log?${params}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.total_pages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, startDate, endDate]);

  useEffect(() => { fetchEntries(1); }, [fetchEntries]);

  const goPage = (p: number) => { setPage(p); fetchEntries(p); };

  // Build export URL with current filters
  const exportParams = new URLSearchParams();
  if (actionFilter !== 'all') exportParams.set('action', actionFilter);
  if (startDate) exportParams.set('start', new Date(startDate).toISOString());
  if (endDate)   exportParams.set('end',   new Date(endDate + 'T23:59:59').toISOString());
  const exportHref = `/api/admin/audit-log/export?${exportParams}`;

  const clearDates = () => { setStartDate(''); setEndDate(''); };
  const hasDateFilter = startDate || endDate;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav active="/admin/audit-log" />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <BookOpen size={22} className="text-purple-600" />
              Audit Log
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Every admin action, who did it, and when.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={exportHref}
              download
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={14} />
              Export CSV
            </a>
            <button
              onClick={() => fetchEntries(page)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
          {/* Action chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-gray-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-500 shrink-0">Action:</span>
            <div className="flex flex-wrap gap-2">
              {ACTION_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setActionFilter(a); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    actionFilter === a
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {a === 'all' ? 'All actions' : (ACTION_LABELS[a]?.label ?? a)}
                </button>
              ))}
            </div>
            {total > 0 && (
              <span className="ml-auto text-xs text-gray-400 shrink-0">{total.toLocaleString()} entries</span>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-3 flex-wrap">
            <Calendar size={14} className="text-gray-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-500 shrink-0">Date range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            {hasDateFilter && (
              <button
                onClick={clearDates}
                className="text-xs text-purple-600 font-semibold hover:underline"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={28} className="animate-spin text-purple-400" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-24">
              <BookOpen size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No audit entries found.</p>
              <p className="text-xs text-gray-300 mt-1">Try adjusting your filters, or actions will appear here as admins work.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">When</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Admin</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Entity</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      <span title={fmtDate(e.created_at)} className="cursor-default">
                        {timeAgo(e.created_at)}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">{e.admin_name}</td>
                    <td className="px-5 py-3"><ActionBadge action={e.action} /></td>
                    <td className="px-5 py-3 text-gray-500">
                      <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5 font-mono">{e.entity_type}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 max-w-xs">
                      {e.metadata && Object.keys(e.metadata).length > 0 ? (
                        <span className="truncate block" title={Object.entries(e.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}>
                          {Object.entries(e.metadata)
                            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                            .join(' · ')}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Page {page} of {totalPages} · {total.toLocaleString()} entries
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
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
