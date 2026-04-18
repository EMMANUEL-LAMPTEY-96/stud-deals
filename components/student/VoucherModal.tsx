'use client';

// =============================================================================
// components/student/VoucherModal.tsx
// The most important UI moment in the student journey.
// Shown immediately after a student successfully claims a voucher.
//
// UX PRINCIPLES:
//   - QR code is the hero — large, high contrast, easy to scan
//   - Text code is prominent below as a fallback (in case camera fails)
//   - Countdown timer creates urgency and prevents "I'll use it later" dropout
//   - Vendor address shown so student knows exactly where to go
//   - T&Cs accessible but not distracting (collapsed by default)
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, MapPin, Clock, Copy, CheckCircle, AlertTriangle, QrCode } from 'lucide-react';
import type { ClaimOfferResponse } from '@/lib/types/database.types';

interface VoucherModalProps {
  voucher: ClaimOfferResponse;
  onClose: () => void;
}

export default function VoucherModal({ voucher, onClose }: VoucherModalProps) {
  const [copied, setCopied] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  // ── Countdown timer ──────────────────────────────────────────────────────
  const computeTimeLeft = useCallback(() => {
    const diff = new Date(voucher.expires_at).getTime() - Date.now();

    if (diff <= 0) {
      setIsExpired(true);
      setTimeLeft('Expired');
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h >= 1) {
      setTimeLeft(`${h}h ${m}m remaining`);
    } else {
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')} remaining`);
    }
  }, [voucher.expires_at]);

  useEffect(() => {
    computeTimeLeft();
    const interval = setInterval(computeTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [computeTimeLeft]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(voucher.redemption_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  };

  const isUrgent = !isExpired &&
    new Date(voucher.expires_at).getTime() - Date.now() < 30 * 60 * 1000; // < 30 min

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal panel */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 transition-colors"
          aria-label="Close voucher"
        >
          <X size={16} />
        </button>

        {/* Header band */}
        <div className={`px-6 pt-6 pb-4 text-center ${isExpired ? 'bg-gray-50' : 'bg-gradient-to-b from-brand-50 to-white'}`}>
          <div className="text-xs font-bold text-brand-600 tracking-widest uppercase mb-1">
            {isExpired ? 'Voucher Expired' : 'Your Voucher'}
          </div>
          <h2 className="text-xl font-black text-gray-900 leading-tight">
            {voucher.offer.discount_label}
          </h2>
          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{voucher.offer.title}</p>
        </div>

        {/* QR Code */}
        <div className="px-6 py-4 flex flex-col items-center">
          {isExpired ? (
            <div className="w-56 h-56 rounded-2xl bg-gray-100 flex flex-col items-center justify-center gap-3 text-gray-400">
              <AlertTriangle size={32} className="text-gray-300" />
              <p className="text-sm font-medium text-center">This voucher has expired.<br/>Claim a new one.</p>
            </div>
          ) : (
            <div className="qr-container">
              {voucher.qr_code_data_url ? (
                <Image
                  src={voucher.qr_code_data_url}
                  alt="Voucher QR code"
                  width={220}
                  height={220}
                  className="rounded-lg"
                  priority
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center bg-gray-50 rounded-xl">
                  <QrCode size={48} className="text-gray-300" />
                </div>
              )}
            </div>
          )}

          {/* Text code (fallback) */}
          {!isExpired && (
            <button
              onClick={handleCopyCode}
              className="mt-4 flex items-center gap-2 bg-gray-100 hover:bg-gray-200 active:scale-[0.97] rounded-xl px-4 py-2.5 transition-all group"
              aria-label="Copy voucher code"
            >
              <code className="text-base font-black tracking-widest text-gray-800 font-mono">
                {voucher.redemption_code}
              </code>
              <span className={`transition-colors ${copied ? 'text-green-500' : 'text-gray-400 group-hover:text-gray-600'}`}>
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              </span>
            </button>
          )}
          {copied && (
            <p className="text-xs text-green-600 font-medium mt-1 animate-fade-in">Copied to clipboard!</p>
          )}
        </div>

        {/* Timer */}
        <div className={`mx-6 mb-4 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold ${
          isExpired
            ? 'bg-gray-100 text-gray-500'
            : isUrgent
              ? 'bg-red-100 text-red-700 animate-pulse-soft'
              : 'bg-brand-50 text-brand-700'
        }`}>
          <Clock size={14} />
          {timeLeft}
        </div>

        {/* Vendor info */}
        <div className="px-6 pb-4">
          <div className="flex items-start gap-2.5 bg-gray-50 rounded-xl p-3">
            <MapPin size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">{voucher.vendor.business_name}</p>
              {(voucher.vendor.address_line1 || voucher.vendor.city) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {voucher.vendor.address_line1 ? `${voucher.vendor.address_line1}, ` : ''}{voucher.vendor.city}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-6 pb-2">
          <div className="text-center text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded-xl p-3">
            <strong className="text-yellow-800">How to redeem:</strong> Show this QR code to the
            cashier. They&apos;ll scan it to apply your discount. Each code is single-use only.
          </div>
        </div>

        {/* T&Cs toggle */}
        {voucher.offer.terms_and_conditions && (
          <div className="px-6 pb-6">
            <button
              onClick={() => setShowTerms(!showTerms)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
            >
              {showTerms ? 'Hide' : 'View'} terms & conditions
            </button>
            {showTerms && (
              <p className="mt-2 text-xs text-gray-500 leading-relaxed animate-fade-in">
                {voucher.offer.terms_and_conditions}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
