/** @type {import('next').NextConfig} */
const nextConfig = {
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
