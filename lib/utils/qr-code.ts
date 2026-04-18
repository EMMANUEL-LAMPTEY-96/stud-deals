// =============================================================================
// lib/utils/qr-code.ts
// Server-side QR code generation as a base64 PNG data URL.
//
// Uses the 'qrcode' npm package (lightweight, no native deps).
// Install: npm install qrcode && npm install --save-dev @types/qrcode
//
// WHY SERVER-SIDE GENERATION?
//   - The QR code is generated once on claim and stored/returned.
//   - The client just renders an <img> tag — no client-side QR library needed.
//   - Avoids hydration issues and keeps the voucher bundle small.
//   - The data URL can be stored to Supabase Storage if you want persistent URLs.
//
// QR ERROR CORRECTION: Level 'H' (30% redundancy)
//   Rationale: Student phones can be dirty or the screen at an angle.
//   Level H means up to 30% of the QR can be obscured and still scan.
//   The trade-off (larger QR size) is worth it at a physical point of sale.
// =============================================================================

import QRCode from 'qrcode';

export interface QrCodeOptions {
  size?: number;         // px width/height — default 300
  margin?: number;       // quiet zone modules — default 2
  darkColor?: string;    // default '#000000'
  lightColor?: string;   // default '#FFFFFF'
}

/**
 * Generates a QR code as a base64 PNG data URL.
 * Safe to use directly as <img src={dataUrl} />.
 *
 * @param payload   The string to encode (use buildQrPayload() from voucher.ts)
 * @param options   Visual options
 * @returns base64 PNG data URL string
 *
 * @throws if QR generation fails (e.g., payload too long)
 */
export async function generateQrCodeDataUrl(
  payload: string,
  options: QrCodeOptions = {}
): Promise<string> {
  const {
    size = 300,
    margin = 2,
    darkColor = '#000000',
    lightColor = '#FFFFFF',
  } = options;

  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',     // High redundancy — survives a dirty screen
    type: 'image/png',
    width: size,
    margin: margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });

  return dataUrl;
}

/**
 * Generates a branded QR code with the app's colour scheme.
 * Students will see a clean dark-on-white QR inside the voucher modal.
 */
export async function generateStudentVoucherQr(payload: string): Promise<string> {
  return generateQrCodeDataUrl(payload, {
    size: 280,
    margin: 2,
    darkColor: '#1a1a2e',    // Deep navy — matches app brand
    lightColor: '#ffffff',
  });
}

/**
 * Generates a vendor-facing confirmation QR (used on vendor scanner screen
 * when they want to display a test code or print confirmation receipts).
 */
export async function generateVendorConfirmationQr(payload: string): Promise<string> {
  return generateQrCodeDataUrl(payload, {
    size: 200,
    margin: 1,
    darkColor: '#064e3b',    // Dark green — vendor dashboard colour
    lightColor: '#f0fdf4',
  });
}
