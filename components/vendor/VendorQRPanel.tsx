'use client';

// =============================================================================
// components/vendor/VendorQRPanel.tsx
//
// Compact QR code panel displayed on the vendor dashboard sidebar and the
// staff scan screen. Students point their phone camera at this QR to earn a
// stamp via the /stamp/[vendorId] route.
//
// Props:
//   vendorId     — the vendor_profiles.id (UUID)
//   businessName — shown as alt text and in the copy toast
//   city         — optional sub-label
// =============================================================================

import { useEffect, useState, useRef } from 'react';
import { QrCode, Copy, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';

interface VendorQRPanelProps {
  vendorId: string;
  businessName: string;
  city?: string;
}

export default function VendorQRPanel({ vendorId, businessName, city }: VendorQRPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string>('');
  const [generating, setGenerating] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    const url = `${window.location.origin}/stamp/${vendorId}`;
    setStampUrl(url);

    let cancelled = false;
    (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 256,
          margin: 2,
          color: { dark: '#111827', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        });
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrError(null);
        }
      } catch (_) {
        if (!cancelled) setQrError('Could not generate QR code. Refresh to retry.');
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [vendorId]);

  // Cleanup copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!stampUrl) return;
    try {
      await navigator.clipboard.writeText(stampUrl);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // Clipboard not available — silently ignore
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR code area */}
      <div className="relative w-36 h-36 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        {generating ? (
          <Loader2 size={22} className="animate-spin text-gray-300" />
        ) : qrError ? (
          <div className="flex flex-col items-center gap-1.5 px-3 text-center">
            <AlertCircle size={18} className="text-red-400" />
            <p className="text-[10px] text-red-500 leading-tight">{qrError}</p>
          </div>
        ) : qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`Scan to earn stamps at ${businessName}`}
            className="w-full h-full object-contain"
          />
        ) : null}
      </div>

      {/* Business label */}
      <div className="text-center">
        <p className="text-sm font-bold text-gray-900 leading-tight">{businessName}</p>
        {city && <p className="text-xs text-gray-400 mt-0.5">{city}</p>}
        <p className="text-[11px] text-vendor-600 font-semibold mt-1.5 flex items-center gap-1 justify-center">
          <QrCode size={11} />
          Students scan to earn stamps
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 w-full">
        <button
          onClick={handleCopy}
          disabled={!stampUrl}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          {copied
            ? <><CheckCircle size={12} className="text-green-500" /> Copied!</>
            : <><Copy size={12} /> Copy link</>}
        </button>
        {stampUrl && (
          <a
            href={stampUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={12} />
            Test link
          </a>
        )}
      </div>
    </div>
  );
}
