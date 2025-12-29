import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // --- This is the critical line to add ---
  output: 'standalone', 
  
  // --- Your existing settings are kept ---
  compiler: {
    emotion: true,
  },
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
    
    // --- This is added from the plan ---
    serverActions: { allowedOrigins: ['*'] }, 
  },
};

export default nextConfig;