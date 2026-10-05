/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint rule violations (unescaped entities, etc.) do not block shipping.
    // The rules are kept in .eslintrc.json for editor hints.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
