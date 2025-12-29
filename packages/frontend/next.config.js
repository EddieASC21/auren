/** @type {import('next').NextConfig} */
const nextConfig = {
  // --- This is the new block to add ---
  transpilePackages: ['react-colorful'],

  eslint: {
    // This allows production builds to complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // --- End of new block ---

  // --- Your existing settings ---
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/:path*',
      },
    ];
  },
};

module.exports = nextConfig;