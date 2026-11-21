
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

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
    ],
  },

  async rewrites() {
    const backendURL =
      process.env.BACKEND_INTERNAL_URL ||
      'http://localhost:8000';

    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendURL}/api/v1/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${backendURL}/media/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
