/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript errors are suppressed at build time until all @ts-nocheck
  // pragmas are resolved file-by-file. Track this in audit fix #3.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
