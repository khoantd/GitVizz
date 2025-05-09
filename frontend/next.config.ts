import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Enable TypeScript module resolution
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Configure webpack for Monaco Editor
  webpack: (config) => {
    // Add rule for Monaco Editor's CSS
    config.module.rules.push({
      test: /\.ttf$/,
      type: 'asset/resource',
    });

    return config;
  },
  // Disable static exports for dynamic imports
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8003/api/:path*', // Proxy to backend
      },
      {
        source: '/static/:path*',
        destination: 'http://localhost:8003/static/:path*', // Proxy to backend static files
      },
    ];
  },
};

export default nextConfig;
