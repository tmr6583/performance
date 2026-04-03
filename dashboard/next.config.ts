import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  output: 'standalone', // Gera um build otimizado para economizar memória e CPU
};

export default nextConfig;
