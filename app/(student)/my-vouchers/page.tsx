'use client';

// =============================================================================
// app/(student)/my-vouchers/page.tsx — Student's Active Vouchers
// Shows all vouchers a student has claimed, with live QR codes they can show
// at the counter. Tabs: Active | Used | Expired
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VoucherModal from '@/components/student/VoucherModal';
import {
  QrCode, Clock, CheckCircle, Tag, Store, MapPin,
  Loader2, Ticket, ArrowRight, Sparkles,
} from 'lucide-react';
import type { ClaimOfferResponse } from '@/lib/types/database.types';

type TabKey = 'active' | 'used' | 'expired';

interface VoucherRow {
  id: string;
  redemption_code: string;
  qr_code_data_url: string | null;
  status: string;
  claimed_at: string;
  expires_at: string;
  confirmed_at: string | null;
  offer: {
    id: string;
    title: string;
    discount_label: string;
    category: string;
    vendor: {
      business_name: string;
      city: string | null;
      logo_url: string | null;
    } | null;
  } | null;
}

function timeLeft(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function VoucherCard({ v, onShow }: { v: VoucherRow; onShow: (v: VoucherRow) => void }) {
  const isActive  = v.status === 'claimed' && new Date(v.expires_at) > new Date();
  const isUsed    = v.status === 'confirmed';
  const isExpired = v.status !== 'confirmed' && new Date(v.expires_at) <= new Date();

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${
      isActive ? 'border-purple-200 shadow-sm shadow-purple-50' :
      isUsed   ? 'border-green-100'   : 'border-gray-100 opacity-75'
    }`}>
      {/* Top strip */}
      <div className={`h-1.5 w-full ${isActive ? 'bg-purple-500' : isUsed ? 'bg-green-500' : 'bg-gray-300'}`} />

      <div className="p-4">
        {/* Vendor + offer info */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {v.offer?.vendor?.logo_url
              ? <img src={v.offer.vendor.logo_url} alt="" className="w-full h-full object-cover" />
              : <Store size={18} className="text-purple-600" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{v.offer?.vendor?.business_name ?? 'Unknown'}</p>
            <p className="text-xs text-gray-500 truncate">{v.offer?.title}</p>
          </div>
          <div className="bg-purple-600 text-white text-xs font-black px-2.5 py-1 rounded-lg flex-shrink-0">
            {v.offer?.discount_label}
          </div>
        </div>

        {/* Code */}
        <div className={`rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between ${
          isActive ? 'bg-purple-50' : 'bg-gray-50'
        }`}>
          <div className="flex items-center gap-2">
            <QrCode size={14} className={isActive ? 'text-purple-600' : 'text-gray-400'} />
            <span className={`font-mono text-sm font-bold tracking-widest ${isActive ? 'text-purple-900' : 'text-gray-500'}`}>
              {v.redemption_code}
            </span>
          </div>
          <div className="text-right">
            {isActive && (
              <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
                <Clock size={10} /> {timeLeft(v.expires_at)}
              </span>
            )}
            {isUsed && (
              <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                <CheckCircle size={10} /> Used {timeAgo(v.confirmed_at!)}
              </span>
            )}
            {isExpired && (
              <span className="text-xs text-gray-400">Expired</span>
            )}
          </div>
        </div>

        {/* Location */}
        {v.offer?.vendor?.city && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
            <MapPin size={10} /> {v.offer.vendor.city}
          </p>
        )}

        {/* Action */}
        {isActive && (
          <button
            onClick={() => onShow(v)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <QrCode size={15} /> Show QR code
          </button>
        )}
        {isUsed && (
          <div className="flex items-center justify-center gap-2 text-green-600 text-xs font-semibold py-2">
            <CheckCircle size={14} /> Redeemed successfully
          </div>
        )}
        {isExpired && (
          <Link href={`/offer/${v.offer?.id}`} className="block text-center text-xs text-purple-600 font-medium hover:underline py-1">
            Reclaim this offer →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function MyVouchersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab]             = useState<TabKey>('active');
  const [vouchers, setVouchers]   = useState<VoucherRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeVoucher, setActiveVoucher] = useState<ClaimOfferResponse | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data } = await supabase
        .from('redemptions')
        .select(`
          id, redemption_code, qr_code_data_url, status,
          claimed_at, expires_at, confirmed_at,
          offer:offers (
            id, title, discount_label, category,
            vendor:vendor_profiles (business_name, city, logo_url)
          )
        `)
        .eq('student_id', user.id)
        .order('claimed_at', { ascending: false })
        .limit(50);

      setVouchers((data ?? []) as unknown as VoucherRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = vouchers.filter(v => {
    if (tab === 'active')  return v.status === 'claimed' && new Date(v.expires_at) > new Date();
    if (tab === 'used')    return v.status === 'confirmed';
    if (tab === 'expired') return v.status !== 'confirmed' && new Date(v.expires_at) <= new Date();
    return true;
  });

  const counts = {
    active:  vouchers.filter(v => v.status === 'claimed' && new Date(v.expires_at) > new Date()).length,
    used:    vouchers.filter(v => v.status === 'confirmed').length,
    expired: vouchers.filter(v => v.status !== 'confirmed' && new Date(v.expires_at) <= new Date()).length,
  };

  const handleShow = (v: VoucherRow) => {
    if (!v.qr_code_data_url) return;
    setActiveVoucher({
      redemption_id:   v.id,
      redemption_code: v.redemption_code,
      qr_code_data_url: v.qr_code_data_url,
      expires_at:      v.expires_at,
      offer_title:     v.offer?.title ?? '',
      discount_label:  v.offer?.discount_label ?? '',
      vendor_name:     v.offer?.vendor?.business_name ?? '',
      vendor_address:  v.offer?.vendor?.city ?? '',
      terms_and_conditions: null,
    } as ClaimOfferResponse);
  };

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'active',  label: 'Active',  count: counts.active },
    { key: 'used',    label: 'Used',    count: counts.used },
    { key: 'expired', label: 'Expired', count: counts.expired },
  ];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900">My Vouchers</h1>
              <p className="text-gray-500 text-sm mt-0.5">Your saved discount codes</p>
            </div>
            <Link href="/dashboard" className="text-sm text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1">
              Find deals <ArrowRight size={14} />
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab === t.key
                      ? t.key === 'active' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-purple-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {tab === 'active' ? <Ticket size={24} className="text-gray-400" /> : <CheckCircle size={24} className="text-gray-400" />}
              </div>
              <p className="text-gray-600 font-semibold mb-1">
                {tab === 'active'  ? 'No active vouchers' :
                 tab === 'used'    ? 'No used vouchers yet' :
                                     'No expired vouchers'}
              </p>
              <p className="text-gray-400 text-sm mb-5">
                {tab === 'active' ? 'Browse deals and claim your first discount.' : 'Vouchers will appear here once used.'}
              </p>
              {tab === 'active' && (
                <Link href="/dashboard" className="inline-flex items-center gap-2 bg-purple-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-purple-700 transition-colors">
                  <Sparkles size={14} /> Browse deals
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(v => (
                <VoucherCard key={v.id} v={v} onShow={handleShow} />
              ))}
            </div>
          )}
        </div>
      </div>

      {activeVoucher && <VoucherModal voucher={activeVoucher} onClose={() => setActiveVoucher(null)} />}
    </>
  );
}
