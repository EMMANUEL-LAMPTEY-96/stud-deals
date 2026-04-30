'use client';

// =============================================================================
// components/student/EarnStampScanner.tsx
//
// Camera QR scanner for students to earn loyalty stamps.
//
// Flow:
//   1. Student taps "Earn Stamp" → this modal opens
//   2. Camera activates, student points it at vendor's QR code
//   3. QR decoded → payload validated (type: "stud_stamp")
//   4. POST /api/loyalty/stamp called with vendor_id
//   5. Success: animated stamp card shows progress + reward status
//   6. Error: clear message (already stamped, no loyalty program, etc.)
//
// Uses html5-qrcode for reliable mobile camera scanning.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X, Stamp, Gift, CheckCircle, AlertCircle,
  Loader2, QrCode, Star, Sparkles,
} from 'lucide-react';

type ScanState = 'scanning' | 'loading' | 'success' | 'error' | 'rate_limited';

interface StampResult {
  vendor_name: string;
  vendor_logo: string | null;
  offer_title: string;
  stamps_in_cycle: number;
  required_visits: number;
  reward_triggered: boolean;
  reward_label: string;
  stamps_total: number;
}

interface EarnStampScannerProps {
  onClose: () => void;
  onStampSuccess?: (result: StampResult) => void;
  isVerified?: boolean;
}

const SCANNER_ID = 'earn-stamp-qr-reader';

