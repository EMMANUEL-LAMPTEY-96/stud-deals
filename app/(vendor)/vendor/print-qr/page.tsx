'use client';

// =============================================================================
// app/(vendor)/vendor/print-qr/page.tsx — Print QR Kit
//
// Generates a print-ready A4 poster for the vendor to display at their counter.
// The poster contains:
//   - Business name + logo (or initials fallback)
//   - QR code (same URL as the stamp scanner — students scan this)
//   - "Scan to earn loyalty stamps" headline
//   - StudDeals branding + short instruction
//   - Optional: a half-sheet (A5) variant for table cards
//
// Uses window.print() with a @media print stylesheet that hides the UI chrome
// and shows only the poster. Two layout sizes: A4 full-page / A5 half-sheet.
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Printer, QrCode, Download, ChevronLeft, Loader2,
  Smartphone, Coffee, Star, Zap, AlertCircle,
} from 'lucide-react';
import QRCode from 'qrcode';

const POSTER_STYLES = [
  { id: 'classic',  label: 'Classic',    bg: 'bg-white',              text: 'text-gray-900',   accent: '#16a34a', sub: 'bg-green-50'   },
  { id: 'dark',     label: 'Dark',       bg: 'bg-gray-900',           text: 'text-white',      accent: '#4ade80', sub: 'bg-gray-800'   },
  { id: 'brand',    label: 'Brand',      bg: 'bg-vendor-600',         text: 'text-white',      accent: '#ffffff', sub: 'bg-vendor-700' },
  { id: 'warm',     label: 'Warm',       bg: 'bg-amber-50',           text: 'text-amber-900',  accent: '#d97706', sub: 'bg-amber-100'  },
];

type PosterSize = 'a4' | 'a5';
type StyleId = 'classic' | 'dark' | 'brand' | 'warm';

