// @ts-nocheck
// Pre-existing Supabase typed-client debt — suppressed until db types are regenerated.
'use client';

// =============================================================================
// components/vendor/LoyaltyScanner.tsx
//
// The vendor's in-store loyalty scanner.
// The vendor opens this panel when a student arrives; they point their camera
// at the student's phone screen which shows a time-based QR code.
// The scan awards 1 stamp (or more with bonuses/double windows).
//
// Flow:
//   Student opens /loyalty → sees live QR (refreshes every 60s, expires in 90s)
//   Vendor opens scanner → scans student's screen
//   POST /api/loyalty/vendor-stamp with { qr_payload }
//   Server validates HMAC + expiry → awards stamp
//
// Why vendor-scans-student (vs old student-scans-vendor QR):
//   - Frictionless: student just opens the app; no scanning, no navigating
//   - Fraud-proof: HMAC + expiry prevents screenshot sharing or replay attacks
//   - Familiar: mirrors contactless payment UX (student shows phone, vendor scans)
//
// Input modes:
//   CAMERA  — BarcodeDetector API (Chrome/Edge). Reads STUDEALS_STAMP:v1:... payload.
//   MANUAL  — Vendor pastes the QR payload string (fallback for Safari/Firefox).
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Keyboard, CheckCircle, XCircle, Loader2,
  RotateCcw, AlertTriangle, Star, Gift, Stamp,
  Smartphone,
} from 'lucide-react';

type ScanMode = 'camera' | 'manual';
type ScanState = 'idle' | 'loading' | 'stamp_added' | 'reward' | 'error';

interface StampResult {
  student_name: string;
  offer_title: string;
  stamps_in_cycle: number;
  required_visits: number;
  reward_triggered: boolean;
  reward_label: string;
  loyalty_mode: string;
  stamped_at: string;
  is_first_visit: boolean;
  double_stamp: boolean;
  stamps_awarded: number;
}

