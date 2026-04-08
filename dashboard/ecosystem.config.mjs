import os from 'node:os';

const cpuCount = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
const workers = Math.max(1, cpuCount);

export default {
  apps: [
    {
      name: 'performance-dashboard',
      script: './server.mjs',
      instances: workers,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '256M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        APP_ENABLE_CLUSTER: '0',
        APP_VERBOSE_LOGS: '0',
        APP_WORKERS: '1',
        APP_REQUEST_TIMEOUT_MS: '30000',
        APP_KEEP_ALIVE_TIMEOUT_MS: '5000',
        APP_MAX_PAYLOAD_MB: '1',
        APP_GC_INTERVAL_MS: '120000',
        APP_HTTP_MAX_CONNECTIONS: '8',
        PORT: '3100',
        NODE_OPTIONS: '--max-old-space-size=192 --expose-gc',
      },
    },
  ],
};
