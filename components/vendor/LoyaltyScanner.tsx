'use client';

// =============================================================================
// components/vendor/LoyaltyScanner.tsx
//
// The vendor's in-store loyalty scanner.
// This is the PRIMARY daily action for a vendor — when a student arrives,
// the vendor opens this panel and scans the student's loyalty QR code.
//
// Each scan = 1 stamp logged for that student.
// When the student hits their punch card threshold, a reward is shown.
//
// Two input modes:
//   CAMERA — uses device camera (BarcodeDetector API, Chrome/Edge only)
//   MANUAL — vendor types the student's 8-char code (shown under their QR)
//
// Success states:
//   STAMP ADDED  — shows green stamp count (e.g. "4 / 5 stamps")
//   REWARD! 🎉   — full-screen celebration when threshold reached
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  QrCode, Keyboard, CheckCircle, XCircle, Loader2,
  RotateCcw, Camera, AlertTriangle, Star, Gift, Stamp,
} from 'lucide-react';

type ScanMode = 'manual' | 'camera';
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

export default function LoyaltyScanner() {
  const [mode, setMode] = useState<ScanMode>('manual');
  const [input, setInput] = useState('');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<StampResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus on mount / mode switch
  useEffect(() => {
    if (mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

  // ── Camera ─────────────────────────────────────────────────────────────────
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
        const detector = new (window as Window & {
          BarcodeDetector: typeof BarcodeDetector;
        }).BarcodeDetector({ formats: ['qr_code'] });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || scanState === 'loading') return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const payload = barcodes[0].rawValue;
              stopCamera();
              await processStudentId(payload);
            }
          } catch (_) { /* silent */ }
        }, 500);
      }
    } catch (_) {
      setErrorMsg('Camera access denied. Use manual entry instead.');
      setScanState('error');
      setMode('manual');
    }
  }, [scanState, stopCamera]);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  // ── Core: call the stamp API ───────────────────────────────────────────────
  const processStudentId = async (studentProfileId: string) => {
    // Accept full UUID or 8-char short code (first 8 chars of UUID)
    const id = studentProfileId.trim();
    if (!id) return;

    setScanState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/loyalty/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_profile_id: id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanState('error');
        setErrorMsg(data.error ?? 'Failed to log stamp. Please try again.');
        return;
      }

      setResult(data as StampResult);
      setScanState(data.reward_triggered ? 'reward' : 'stamp_added');
    } catch (_) {
      setScanState('error');
      setErrorMsg('Network error. Check your connection.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processStudentId(input);
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setScanState('idle');
    setErrorMsg('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── REWARD STATE 🎉 ────────────────────────────────────────────────────────
  if (scanState === 'reward' && result) {
    return (
      <div className="flex flex-col items-center text-center py-6 px-4 animate-fade-in">
        {/* Celebration */}
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg animate-slide-up">
          <Gift size={40} className="text-white" />
        </div>

        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-2xl font-black text-gray-900 mb-1">Reward Unlocked!</h2>
        <p className="text-gray-500 text-sm mb-6">
          {result.student_name} has earned their reward.
        </p>

        {/* Reward box */}
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

        {/* Full stamp row completed */}
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

        <h2 className="text-2xl font-black text-gray-900 mb-1">Stamp Added!</h2>
        <p className="text-gray-500 text-sm mb-5">{result.student_name}</p>

        {/* Progress */}
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
        {[
          { mode: 'manual' as ScanMode, label: 'Enter ID', icon: <Keyboard size={14} /> },
          { mode: 'camera' as ScanMode, label: 'Scan QR', icon: <Camera size={14} /> },
        ].map((opt) => (
          <button
            key={opt.mode}
            onClick={() => { setMode(opt.mode); setScanState('idle'); setInput(''); setErrorMsg(''); }}
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
              Student loyalty card ID
            </label>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.trim())}
              placeholder="Paste or type student ID"
              disabled={scanState === 'loading'}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full text-center text-sm font-mono
                bg-gray-50 border-2 rounded-2xl px-4 py-4 focus:outline-none transition-colors
                placeholder:text-gray-300
                ${scanState === 'error'
                  ? 'border-red-300 text-red-700 bg-red-50'
                  : 'border-gray-200 text-gray-900 focus:border-vendor-400 focus:bg-white'
                }`}
            />
          </div>

          {/* Error */}
          {scanState === 'error' && errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-fade-in">
              <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!input || scanState === 'loading'}
            className={`w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all duration-150 ${
              !input || scanState === 'loading'
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

          <p className="text-center text-xs text-gray-400">
            The student&apos;s ID code is shown beneath their QR code in the app.
            Or switch to{' '}
            <button type="button" onClick={() => setMode('camera')} className="underline text-vendor-600">
              camera scan
            </button>.
          </p>
        </form>
      )}

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
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 rounded-2xl border-2 border-white/70 relative">
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
                  Point camera at student&apos;s loyalty QR
                </span>
              </div>
            </div>
          )}

          {!('BarcodeDetector' in (typeof window !== 'undefined' ? window : {})) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span>Camera scanning requires Chrome or Edge. Use manual entry on Safari/Firefox.</span>
            </div>
          )}

          {scanState === 'error' && errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button onClick={handleReset} className="btn-secondary w-full">
            <RotateCcw size={15} />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
