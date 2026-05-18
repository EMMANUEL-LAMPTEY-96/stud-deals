// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
'use client';

// =============================================================================
// app/admin/users/page.tsx — Admin User Management
//
// Shows all students and vendors with:
//   - Name, email, city, role, joined date
//   - Students: verification status badge
//   - Vendors: business name, active offer count
//   - Filter by role (All / Students / Vendors)
//   - Filter by city (All / Budapest / Szeged)
//   - Search by name, email, or business name
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import AdminNav from '@/components/admin/AdminNav';
import {
  Users, Search, GraduationCap, Store, MapPin,
  CheckCircle, Clock, AlertTriangle, XCircle, Shield,
  Loader2, RefreshCw, Activity, Mail, ChevronLeft, ChevronRight, Ban, UserCheck,
  Download,
} from 'lucide-react';

interface UserRecord {
  id: string;
  role: string;
  name: string;
  email: string | null;
  city: string;
  created_at: string;
  verification_status: string | null;
  business_name: string | null;
  active_offers: number | null;
  is_active: boolean;
}

function VerifBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    verified:       { label: 'Verified',      cls: 'bg-green-100 text-green-700',  icon: <CheckCircle size={10} /> },
    pending_review: { label: 'ID Review',     cls: 'bg-amber-100 text-amber-700',  icon: <Clock size={10} /> },
    pending_email:  { label: 'Email Pending', cls: 'bg-blue-100 text-blue-700',    icon: <Clock size={10} /> },
    rejected:       { label: 'Rejected',      cls: 'bg-red-100 text-red-700',      icon: <XCircle size={10} /> },
    unverified:     { label: 'Unverified',    cls: 'bg-gray-100 text-gray-600',    icon: <AlertTriangle size={10} /> },
  };
  const c = map[status] ?? map.unverified;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}


export default function AdminUsersPage() {
  const router = useRouter();
  const supabase = createClient();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Pre-fill search from ?q= query param (from global search navigation)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [banning, setBanning] = useState<string | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (p?.role !== 'admin') { router.push('/dashboard'); return; }
    };
    check();
  }, []);

  const fetchUsers = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (cityFilter !== 'all') params.set('city', cityFilter);
      params.set('page', String(targetPage));
      params.set('limit', String(LIMIT));
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
        setTotalCount(data.total ?? 0);
        setTotalPages(data.total_pages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [roleFilter, cityFilter, page]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [roleFilter, cityFilter]);
  useEffect(() => { fetchUsers(page); }, [roleFilter, cityFilter, page]);

  const handleBanToggle = async (userId: string, currentlyActive: boolean) => {
    if (!confirm(`${currentlyActive ? 'Deactivate' : 'Reactivate'} this account?`)) return;
    setBanning(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: currentlyActive ? 'ban' : 'unban' }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => u.id === userId ? { ...u, is_active: !currentlyActive } : u)
        );
      }
    } finally {
      setBanning(null);
    }
  };

  const filtered = search
    ? users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.business_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const studentCount  = users.filter((u) => u.role === 'student').length;
  const vendorCount   = users.filter((u) => u.role === 'vendor').length;
  const verifiedCount = users.filter((u) => u.verification_status === 'verified').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <AdminNav active="/admin/users" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Users size={22} className="text-purple-600" /> User Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalCount} total users · {verifiedCount} verified on this page
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/admin/users/export"
              download
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <Download size={14} /> Export CSV
            </a>
            <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, business…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
            {[
              { value: 'all',     label: `All (${users.length})` },
              { value: 'student', label: `Students (${studentCount})` },
              { value: 'vendor',  label: `Vendors (${vendorCount})` },
            ].map((opt) => (
              <button key={opt.value} onClick={() => setRoleFilter(opt.value)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  roleFilter === opt.value ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >{opt.label}</button>
            ))}
          </div>
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
            {[
              { value: 'all',       label: 'All cities' },
              { value: 'Budapest',  label: 'Budapest' },
              { value: 'Szeged',    label: 'Szeged' },
            ].map((opt) => (
              <button key={opt.value} onClick={() => setCityFilter(opt.value)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  cityFilter === opt.value ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin text-purple-400" />
              <p className="text-sm text-gray-400">Loading users…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={28} className="text-gray-200 mx-auto mb-3" />
              <p className="font-bold text-gray-600">No users found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                <div className="col-span-4">User</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2">City</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Joined</div>
                <div className="col-span-1">Actions</div>
              </div>
              {filtered.map((u) => (
                <div key={u.id} className={`grid grid-cols-12 gap-3 px-5 py-4 border-b border-gray-100 last:border-0 items-center transition-colors ${
                  u.is_active === false ? 'bg-red-50/40' : 'hover:bg-gray-50'
                }`}>
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      u.is_active === false ? 'bg-red-100 text-red-400' :
                      u.role === 'vendor' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {(u.business_name ?? u.name)[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${u.is_active === false ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {u.role === 'vendor' ? u.business_name ?? u.name : u.name}
                      </p>
                      {u.email && (
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                          <Mail size={9} />{u.email}
                        </p>
                      )}
                      {u.is_active === false && (
                        <span className="text-xs font-bold text-red-500">Suspended</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                      u.role === 'vendor'
                        ? 'bg-blue-100 text-blue-700'
                        : u.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.role === 'vendor' ? <Store size={10} /> : <GraduationCap size={10} />}
                      {u.role}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={10} />
                    {u.city || '—'}
                  </div>
                  <div className="col-span-2">
                    {u.role === 'student' && <VerifBadge status={u.verification_status} />}
                    {u.role === 'vendor' && u.active_offers !== null && (
                      <span className="text-xs text-gray-500">
                        {u.active_offers} active offer{u.active_offers !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                  <div className="col-span-1">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => handleBanToggle(u.id, u.is_active !== false)}
                        disabled={banning === u.id}
                        title={u.is_active === false ? 'Reactivate account' : 'Suspend account'}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40 ${
                          u.is_active === false
                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                            : 'bg-red-50 text-red-500 hover:bg-red-100'
                        }`}
                      >
                        {banning === u.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : u.is_active === false
                          ? <UserCheck size={13} />
                          : <Ban size={13} />
                        }
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-sm text-gray-500 font-medium">
              Page {page} of {totalPages} · {totalCount} users
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
        <p className="text-center text-xs text-gray-400 mt-3">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''} on this page
        </p>
      </div>
    </div>
  );
}