// ── Stamp dots UI ─────────────────────────────────────────────────────────────
function StampDots({
  filled,
  total,
  small = false,
}: {
  filled: number;
  total: number;
  small?: boolean;
}) {
  const size = small ? 'w-5 h-5' : 'w-8 h-8';
  const dots = Math.min(total, 10);
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {Array.from({ length: dots }).map((_, i) => (
        <div
          key={i}
          className={`${size} rounded-full flex items-center justify-center transition-all duration-300 ${
            i < filled
              ? 'bg-vendor-500 shadow-sm scale-100'
              : 'bg-gray-200 scale-90'
          }`}
        >
          {i < filled && <Stamp size={small ? 10 : 14} className="text-white" />}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LoyaltyScanner() {
  const [mode, setMode] = useState<ScanMode>('camera');
  const [manualInput, setManualInput] = useState('');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<StampResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedRef = useRef<string>('');

  // ── Camera lifecycle ───────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || scanState === 'loading') return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const payload = barcodes[0].rawValue as string;
              // Deduplicate: only process once per unique payload
              if (payload === lastScannedRef.current) return;
              // Only process Studeals QR codes
              if (!payload.startsWith('STUDEALS_STAMP:')) return;
              lastScannedRef.current = payload;
              stopCamera();
              await processQRPayload(payload);
            }
          } catch { /* silent */ }
        }, 400);
      }
    } catch {
      setErrorMsg('Camera access denied. Use manual entry instead.');
      setScanState('error');
      setMode('manual');
    }
  }, [scanState, stopCamera]);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  useEffect(() => {
    if (mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

  // ── Core: call vendor-stamp API ────────────────────────────────────────────
  const processQRPayload = useCallback(async (payload: string) => {
    const trimmed = payload.trim();
    if (!trimmed) return;

    setScanState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/loyalty/vendor-stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_payload: trimmed }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanState('error');
        setErrorMsg(data.error ?? 'Failed to log stamp. Please try again.');
        return;
      }

      setResult(data as StampResult);
      setScanState(data.reward_triggered ? 'reward' : 'stamp_added');
    } catch {
      setScanState('error');
      setErrorMsg('Network error. Check your connection and try again.');
    }
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processQRPayload(manualInput);
  };

  const handleReset = () => {
    setManualInput('');
    setResult(null);
    setScanState('idle');
    setErrorMsg('');
    lastScannedRef.current = '';
    // Restart camera if we were in camera mode
    if (mode === 'camera') startCamera();
    else setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── REWARD STATE 🎉 ────────────────────────────────────────────────────────
  if (scanState === 'reward' && result) {
    return (
      <div className="flex flex-col items-center text-center py-6 px-4 animate-fade-in">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg animate-slide-up">
          <Gift size={40} className="text-white" />
        </div>

        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-2xl font-black text-gray-900 mb-1">Reward Unlocked!</h2>
        <p className="text-gray-500 text-sm mb-6">
          {result.student_name} has completed their card.
        </p>

        <div className="w-full max-w-xs bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Star size={16} className="text-amber-500 fill-amber-500" />
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Free Reward</span>
            <Star size={16} className="text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-900 mb-1">{result.reward_label}</div>
          <div className="text-sm text-amber-700">{result.offer_title}</div>
          <div className="mt-3 pt-3 border-t border-amber-200 text-sm text-amber-800 font-semibold">
            For: {result.student_name}
          </div>
        </div>

        <div className="mb-6">
          <StampDots filled={result.required_visits} total={result.required_visits} />
          <p className="text-xs text-gray-400 mt-2">Card complete — new card starts now</p>
        </div>

        <button onClick={handleReset} className="btn-vendor w-full max-w-xs">
          <RotateCcw size={16} />
          Scan next student
        </button>
      </div>
    );
  }

  // ── STAMP ADDED STATE ──────────────────────────────────────────────────────
  if (scanState === 'stamp_added' && result) {
    return (
      <div className="flex flex-col items-center text-center py-6 px-4 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-vendor-100 flex items-center justify-center mb-4 animate-slide-up">
          <CheckCircle size={40} className="text-vendor-600" />
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-1">
          {result.stamps_awarded > 1 ? `${result.stamps_awarded}× Stamps Added!` : 'Stamp Added!'}
        </h2>
        {result.is_first_visit && (
          <p className="text-xs text-brand-600 font-bold mb-1">⭐ First visit bonus!</p>
        )}
        {result.double_stamp && (
          <p className="text-xs text-amber-600 font-bold mb-1">🔥 Double stamp window!</p>
        )}
        <p className="text-gray-500 text-sm mb-5">{result.student_name}</p>

        <div className="w-full max-w-xs bg-vendor-50 border border-vendor-200 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-vendor-700 uppercase tracking-wide">
              {result.offer_title}
            </span>
            <span className="text-xs text-vendor-600 font-bold">
              {result.stamps_in_cycle} / {result.required_visits}
            </span>
          </div>

          <StampDots filled={result.stamps_in_cycle} total={result.required_visits} />

          <div className="mt-4 text-xs text-vendor-700">
            {result.required_visits - result.stamps_in_cycle === 0
              ? 'Reward ready!'
              : `${result.required_visits - result.stamps_in_cycle} more stamp${result.required_visits - result.stamps_in_cycle !== 1 ? 's' : ''} to earn ${result.reward_label}`
            }
          </div>
        </div>

        <button onClick={handleReset} className="btn-vendor w-full max-w-xs">
          <RotateCcw size={16} />
          Scan next student
        </button>
      </div>
    );
  }

  // ── MAIN SCANNER UI ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex rounded-xl bg-gray-100 p-1">
        {([
          { id: 'camera' as ScanMode, label: 'Scan QR', icon: <Camera size={14} /> },
          { id: 'manual' as ScanMode, label: 'Paste code', icon: <Keyboard size={14} /> },
        ] as const).map((opt) => (
          <button
            key={opt.id}
            onClick={() => {
              setMode(opt.id);
              setScanState('idle');
              setManualInput('');
              setErrorMsg('');
              lastScannedRef.current = '';
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === opt.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Instruction strip */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Smartphone size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Ask the student to open their <strong>Loyalty</strong> page in the Studeals app.
          Their personal QR code will appear — scan it with your camera.
        </p>
      </div>

      {/* ── CAMERA MODE ──────────────────────────────────────────────────── */}
      {mode === 'camera' && (
        <div className="space-y-4">
          {scanState === 'loading' ? (
            <div className="aspect-square rounded-2xl bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={36} className="animate-spin text-vendor-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Logging stamp…</p>
              </div>
            </div>
          ) : (
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Viewfinder overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 rounded-2xl border-2 border-white/40 relative">
                  {[
                    'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                    'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                    'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-6 h-6 border-vendor-400 ${cls}`} />
                  ))}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-vendor-400/70 animate-[scan_2s_ease-in-out_infinite]" />
                </div>
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                  Point camera at student&apos;s Loyalty QR
                </span>
              </div>
            </div>
          )}

          {!('BarcodeDetector' in (typeof window !== 'undefined' ? window : {})) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span>
                Camera scanning requires Chrome or Edge.
                Switch to <button type="button" onClick={() => setMode('manual')} className="underline font-semibold">Paste code</button> for Safari/Firefox.
              </span>
            </div>
          )}

          {scanState === 'error' && errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-fade-in">
              <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorMsg}</p>
                <button
                  onClick={handleReset}
                  className="mt-2 text-xs underline font-semibold"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL MODE ──────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Student QR payload
            </label>
            <textarea
              ref={inputRef as any}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="STUDEALS_STAMP:v1:..."
              rows={3}
              disabled={scanState === 'loading'}
              autoComplete="off"
              spellCheck={false}
              className={`w-full text-xs font-mono resize-none
                bg-gray-50 border-2 rounded-2xl px-4 py-3 focus:outline-none transition-colors
                placeholder:text-gray-300
                ${scanState === 'error'
                  ? 'border-red-300 text-red-700 bg-red-50'
                  : 'border-gray-200 text-gray-900 focus:border-vendor-400 focus:bg-white'
                }`}
            />
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Ask the student to copy the QR payload from their Loyalty page and share it with you
              (e.g. by messaging or reading it aloud). Alternatively, use the Camera tab on Chrome/Edge.
            </p>
          </div>

          {scanState === 'error' && errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-fade-in">
              <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!manualInput.trim() || scanState === 'loading'}
            className={`w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all duration-150 ${
              !manualInput.trim() || scanState === 'loading'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-vendor-600 text-white hover:bg-vendor-700 active:scale-[0.98] shadow-sm'
            }`}
          >
            {scanState === 'loading' ? (
              <><Loader2 size={18} className="animate-spin" /> Logging stamp…</>
            ) : (
              <><Stamp size={18} /> Log Stamp</>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
