/** @type {import('next').NextConfig} */

const nextConfig = {
  basePath: '/user',
  output: 'standalone',

  skipTrailingSlashRedirect: true,

  optimizeFonts: false,

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
      },
      {
        protocol: 'http',
        hostname: 'backend',
        port: '8000',
      },
    ],
  },

  async rewrites() {
    const backendURL =
      process.env.BACKEND_INTERNAL_URL ||
      'http://backend:8000';

    return [
      {
        source: '/media/:path*',
        destination: `${backendURL}/media/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;







