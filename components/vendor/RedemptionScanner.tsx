'use client';

// =============================================================================
// components/vendor/RedemptionScanner.tsx
// The vendor's point-of-sale confirmation screen.
//
// Two modes:
//   MODE A — Manual code entry: Vendor types in the "STUD-XXXX-XXXX" code
//   MODE B — QR scan: Uses the device camera to scan the student's QR
//             (via the browser's BarcodeDetector API with fallback)
//
// After a successful confirmation, shows a green success screen with the
// student's display name and discount to apply.
//
// UX DESIGN PRINCIPLES:
//   - Big, thumb-friendly input for typing in a busy environment
//   - Auto-formats code with hyphens as vendor types
//   - Clear error states (expired, already used, wrong vendor)
//   - Success state is unmistakeable — large green checkmark
//   - One-tap "Scan another" to reset for the next customer
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Keyboard, CheckCircle, XCircle, Loader2, RotateCcw, Camera, AlertTriangle } from 'lucide-react';
import type { ConfirmRedemptionResponse } from '@/lib/types/database.types';
import { normaliseVoucherCode, isValidVoucherCodeFormat } from '@/lib/utils/voucher';

type ScanMode = 'manual' | 'camera';
type ResultState = 'idle' | 'loading' | 'success' | 'error';

interface ScanResult {
  state: ResultState;
  data?: ConfirmRedemptionResponse;
  errorMessage?: string;
}

