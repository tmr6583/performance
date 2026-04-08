import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  output: 'standalone',
  compress: true,
  httpAgentOptions: {
    keepAlive: true,
  },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
