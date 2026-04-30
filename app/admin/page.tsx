'use client';

// =============================================================================
// app/admin/page.tsx — Admin Command Centre
//
// Protected: role = 'admin' only.
//
// Sections:
//   - KPI overview strip (students, vendors, stamps today, rewards, offers)
//   - City breakdown cards (Budapest vs Szeged)
//   - Daily stamps sparkline (14-day trend)
//   - Live activity feed (most recent stamp events)
//   - Quick-action links (Verifications, Users)
//   - Alert strip (pending verifications, unverified students)
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Users, Store, Stamp, Gift, Tag, Shield, RefreshCw,
  Loader2, CheckCircle, Clock, AlertTriangle, MapPin,
  TrendingUp, ArrowRight, Star, Bell, Activity, Crown,
  GraduationCap, XCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  overview: {
    students: number;
    vendors: number;
    stamps_today: number;
    stamps_total: number;
    rewards_total: number;
    active_offers: number;
    unverified_students: number;
    pending_verifications: number;
  };
  cities: { city: string; students: number; vendors: number; stamps: number }[];
  activity: {
    id: string;
    type: string;
    student_name: string;
    vendor_name: string;
    city: string;
    at: string;
  }[];
  daily_stamps: { date: string; count: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, icon, bg, color, alert }: {
  label: string; value: number | string; icon: React.ReactNode;
  bg: string; color: string; alert?: boolean;
}) {
  return (
    <div className={`${bg} rounded-2xl p-5 relative`}>
      {alert && value > 0 && (
        <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
      )}
      <div className={`${color} mb-3`}>{icon}</div>
      <div className="text-2xl font-black text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 font-medium mt-0.5">{label}</div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 420; const h = 60; const pad = 4;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (d.count / max) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#7C3AED"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2);
        const y = h - pad - (d.count / max) * (h - pad * 2);
        return d.count > 0 ? (
          <circle key={i} cx={x} cy={y} r="3" fill="#7C3AED" />
        ) : null;
      })}
    </svg>
  );
}