export default function EarnStampScanner({ onClose, onStampSuccess, isVerified = true }: EarnStampScannerProps) {
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<StampResult | null>(null);
  const [nextAllowed, setNextAllowed] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch { /* already stopped */ }
      scannerRef.current = null;
    }
  }, []);

  const processStamp = useCallback(async (vendorId: string) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;

    await stopScanner();
    setScanState('loading');

    try {
      const res = await fetch('/api/loyalty/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId }),
      });

      const data = await res.json();

      if (res.status === 429) {
        // Rate limited
        setScanState('rate_limited');
        setErrorMsg(data.error ?? 'Already stamped here recently.');
        setNextAllowed(data.next_allowed_at ?? null);
        return;
      }

      if (!res.ok) {
        setScanState('error');
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      const stampResult: StampResult = {
        vendor_name:     data.vendor_name,
        vendor_logo:     data.vendor_logo,
        offer_title:     data.offer_title,
        stamps_in_cycle: data.stamps_in_cycle,
        required_visits: data.required_visits,
        reward_triggered: data.reward_triggered,
        reward_label:    data.reward_label,
        stamps_total:    data.stamps_total,
      };

      setResult(stampResult);
      setScanState('success');
      onStampSuccess?.(stampResult);
    } catch {
      setScanState('error');
      setErrorMsg('Network error — please check your connection and try again.');
    }
  }, [stopScanner, onStampSuccess]);

  const startScanner = useCallback(async () => {
    // Small delay to let DOM render the container
    await new Promise((r) => setTimeout(r, 150));

    const container = document.getElementById(SCANNER_ID);
    if (!container) return;

    const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' }, // use back camera
        {
          fps: 10,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Validate it's a Stud Deals QR
          try {
            const payload = JSON.parse(decodedText);
            if (payload?.type === 'stud_stamp' && payload?.vendor_id) {
              processStamp(payload.vendor_id);
            }
          } catch {
            // Not JSON — ignore and keep scanning
          }
        },
        () => { /* scan failure — normal, ignore */ }
      );
    } catch {
      setScanState('error');
      setErrorMsg('Could not access camera. Please allow camera access and try again.');
    }
  }, [processStamp]);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  const handleRetry = () => {
    hasScannedRef.current = false;
    setErrorMsg('');
    setResult(null);
    setNextAllowed(null);
    setScanState('scanning');
    startScanner();
  };

  // ── Time until next stamp ────────────────────────────────────────────────────
  const timeUntilNext = nextAllowed
    ? (() => {
        const mins = Math.ceil((new Date(nextAllowed).getTime() - Date.now()) / 60000);
        if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`;
        const hrs = Math.ceil(mins / 60);
        return `${hrs} hour${hrs !== 1 ? 's' : ''}`;
      })()
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center">
              <QrCode size={15} className="text-brand-600" />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">Earn Stamp</p>
              <p className="text-xs text-gray-400">Scan the vendor&apos;s QR code</p>
            </div>
          </div>
          <button
            onClick={() => { stopScanner(); onClose(); }}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="p-5">

          {/* SCANNING STATE */}
          {scanState === 'scanning' && (
            <div>
              {/* Camera viewport */}
              <div className="relative rounded-2xl overflow-hidden bg-black mb-4" style={{ aspectRatio: '1/1' }}>
                <div id={SCANNER_ID} className="w-full h-full" />
                {/* Corner guides */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-8 left-8 w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-lg opacity-80" />
                  <div className="absolute top-8 right-8 w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-lg opacity-80" />
                  <div className="absolute bottom-8 left-8 w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-lg opacity-80" />
                  <div className="absolute bottom-8 right-8 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-lg opacity-80" />
                </div>
              </div>
              <p className="text-center text-sm text-gray-500">
                Point your camera at the <strong>Stud Deals QR code</strong> at the counter
              </p>
            </div>
          )}

          {/* LOADING STATE */}
          {scanState === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-brand-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-gray-900">Logging your stamp…</p>
                <p className="text-xs text-gray-400 mt-1">Just a moment</p>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {scanState === 'success' && result && (
            <div className="py-4 flex flex-col items-center text-center gap-4">
              {/* Reward banner */}
              {result.reward_triggered && isVerified ? (
                <div className="w-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl p-4 flex flex-col items-center gap-2 mb-1">
                  <Sparkles size={28} className="text-white" />
                  <p className="text-white font-black text-lg">Reward Unlocked! 🎉</p>
                  <p className="text-white/90 text-sm font-semibold">{result.reward_label}</p>
                  <p className="text-white/70 text-xs">Show this to the staff to claim</p>
                </div>
              ) : result.reward_triggered && !isVerified ? (
                <div className="w-full bg-gradient-to-r from-brand-600 to-brand-700 rounded-2xl p-4 flex flex-col items-center gap-2 mb-1">
                  <Gift size={28} className="text-white" />
                  <p className="text-white font-black text-base">You earned a reward! 🎉</p>
                  <p className="text-white/80 text-xs text-center">
                    Verify your student status to claim <strong>{result.reward_label}</strong>
                  </p>
                  <a
                    href="/verification"
                    className="mt-1 bg-white text-brand-700 text-xs font-black px-4 py-2 rounded-xl hover:bg-brand-50 transition-colors"
                  >
                    Verify now →
                  </a>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle size={30} className="text-green-600" />
                </div>
              )}

              <div>
                <p className="font-black text-gray-900 text-lg">Stamp Earned!</p>
                <p className="text-sm text-gray-500 mt-0.5">{result.vendor_name}</p>
              </div>

              {/* Punch card progress */}
              <div className="w-full bg-gray-50 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-3 font-semibold">
                  {result.offer_title}
                </p>
                <div className="flex justify-center flex-wrap gap-2 mb-3">
                  {Array.from({ length: result.required_visits }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        i < result.stamps_in_cycle
                          ? 'bg-brand-600 shadow-md scale-105'
                          : 'bg-gray-200'
                      }`}
                    >
                      <Stamp
                        size={16}
                        className={i < result.stamps_in_cycle ? 'text-white' : 'text-gray-400'}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center">
                  {result.stamps_in_cycle} / {result.required_visits} stamps
                  {!result.reward_triggered && (
                    <span className="text-brand-600 font-bold">
                      {' '}· {result.required_visits - result.stamps_in_cycle} more for {result.reward_label}
                    </span>
                  )}
                </p>
              </div>

              <p className="text-xs text-gray-400">
                {result.stamps_total} total stamp{result.stamps_total !== 1 ? 's' : ''} at {result.vendor_name}
              </p>

              <button
                onClick={onClose}
                className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors text-sm"
              >
                Done
              </button>
            </div>
          )}

          {/* RATE LIMITED STATE */}
          {scanState === 'rate_limited' && (
            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Stamp size={28} className="text-amber-600" />
              </div>
              <div>
                <p className="font-black text-gray-900 text-base">Already stamped!</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{errorMsg}</p>
                {timeUntilNext && (
                  <p className="text-xs text-brand-600 font-bold mt-2">
                    Come back in {timeUntilNext}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                OK
              </button>
            </div>
          )}

          {/* ERROR STATE */}
          {scanState === 'error' && (
            <div className="py-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <div>
                <p className="font-black text-gray-900 text-base">Something went wrong</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{errorMsg}</p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors text-sm"
                >
                  Try again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
