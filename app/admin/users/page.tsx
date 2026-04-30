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
import {
  Users, Search, GraduationCap, Store, MapPin,
  CheckCircle, Clock, AlertTriangle, XCircle, Shield,
  Loader2, RefreshCw, Activity, Mail,
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

function AdminNav({ active }: { active: string }) {
  const links = [
    { href: '/admin',               label: 'Overview', icon: <Activity size={14} /> },
    { href: '/admin/verifications', label: 'Students', icon: <Shield size={14} /> },
    { href: '/admin/vendors',       label: 'Vendors',  icon: <Store size={14} /> },
    { href: '/admin/users',         label: 'Users',    icon: <Users size={14} /> },
  ];
  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1 py-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                active === l.href
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {l.icon}{l.label}
            </Link>
          ))}
          <span className="ml-auto text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded-lg font-semibold">Admin</span>
        </nav>
      </div>
    </div>
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

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (p?.role !== 'admin') { router.push('/dashboard'); return; }
    };
    check();
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (cityFilter !== 'all') params.set('city', cityFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [roleFilter, cityFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = search
    ? users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.business_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const studentCount = users.filter((u) => u.role === 'student').length;
  const vendorCount  = users.filter((u) => u.role === 'vendor').length;
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
              {studentCount} students · {vendorCount} vendors · {verifiedCount} verified
            </p>
          </div>
          <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
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
                <div className="col-span-2">Joined</div>
              </div>
              {filtered.map((u) => (
                <div key={u.id} className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 items-center transition-colors">
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      u.role === 'vendor' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {(u.business_name ?? u.name)[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {u.role === 'vendor' ? u.business_name ?? u.name : u.name}
                      </p>
                      {u.email && (
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                          <Mail size={9} />{u.email}
                        </p>
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
                  <div className="col-span-2 text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''} shown
        </p>
      </div>
    </div>
  );
}
