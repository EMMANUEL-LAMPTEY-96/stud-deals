'use client';

// =============================================================================
// app/admin/vendors/page.tsx — Vendor Approval Queue
//
// Protected: role = 'admin' only.
//
// Shows vendors waiting for approval (pending) and lets admin:
//   - Approve → is_verified = true, vendor offers go live
//   - Reject  → is_verified = false + verified_at set, vendor notified
//
// Tabs: Pending | Approved | Rejected
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Store, CheckCircle, XCircle, Clock, MapPin, Mail,
  Globe, Phone, Shield, Users, Activity, Loader2,
  RefreshCw, Building2, Tag, Search, AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface VendorRecord {
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
  created_at: string;
  approval_status: string;
  email: string | null;
  active_offers: number;
}

type StatusTab = 'pending' | 'approved' | 'rejected';

function AdminNav({ active }: { active: string }) {
  const links = [
    { href: '/admin',               label: 'Overview',      icon: <Activity size={14} /> },
    { href: '/admin/verifications', label: 'Students',      icon: <Shield size={14} /> },
    { href: '/admin/vendors',       label: 'Vendors',       icon: <Store size={14} /> },
    { href: '/admin/users',         label: 'Users',         icon: <Users size={14} /> },
  ];
  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1 py-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                active === l.href ? 'bg-purple-50 text-purple-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >{l.icon}{l.label}</Link>
          ))}
          <span className="ml-auto text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded-lg font-semibold">Admin</span>
        </nav>
      </div>
    </div>
  );
}

function VendorCard({
  vendor,
  onApprove,
  onReject,
  processing,
}: {
  vendor: VendorRecord;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  processing: string | null;
}) {
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const isPending = vendor.approval_status === 'pending';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-4">
        {/* Logo / avatar */}
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {vendor.logo_url
            ? <img src={vendor.logo_url} alt="" className="w-full h-full object-cover" />
            : <Store size={22} className="text-gray-400" />
          }
        </div>

        {/* Business info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-black text-gray-900 text-base">{vendor.business_name}</h3>
              <p className="text-sm text-gray-500">{vendor.business_type ?? 'Business'}</p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
              vendor.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
              vendor.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {vendor.approval_status === 'approved' ? '✓ Approved' :
               vendor.approval_status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
            </span>
          </div>

          {vendor.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{vendor.description}</p>
          )}

          <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><MapPin size={11} />{vendor.city}</span>
            {vendor.email && <span className="flex items-center gap-1"><Mail size={11} />{vendor.email}</span>}
            {vendor.business_email && vendor.business_email !== vendor.email && (
              <span className="flex items-center gap-1"><Mail size={11} />{vendor.business_email}</span>
            )}
            {vendor.business_phone && <span className="flex items-center gap-1"><Phone size={11} />{vendor.business_phone}</span>}
            {vendor.website_url && (
              <a href={vendor.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                <Globe size={11} />{vendor.website_url.replace(/^https?:\/\//, '')}
              </a>
            )}
            <span className="flex items-center gap-1"><Tag size={11} />{vendor.active_offers} active offer{vendor.active_offers !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-1"><Clock size={11} />Applied {new Date(vendor.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Actions for pending vendors */}
      {isPending && !showRejectInput && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => onApprove(vendor.id)}
            disabled={processing === vendor.id}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {processing === vendor.id
              ? <Loader2 size={14} className="animate-spin" />
              : <CheckCircle size={14} />
            }
            Approve business
          </button>
          <button
            onClick={() => setShowRejectInput(true)}
            disabled={processing === vendor.id}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 text-sm font-bold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <XCircle size={14} />
            Reject
          </button>
        </div>
      )}

      {/* Reject with note */}
      {isPending && showRejectInput && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
            Reason for rejection (sent to vendor)
          </label>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="e.g. Business location is outside Budapest/Szeged. Please re-apply when we expand to your city."
            rows={2}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-red-300 resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowRejectInput(false)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => { onReject(vendor.id); }}
              disabled={processing === vendor.id}
              className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {processing === vendor.id ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
              Confirm rejection
            </button>
          </div>
        </div>
      )}

      {/* Already actioned state */}
      {!isPending && vendor.verified_at && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
          {vendor.approval_status === 'approved'
            ? `Approved on ${new Date(vendor.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : `Rejected on ${new Date(vendor.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </div>
      )}
    </div>
  );
}

