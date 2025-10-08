/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Suppress hydration warnings in development (caused by browser extensions)
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};
export default nextConfig;
