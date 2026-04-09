import type { NextConfig } from 'next';

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
const normalizedConfiguredBasePath =
  configuredBasePath && configuredBasePath !== '/'
    ? (configuredBasePath.startsWith('/') ? configuredBasePath : `/${configuredBasePath}`)
    : undefined;
const basePath =
  normalizedConfiguredBasePath ?? (process.env.NODE_ENV === 'production' ? '/performance' : undefined);

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