export default function PrintQRKitPage() {
  const router = useRouter();
  const supabase = createClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState('');
  const [businessName, setBN] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [businessType, setBT] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [size, setSize] = useState<PosterSize>('a4');
  const [styleId, setStyleId] = useState<StyleId>('classic');
  const [tagline, setTagline] = useState('Scan to earn loyalty stamps');
  const [printing, setPrinting] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?role=vendor'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles')
        .select('id, business_name, logo_url, city, business_type')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!vp) { router.push('/vendor/profile'); return; }

      setVendorId(vp.id);
      setBN(vp.business_name);
      setLogoUrl(vp.logo_url ?? null);
      setCity(vp.city ?? '');
      setBT(vp.business_type ?? '');

      // Generate QR — points to the vendor's public stamp page
      const stampUrl = `${window.location.origin}/stamp/${vp.id}`;
      try {
        const qr = await QRCode.toDataURL(stampUrl, {
          width: 400,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        });
        setQrDataUrl(qr);
      } catch {
        setQrError('Failed to generate QR code. Please refresh the page.');
      }
      setLoading(false);
    })();
  }, []);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 200);
  };

  const style = POSTER_STYLES.find(s => s.id === styleId)!;

  // Initials fallback
  const initials = businessName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (loading) return (
    <><Navbar/><VendorNav/>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={28} className="animate-spin text-vendor-600 mx-auto mb-3"/>
          <p className="text-gray-500 text-sm">Generating your QR kit…</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Print CSS — hides everything except #print-poster ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-poster, #print-poster * { visibility: visible !important; }
          #print-poster {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
            z-index: 99999 !important;
          }
          @page { margin: 0; size: ${size === 'a4' ? 'A4 portrait' : 'A5 portrait'}; }
        }
      `}</style>

      <Navbar/>
      <VendorNav/>

      <div className="min-h-screen bg-gray-50 no-print">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
              <ChevronLeft size={20}/>
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900">Print QR Kit</h1>
              <p className="text-xs text-gray-400 mt-0.5">Generate a poster for your counter — students scan it to earn stamps</p>
            </div>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="ml-auto flex items-center gap-2 bg-vendor-600 hover:bg-vendor-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              {printing ? <Loader2 size={15} className="animate-spin"/> : <Printer size={15}/>}
              Print poster
            </button>
          </div>

          <div className="grid lg:grid-cols-[320px,1fr] gap-8">

            {/* ── Controls ── */}
            <div className="space-y-5">
              {/* Size */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-gray-700 mb-3">Paper size</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['a4', 'a5'] as PosterSize[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                        size === s ? 'border-vendor-500 bg-vendor-50 text-vendor-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {s.toUpperCase()}
                      <p className="text-[10px] font-normal opacity-70 mt-0.5">{s === 'a4' ? 'Full poster' : 'Table card'}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-gray-700 mb-3">Colour theme</p>
                <div className="grid grid-cols-2 gap-2">
                  {POSTER_STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStyleId(s.id as StyleId)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${
                        styleId === s.id ? 'border-vendor-500 bg-vendor-50 text-vendor-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-200"
                        style={{ background: s.accent }}
                      />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tagline */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-gray-700 mb-3">Tagline</p>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  maxLength={50}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-vendor-500"
                />
                <p className="text-[10px] text-gray-400 mt-1.5">Shown below the QR code</p>
              </div>

              {/* Tips */}
              <div className="bg-blue-50 rounded-2xl p-5 text-xs text-blue-700 space-y-2">
                <p className="font-bold text-blue-800 mb-2">💡 Placement tips</p>
                <p>• Counter or till area — eye level for students</p>
                <p>• Laminate for durability at food & drink venues</p>
                <p>• A5 card works great as a table tent</p>
                <p>• Re-print if your business name changes</p>
              </div>
            </div>

            {/* ── Poster Preview ── */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-gray-400 font-medium mb-4 uppercase tracking-wide">Preview</p>
              {qrError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700 w-full max-w-sm">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {qrError}
                </div>
              )}

              {/* The actual printable poster */}
              <div id="print-poster" className="w-full max-w-sm">
                <div className={`
                  ${style.bg} ${style.text} rounded-3xl shadow-2xl overflow-hidden
                  ${size === 'a4' ? 'p-10' : 'p-7'}
                  flex flex-col items-center text-center
                  print:rounded-none print:shadow-none print:w-screen print:h-screen print:justify-center
                `}>

                  {/* Logo / initials */}
                  <div className="mb-5">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={businessName}
                        className={`rounded-2xl object-cover mx-auto ${size === 'a4' ? 'w-20 h-20' : 'w-16 h-16'}`}
                      />
                    ) : (
                      <div
                        className={`rounded-2xl flex items-center justify-center font-black mx-auto ${size === 'a4' ? 'w-20 h-20 text-3xl' : 'w-16 h-16 text-2xl'}`}
                        style={{ background: style.accent, color: styleId === 'classic' || styleId === 'warm' ? '#fff' : '#000' }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Business name */}
                  <h1 className={`font-black leading-tight mb-1 ${size === 'a4' ? 'text-3xl' : 'text-2xl'}`}>
                    {businessName}
                  </h1>
                  {city && (
                    <p className={`opacity-60 mb-6 text-sm`}>{city}</p>
                  )}

                  {/* QR Code */}
                  {qrDataUrl && (
                    <div className="bg-white rounded-2xl p-3 shadow-lg mb-5 inline-block">
                      <img
                        src={qrDataUrl}
                        alt="Scan to earn stamps"
                        className={`${size === 'a4' ? 'w-48 h-48' : 'w-36 h-36'}`}
                      />
                    </div>
                  )}

                  {/* Tagline */}
                  <p className={`font-black mb-2 ${size === 'a4' ? 'text-xl' : 'text-lg'}`}>
                    {tagline}
                  </p>

                  {/* Instructions */}
                  <div className={`rounded-2xl px-5 py-4 mb-5 w-full text-sm ${style.sub}`}>
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: style.accent, color: '#fff' }}>1</div>
                      <span className="opacity-80">Open the <strong>StudDeals</strong> app</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: style.accent, color: '#fff' }}>2</div>
                      <span className="opacity-80">Tap <strong>Earn Stamp</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: style.accent, color: '#fff' }}>3</div>
                      <span className="opacity-80">Point your camera at this QR</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-2 opacity-50">
                    <Zap size={13} style={{ color: style.accent }} className="flex-shrink-0"/>
                    <span className="text-xs font-semibold">Powered by StudDeals · studdeals.app</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 mt-4">
                Click <strong>Print poster</strong> to send to your printer
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
