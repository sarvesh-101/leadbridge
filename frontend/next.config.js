/** @type {import('next').NextConfig} */
// localhost/ws://localhost CSP entries are dev-only conveniences — they must
// not ship to production (they'd let any local process call the API from a
// user's browser).
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'converza.tech' },
      { protocol: 'https', hostname: 'api.converza.tech' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
              "font-src 'self' https://fonts.gstatic.com https://api.fontshare.com",
              "img-src 'self' data: blob: https: http:",
              // Pinned to the exact API origin (was: *.railway.app/*.vercel.app/*.onrender.com
              // wildcards — over-broad). Update BOTH origins here when the API domain changes
              // (https for fetch/XHR + wss for the WebSocket). See docs/REBRAND-URL-SWITCH.md.
              "connect-src 'self' https://leadbridge-zy4o.onrender.com wss://leadbridge-zy4o.onrender.com https://api.deepseek.com https://accounts.google.com" + (isProd ? "" : " http://localhost ws://localhost"),
              "frame-src 'self' https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
