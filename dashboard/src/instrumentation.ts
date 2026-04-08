/**
 * Next.js Instrumentation Hook — inicializa o scheduler ao subir o servidor.
 * Executado apenas no processo Node.js (não no Edge runtime).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const maxConnections = Number(process.env.APP_HTTP_MAX_CONNECTIONS ?? '8');
    const maxSockets = Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : 8;
    const { globalAgent: httpGlobalAgent } = await import('node:http');
    const { globalAgent: httpsGlobalAgent } = await import('node:https');
    httpGlobalAgent.maxSockets = maxSockets;
    httpsGlobalAgent.maxSockets = maxSockets;

    const gcIntervalMs = Number(process.env.APP_GC_INTERVAL_MS ?? '120000');
    if (
      typeof global.gc === 'function' &&
      Number.isFinite(gcIntervalMs) &&
      gcIntervalMs > 0
    ) {
      setInterval(() => {
        try {
          global.gc?.();
        } catch {}
      }, gcIntervalMs).unref();
    }

    const autoRefreshHours = 12;
    const autoRefreshIntervalMs = autoRefreshHours * 60 * 60 * 1000;
    const { autoRefreshIfDue } = await import('./lib/olist-tokens');
    void autoRefreshIfDue();
    setInterval(() => {
      void autoRefreshIfDue();
    }, autoRefreshIntervalMs).unref();

    const { reloadScheduler } = await import('./lib/scheduler');
    reloadScheduler();
  }
}
