// Browser security headers on every response.
// - CSP here only covers framing, plugins, <base> and form targets, so it can't
//   break Next.js inline scripts, PostHog, Supabase or Stripe redirects.
// - camera: the QR scanners; geolocation: "near me" sorting. Both own-site only.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework: drops the `X-Powered-By: Next.js` response header.
  // (`server: Vercel` is set by Vercel's network and can't be removed from the app.)
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  eslint: {
    // ESLint rule violations (unescaped entities, etc.) do not block shipping.
    // The rules are kept in .eslintrc.json for editor hints.
    ignoreDuringBuilds: true,
  },
  images: {
    // Local paths (e.g. the demo logo at /demo/demo-cafe-logo.svg) need no
    // config; local SVGs are served unoptimized automatically. Uploaded vendor
    // logos and offer images come from Supabase Storage.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
};

export default nextConfig;
