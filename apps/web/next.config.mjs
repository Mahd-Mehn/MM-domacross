/** @type {import('next').NextConfig} */
const nextConfig = {
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