// ── Auto-format helper: inserts hyphens as user types ─────────────────────
function autoFormatCode(raw: string): string {
  // Strip non-alphanumeric, uppercase
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  if (clean.length <= 4) return clean;
  if (clean.length <= 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

export default function RedemptionScanner() {
  const [mode, setMode] = useState<ScanMode>('manual');
  const [codeInput, setCodeInput] = useState('');
  const [result, setResult] = useState<ScanResult>({ state: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

  // ── Camera setup ──────────────────────────────────────────────────────────
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

      // Use BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        const detector = new (window as Window & { BarcodeDetector: typeof BarcodeDetector }).BarcodeDetector({
          formats: ['qr_code'],
        });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || result.state === 'loading') return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const payload = barcodes[0].rawValue;
              stopCamera();
              handleConfirmCode(payload);
            }
          } catch { /* silent */ }
        }, 500);
      }
    } catch {
      setResult({ state: 'error', errorMessage: 'Camera access denied. Please use manual code entry.' });
      setMode('manual');
    }
  }, [result.state]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  // ── Confirm a code via the API ────────────────────────────────────────────
  const handleConfirmCode = async (rawCode: string) => {
    const normCode = normaliseVoucherCode(rawCode);

    // Quick format validation before hitting the API
    if (!isValidVoucherCodeFormat(normCode)) {
      setResult({ state: 'error', errorMessage: 'Invalid code format. Codes look like: STUD-XXXX-XXXX' });
      return;
    }

    setResult({ state: 'loading' });

    try {
      const res = await fetch('/api/redemptions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemption_code: normCode }),
      });

      const data: ConfirmRedemptionResponse & { error?: string } = await res.json();

      if (!res.ok || data.error) {
        setResult({ state: 'error', errorMessage: data.error ?? 'Failed to confirm code.' });
        return;
      }

      setResult({ state: 'success', data });
    } catch {
      setResult({ state: 'error', errorMessage: 'Network error. Check your connection and try again.' });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleConfirmCode(codeInput);
  };

  const handleReset = () => {
    setCodeInput('');
    setResult({ state: 'idle' });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── SUCCESS STATE ─────────────────────────────────────────────────────────
  if (result.state === 'success' && result.data) {
    const d = result.data;
    return (
      <div className="flex flex-col items-center text-center py-8 px-4 animate-fade-in">
        {/* Big checkmark */}
        <div className="w-20 h-20 rounded-full bg-vendor-100 flex items-center justify-center mb-5 animate-slide-up">
          <CheckCircle size={44} className="text-vendor-600" />
        </div>

        <h2 className="text-2xl font-black text-gray-900 mb-1">Voucher Accepted!</h2>
        <p className="text-gray-500 text-sm mb-6">Apply the discount for this customer.</p>

        {/* Discount highlight box */}
        <div className="w-full max-w-xs bg-vendor-50 border-2 border-vendor-200 rounded-2xl p-5 mb-5">
          <div className="text-3xl font-black text-vendor-700 mb-1">
            {d.discount_label}
          </div>
          <div className="text-sm font-semibold text-gray-700">{d.offer_title}</div>
          <div className="mt-3 pt-3 border-t border-vendor-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">Student</span>
            <span className="font-bold text-gray-900">{d.student_display_name}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
            <span>Confirmed at</span>
            <span>{new Date(d.confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Scan another button */}
        <button
          onClick={handleReset}
          className="btn-vendor w-full max-w-xs"
        >
          <RotateCcw size={16} />
          Scan another code
        </button>
      </div>
    );
  }

  // ── MAIN SCANNER UI ───────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-gray-100 p-1">
        {[
          { mode: 'manual' as ScanMode, label: 'Enter code', icon: <Keyboard size={14} /> },
          { mode: 'camera' as ScanMode, label: 'Scan QR',    icon: <Camera size={14} /> },
        ].map((opt) => (
          <button
            key={opt.mode}
            onClick={() => { setMode(opt.mode); setResult({ state: 'idle' }); setCodeInput(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === opt.mode
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── MANUAL MODE ──────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Student voucher code
            </label>
            <input
              ref={inputRef}
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(autoFormatCode(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(e as never); }}
              placeholder="STUD-XXXX-XXXX"
              maxLength={14}
              disabled={result.state === 'loading'}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`w-full text-center text-2xl font-black tracking-[0.2em] font-mono
                bg-gray-50 border-2 rounded-2xl px-4 py-4 focus:outline-none transition-colors
                placeholder:text-gray-300 placeholder:text-lg placeholder:tracking-widest
                ${result.state === 'error'
                  ? 'border-red-300 text-red-700 bg-red-50'
                  : result.state === 'loading'
                    ? 'border-gray-200 text-gray-400'
                    : 'border-gray-200 text-gray-900 focus:border-vendor-400 focus:bg-white'
                }`}
            />
          </div>

          {/* Error message */}
          {result.state === 'error' && result.errorMessage && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-fade-in">
              <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{result.errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={codeInput.length < 14 || result.state === 'loading'}
            className={`w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all duration-150 ${
              codeInput.length < 14 || result.state === 'loading'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-vendor-600 text-white hover:bg-vendor-700 active:scale-[0.98] shadow-sm hover:shadow-md'
            }`}
          >
            {result.state === 'loading' ? (
              <><Loader2 size={18} className="animate-spin" /> Validating...</>
            ) : (
              <><CheckCircle size={18} /> Confirm Voucher</>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            Tip: The code is on the student&apos;s screen. You can also switch to{' '}
            <button type="button" onClick={() => setMode('camera')} className="underline text-vendor-600">
              camera scan
            </button>.
          </p>
        </form>
      )}

      {/* ── CAMERA MODE ──────────────────────────────────────────────────── */}
      {mode === 'camera' && (
        <div className="space-y-4">
          {result.state === 'loading' ? (
            <div className="aspect-square rounded-2xl bg-gray-100 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={36} className="animate-spin text-vendor-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Validating code…</p>
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
              {/* Scan target overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 rounded-2xl border-2 border-white/70 relative">
                  {/* Corner accents */}
                  {[
                    'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                    'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                    'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                    'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
                  ].map((cls, i) => (
                    <div key={i} className={`absolute w-6 h-6 border-vendor-400 ${cls}`} />
                  ))}
                  {/* Scanning animation */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-vendor-400/70 animate-[scan_2s_ease-in-out_infinite]" />
                </div>
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                  Point camera at student&apos;s QR code
                </span>
              </div>
            </div>
          )}

          {/* BarcodeDetector not supported warning */}
          {!('BarcodeDetector' in window) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span>Camera scanning requires Chrome or Edge. Use manual entry for Safari/Firefox.</span>
            </div>
          )}

          {result.state === 'error' && result.errorMessage && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-fade-in">
              <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{result.errorMessage}</span>
            </div>
          )}

          <button onClick={handleReset} className="btn-secondary w-full">
            <RotateCcw size={15} />
            Reset / Try again
          </button>
        </div>
      )}
    </div>
  );
}
