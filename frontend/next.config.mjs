/** @type {import('next').NextConfig} */
const BACKEND = process.env.BACKEND_URL || 'http://localhost:8080';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${BACKEND}/api/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
