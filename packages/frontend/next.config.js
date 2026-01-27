/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'standalone',

  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
    optimizePackageImports: ['framer-motion', 'react-colorful'],
    webpackBuildWorker: false,
    outputFileTracingRoot: path.join(__dirname, '../..'),
  },

  // Improve code splitting for better TBT
  webpack: (config, { isServer, dev }) => {
    if (!isServer && !dev) {
      // Exclude server-only packages from client bundle
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'firebase-admin',
        'firebase-admin/app',
        'firebase-admin/firestore',
        'nodemailer',
        '@google-cloud/storage',
        '@workos-inc/node',
        'google-auth-library',
      ];

      // Aggressive minification for production
      config.optimization.minimize = true;
      config.optimization.minimizer = [
        ...config.optimization.minimizer,
      ];

      // Split large chunks to reduce TBT
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // Heavy libraries in separate chunks
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
              return `npm.${packageName?.replace('@', '')}`;
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
          shared: {
            name(_module, chunks) {
              return `shared.${chunks.map((c) => c.name).join('.')}`;
            },
            priority: 10,
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
        maxInitialRequests: 25,
        minSize: 20000,
      };
    }
    return config;
  },

  // Reduce JavaScript payload
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Optimize production builds
  swcMinify: true,
  reactStrictMode: true,

  // Modern JavaScript output for smaller bundles
  modularizeImports: {
    'lodash': {
      transform: 'lodash/{{member}}',
    },
    'react-colorful': {
      transform: 'react-colorful/dist/{{member}}',
    },
  },
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'auren-image-cdn-707676310655.us-central1.run.app',
      },
    ],
  },
  compress: true,

  async headers() {
    return [
      {
        source: '/',
        headers: [
          // Security headers
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 🔥 Firefox fix: Use strict-origin-when-cross-origin to silence warnings
          // This prevents full URL leakage cross-origin while still sending origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Performance hints for landing page
          { key: 'Link', value: '<https://storage.googleapis.com>; rel=preconnect' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          // Security headers for all other pages
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 🔥 Firefox fix: Use strict-origin-when-cross-origin to silence warnings
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/:path*.(jpg|jpeg|png|gif|webp|avif|svg)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*.(js|css|woff|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/mens/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/womens/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/other/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/info-deck',
        destination: 'https://storage.googleapis.com/auren-public-asset/Auren%20Info%20Deck%20.pdf',
      },
    ];
  },
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
