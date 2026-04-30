'use client';

// =============================================================================
// components/vendor/VendorQRPanel.tsx
//
// Displays the vendor's unique loyalty QR code for students to scan.
// The QR encodes a JSON payload: { type: "stud_stamp", vendor_id: "<uuid>", name: "<business>" }
//
// Shown prominently on the vendor dashboard. Can be printed or downloaded.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, QrCode, CheckCircle, Store } from 'lucide-react';

interface VendorQRPanelProps {
  vendorId: string;
  businessName: string;
  city?: string;
}

export default function VendorQRPanel({ vendorId, businessName, city }: VendorQRPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // QR payload — vendor_id is all the student scanner needs
  const qrPayload = JSON.stringify({
    type: 'stud_stamp',
    vendor_id: vendorId,
    name: businessName,
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrPayload, {
      width: 240,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });

    // Also generate data URL for download
    QRCode.toDataURL(qrPayload, {
      width: 600,
      margin: 3,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    }).then(setDataUrl);
  }, [qrPayload]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${businessName.replace(/\s+/g, '-').toLowerCase()}-loyalty-qr.png`;
    a.click();
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${businessName} — Loyalty QR Code</title>
          <style>
            body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; background: white; }
            .container { text-align: center; padding: 40px; }
            img { width: 320px; height: 320px; display: block; margin: 0 auto 20px; }
            h1 { font-size: 24px; font-weight: 900; color: #1a1a2e; margin: 0 0 8px; }
            p { font-size: 14px; color: #666; margin: 4px 0; }
            .cta { margin-top: 16px; font-size: 18px; font-weight: 700; color: #7C3AED; }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="${dataUrl}" alt="QR Code" />
            <h1>${businessName}</h1>
            <p>${city ?? ''}</p>
            <p class="cta">Scan to earn your loyalty stamp!</p>
            <p style="font-size:12px;color:#999;margin-top:12px">Open the Stud Deals app and tap "Earn Stamp"</p>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <QrCode size={16} className="text-vendor-600" />
        <h2 className="font-bold text-gray-900 text-sm">Your Loyalty QR Code</h2>
      </div>

      {/* QR code */}
      <div className="flex flex-col items-center">
        <div className="bg-white p-3 rounded-2xl border-2 border-gray-100 shadow-inner mb-3">
          <canvas ref={canvasRef} className="block rounded-lg" />
        </div>

        <p className="text-xs text-center text-gray-500 mb-1 font-semibold">{businessName}</p>
        {city && <p className="text-xs text-center text-gray-400 mb-4">{city}</p>}

        {/* Instructions */}
        <div className="w-full bg-vendor-50 rounded-xl p-3 mb-4 text-center">
          <p className="text-xs font-bold text-vendor-800 mb-1">Display this at your counter</p>
          <p className="text-xs text-vendor-600">Students open the Stud Deals app → tap <strong>Earn Stamp</strong> → scan this code</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} /> Download
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer size={13} /> Print
          </button>
        </div>

        {/* Trust indicator */}
        <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
          <CheckCircle size={11} className="text-green-500" />
          <span>Each student can stamp once every 8 hours</span>
        </div>
      </div>
    </div>
  );
}
