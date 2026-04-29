'use client';

// =============================================================================
// app/admin/verifications/page.tsx — Admin Verification Review Panel
//
// Protected page — only accessible to users with role = 'admin'.
// Shows a queue of students who uploaded their student ID for review.
//
// For each student:
//   - Photo of their student ID (opens full-size in modal)
//   - Name, email, institution
//   - Approve → sets verified
//   - Reject → sets rejected + optional note
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  CheckCircle, XCircle, Clock, Eye, Shield,
  GraduationCap, User, Mail, Building2, Search,
  ArrowLeft, Loader2, RefreshCw, Filter,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudentSubmission {
  id: string;
  user_id: string;
  verification_status: string;
  verification_document_url: string | null;
  verification_method: string | null;
  student_email: string | null;
  institution_name_manual: string | null;
  created_at: string;
  profile: {
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  institution: {
    name: string;
    short_name: string;
  } | null;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending_review: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
    verified:       { label: 'Approved', cls: 'bg-green-100 text-green-700' },
    rejected:       { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
    unverified:     { label: 'Unverified', cls: 'bg-gray-100 text-gray-600' },
    pending_email:  { label: 'Email pending', cls: 'bg-blue-100 text-blue-700' },
  };
  const c = config[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.cls}`}>
      {c.label}
    </span>
  );
}

// ── Student row ───────────────────────────────────────────────────────────────
function StudentRow({
  student,
  onApprove,
  onReject,
  onViewId,
  processing,
}: {
  student: StudentSubmission;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewId: (url: string) => void;
  processing: string | null;
}) {
  const name = student.profile?.first_name
    ? `${student.profile.first_name} ${student.profile.last_name ?? ''}`.trim()
    : student.profile?.display_name ?? 'Unknown';

  const institution =
    student.institution?.name ?? student.institution_name_manual ?? '—';

  const isPending = student.verification_status === 'pending_review';
  const isProcessing = processing === student.id;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
        {name[0]?.toUpperCase() ?? 'S'}
      </div>

      {/* Student info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-bold text-gray-900 text-sm">{name}</span>
          <StatusBadge status={student.verification_status} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {student.student_email && (
            <span className="flex items-center gap-1">
              <Mail size={11} />{student.student_email}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Building2 size={11} />{institution}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {new Date(student.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {student.verification_document_url && (
          <button
            onClick={() => onViewId(student.verification_document_url!)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            <Eye size={13} />
            View ID
          </button>
        )}

        {isPending && (
          <>
            <button
              onClick={() => onApprove(student.id)}
              disabled={!!isProcessing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              Approve
            </button>
            <button
              onClick={() => onReject(student.id)}
              disabled={!!isProcessing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              <XCircle size={13} />
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminVerificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; note: string } | null>(null);

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
      if (profile?.role !== 'admin') { router.push('/dashboard'); return; }
    };
    check();
  }, []);

  const fetchStudents = async (status = statusFilter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verify-student?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(statusFilter); }, [statusFilter]);

  const handleApprove = async (studentProfileId: string) => {
    setProcessing(studentProfileId);
    try {
      const res = await fetch('/api/admin/verify-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_profile_id: studentProfileId, action: 'approve' }),
      });
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s.id !== studentProfileId));
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setProcessing(rejectModal.id);
    try {
      const res = await fetch('/api/admin/verify-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_profile_id: rejectModal.id,
          action: 'reject',
          notes: rejectModal.note || 'ID could not be verified.',
        }),
      });
      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s.id !== rejectModal.id));
        setRejectModal(null);
      }
    } finally {
      setProcessing(null);
    }
  };

  const filtered = students.filter((s) => {
    if (!search) return true;
    const name = `${s.profile?.first_name ?? ''} ${s.profile?.last_name ?? ''} ${s.profile?.display_name ?? ''}`.toLowerCase();
    const email = (s.student_email ?? '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const pendingCount = students.filter((s) => s.verification_status === 'pending_review').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
              <ArrowLeft size={16} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Shield size={20} className="text-brand-600" />
                Verification Queue
                {pendingCount > 0 && (
                  <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-500">Review student ID submissions</p>
            </div>
          </div>

          <button
            onClick={() => fetchStudents(statusFilter)}
            className="flex items-center gap-2 btn-secondary text-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
            {[
              { value: 'pending_review', label: 'Pending' },
              { value: 'verified',       label: 'Approved' },
              { value: 'rejected',       label: 'Rejected' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-brand-400" />
              <p className="text-sm text-gray-400">Loading submissions…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={24} className="text-gray-400" />
              </div>
              <p className="font-bold text-gray-700 mb-1">
                {search ? 'No results found' : 'No submissions'}
              </p>
              <p className="text-sm text-gray-400">
                {search ? 'Try a different search term' : `No ${statusFilter.replace('_', ' ')} submissions`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  onApprove={handleApprove}
                  onReject={(id) => setRejectModal({ id, note: '' })}
                  onViewId={setViewingId}
                  processing={processing}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          {filtered.length} {filtered.length === 1 ? 'submission' : 'submissions'}
        </p>
      </div>

      {/* ── ID VIEW MODAL ──────────────────────────────────────────────────── */}
      {viewingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setViewingId(null)}
        >
          <div className="relative max-w-2xl w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewingId(null)}
              className="absolute -top-4 -right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 z-10"
            >
              <XCircle size={18} className="text-gray-700" />
            </button>
            <img
              src={viewingId}
              alt="Student ID"
              className="w-full rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ── REJECT MODAL ──────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 animate-fade-in">
            <h3 className="font-black text-gray-900 text-lg mb-1">Reject verification</h3>
            <p className="text-sm text-gray-500 mb-5">
              The student will be notified and can re-submit.
            </p>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Reason (shown to student)
            </label>
            <textarea
              value={rejectModal.note}
              onChange={(e) => setRejectModal({ ...rejectModal, note: e.target.value })}
              placeholder="e.g. ID photo is unclear, please re-upload a clearer image."
              rows={3}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-red-300 resize-none mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!processing}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