// ── Activity row ──────────────────────────────────────────────────────────────
function ActivityRow({ item }: { item: Stats['activity'][0] }) {
  const isReward = item.type === 'reward_earned';
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isReward ? 'bg-amber-100' : 'bg-brand-50'
      }`}>
        {isReward
          ? <Gift size={14} className="text-amber-600" />
          : <Stamp size={14} className="text-brand-600" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 font-medium truncate">
          <span className="font-bold">{item.student_name}</span>
          {isReward ? ' earned a reward at ' : ' stamped at '}
          <span className="font-bold">{item.vendor_name}</span>
        </p>
        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
          <MapPin size={10} />{item.city}
        </p>
      </div>
      <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(item.at)}</span>
    </div>
  );
}

// ── Admin Nav ─────────────────────────────────────────────────────────────────
function AdminNav({ active }: { active: string }) {
  const links = [
    { href: '/admin',               label: 'Overview',      icon: <Activity size={14} /> },
    { href: '/admin/verifications', label: 'Verifications', icon: <Shield size={14} /> },
    { href: '/admin/users',         label: 'Users',         icon: <Users size={14} /> },
  ];
  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1 py-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                active === l.href
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {l.icon}
              {l.label}
            </Link>
          ))}
          <span className="ml-auto text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded-lg font-semibold">
            Admin
          </span>
        </nav>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (p?.role !== 'admin') { router.push('/dashboard'); return; }
    };
    check();
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        setStats(await res.json());
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const ov = stats?.overview;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <AdminNav active="/admin" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Activity size={22} className="text-purple-600" />
              Platform Overview
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Last updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              <span className="ml-2 text-gray-400">· Auto-refreshes every 30s</span>
            </p>
          </div>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Alert strip ── */}
        {ov && (ov.pending_verifications > 0 || ov.unverified_students > 0) && (
          <div className="flex flex-wrap gap-3 mb-6">
            {ov.pending_verifications > 0 && (
              <Link
                href="/admin/verifications"
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <Clock size={14} className="text-amber-600" />
                {ov.pending_verifications} student{ov.pending_verifications !== 1 ? 's' : ''} awaiting ID review
                <ArrowRight size={12} />
              </Link>
            )}
            {ov.unverified_students > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">
                <AlertTriangle size={14} />
                {ov.unverified_students} unverified student{ov.unverified_students !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {loading && !stats ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-purple-400" />
          </div>
        ) : (
          <>
            {/* ── KPI grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <KPI label="Total students"    value={ov?.students ?? 0}         icon={<GraduationCap size={18} />} bg="bg-purple-50"  color="text-purple-600" />
              <KPI label="Active vendors"    value={ov?.vendors ?? 0}          icon={<Store size={18} />}         bg="bg-blue-50"   color="text-blue-600"   />
              <KPI label="Stamps today"      value={ov?.stamps_today ?? 0}     icon={<Stamp size={18} />}         bg="bg-green-50"  color="text-green-600"  />
              <KPI label="Rewards given"     value={ov?.rewards_total ?? 0}    icon={<Gift size={18} />}          bg="bg-amber-50"  color="text-amber-600"  />
              <KPI label="Total stamps"      value={ov?.stamps_total ?? 0}     icon={<Star size={18} />}          bg="bg-indigo-50" color="text-indigo-600" />
              <KPI label="Active offers"     value={ov?.active_offers ?? 0}    icon={<Tag size={18} />}           bg="bg-teal-50"   color="text-teal-600"   />
              <KPI label="Pending ID review" value={ov?.pending_verifications ?? 0} icon={<Clock size={18} />}   bg="bg-orange-50" color="text-orange-600"  alert />
              <KPI label="Unverified"        value={ov?.unverified_students ?? 0}  icon={<Shield size={18} />}   bg="bg-red-50"    color="text-red-500"     alert />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

              {/* ── City breakdown ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin size={15} className="text-purple-500" />
                  City breakdown
                </h2>
                {(stats?.cities ?? []).map((c) => (
                  <div key={c.city} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-800">{c.city}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Students', value: c.students, color: 'text-purple-600 bg-purple-50' },
                        { label: 'Vendors',  value: c.vendors,  color: 'text-blue-600 bg-blue-50' },
                        { label: 'Stamps',   value: c.stamps,   color: 'text-green-600 bg-green-50' },
                      ].map((m) => (
                        <div key={m.label} className={`${m.color} rounded-xl px-3 py-2 text-center`}>
                          <div className="text-lg font-black">{m.value}</div>
                          <div className="text-xs font-medium opacity-70">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Stamp trend ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 col-span-1 lg:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp size={15} className="text-purple-500" />
                    Stamps — last 14 days
                  </h2>
                  <span className="text-xs text-gray-400">
                    Total: {stats?.daily_stamps.reduce((s, d) => s + d.count, 0) ?? 0}
                  </span>
                </div>
                {stats?.daily_stamps && <Sparkline data={stats.daily_stamps} />}
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{stats?.daily_stamps[0]?.date.slice(5)}</span>
                  <span>{stats?.daily_stamps[stats.daily_stamps.length - 1]?.date.slice(5)}</span>
                </div>
              </div>
            </div>

            {/* ── Quick actions + activity ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Quick actions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Bell size={15} className="text-purple-500" />
                  Quick actions
                </h2>
                <div className="space-y-2">
                  {[
                    {
                      href: '/admin/verifications',
                      label: 'Review verifications',
                      sub: `${ov?.pending_verifications ?? 0} pending`,
                      icon: <Shield size={14} />,
                      color: 'text-amber-600 bg-amber-50',
                      badge: ov?.pending_verifications ?? 0,
                    },
                    {
                      href: '/admin/users',
                      label: 'Manage users',
                      sub: `${ov?.students ?? 0} students, ${ov?.vendors ?? 0} vendors`,
                      icon: <Users size={14} />,
                      color: 'text-purple-600 bg-purple-50',
                      badge: 0,
                    },
                    {
                      href: '/vendor',
                      label: 'Vendor dashboard',
                      sub: 'Preview vendor view',
                      icon: <Store size={14} />,
                      color: 'text-blue-600 bg-blue-50',
                      badge: 0,
                    },
                    {
                      href: '/dashboard',
                      label: 'Student dashboard',
                      sub: 'Preview student view',
                      icon: <GraduationCap size={14} />,
                      color: 'text-green-600 bg-green-50',
                      badge: 0,
                    },
                  ].map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.color}`}>
                        {a.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                        <p className="text-xs text-gray-400">{a.sub}</p>
                      </div>
                      {a.badge > 0 && (
                        <span className="text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">
                          {a.badge}
                        </span>
                      )}
                      <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Activity feed */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 col-span-1 lg:col-span-2">
                <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity size={15} className="text-purple-500" />
                  Live activity feed
                  {loading && <Loader2 size={12} className="animate-spin text-gray-400 ml-1" />}
                </h2>
                {(stats?.activity ?? []).length === 0 ? (
                  <div className="py-10 text-center">
                    <Stamp size={24} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No activity yet — stamp events will appear here in real time</p>
                  </div>
                ) : (
                  <div>
                    {(stats?.activity ?? []).map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