export default function AdminVendorsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (p?.role !== 'admin') { router.push('/dashboard'); return; }
    };
    check();
  }, []);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all tabs' counts in parallel
      const [pendingRes, approvedRes, rejectedRes, currentRes] = await Promise.all([
        fetch('/api/admin/approve-vendor?status=pending'),
        fetch('/api/admin/approve-vendor?status=approved'),
        fetch('/api/admin/approve-vendor?status=rejected'),
        fetch(`/api/admin/approve-vendor?status=${statusTab}`),
      ]);
      const [pendingData, approvedData, rejectedData, currentData] = await Promise.all([
        pendingRes.json(), approvedRes.json(), rejectedRes.json(), currentRes.json(),
      ]);
      setCounts({
        pending:  pendingData.total  ?? 0,
        approved: approvedData.total ?? 0,
        rejected: rejectedData.total ?? 0,
      });
      setVendors(currentData.vendors ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleApprove = async (vendorProfileId: string) => {
    setProcessing(vendorProfileId);
    try {
      const res = await fetch('/api/admin/approve-vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_profile_id: vendorProfileId, action: 'approve' }),
      });
      if (res.ok) {
        setVendors((prev) => prev.filter((v) => v.id !== vendorProfileId));
        setCounts((c) => ({ ...c, pending: c.pending - 1, approved: c.approved + 1 }));
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (vendorProfileId: string) => {
    setProcessing(vendorProfileId);
    try {
      const res = await fetch('/api/admin/approve-vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_profile_id: vendorProfileId, action: 'reject' }),
      });
      if (res.ok) {
        setVendors((prev) => prev.filter((v) => v.id !== vendorProfileId));
        setCounts((c) => ({ ...c, pending: c.pending - 1, rejected: c.rejected + 1 }));
      }
    } finally {
      setProcessing(null);
    }
  };

  const filtered = search
    ? vendors.filter((v) =>
        v.business_name.toLowerCase().includes(search.toLowerCase()) ||
        (v.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (v.email ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : vendors;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <AdminNav active="/admin/vendors" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Store size={22} className="text-purple-600" />
              Vendor Approvals
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Review and approve businesses before their offers go live to students
            </p>
          </div>
          <button onClick={fetchVendors} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Alert for pending */}
        {counts.pending > 0 && statusTab !== 'pending' && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
            <AlertTriangle size={15} />
            <span><strong>{counts.pending}</strong> vendor{counts.pending !== 1 ? 's' : ''} waiting for approval</span>
            <button onClick={() => setStatusTab('pending')} className="ml-auto flex items-center gap-1 font-bold hover:underline">
              Review now <ArrowRight size={12} />
            </button>
          </div>
        )}

        {/* Tabs + Search */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, city, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
            {([
              { value: 'pending',  label: `Pending (${counts.pending})` },
              { value: 'approved', label: `Approved (${counts.approved})` },
              { value: 'rejected', label: `Rejected (${counts.rejected})` },
            ] as { value: StatusTab; label: string }[]).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  statusTab === tab.value
                    ? tab.value === 'pending' ? 'bg-amber-500 text-white'
                    : tab.value === 'approved' ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vendor cards */}
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-purple-400" />
            <p className="text-sm text-gray-400">Loading vendors…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-gray-100">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Store size={22} className="text-gray-400" />
            </div>
            <p className="font-bold text-gray-700 mb-1">
              {search ? 'No vendors match your search' : `No ${statusTab} vendors`}
            </p>
            <p className="text-sm text-gray-400">
              {statusTab === 'pending'
                ? 'New business applications will appear here for review'
                : `No vendors have been ${statusTab} yet`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((v) => (
              <VendorCard
                key={v.id}
                vendor={v}
                onApprove={handleApprove}
                onReject={handleReject}
                processing={processing}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-5">
          {filtered.length} vendor{filtered.length !== 1 ? 's' : ''} shown
        </p>
      </div>
    </div>
  );
}
