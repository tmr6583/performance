import cluster from 'node:cluster';
import http from 'node:http';
import os from 'node:os';
import process from 'node:process';
import { parse } from 'node:url';
import next from 'next';

const PORT = 3100;
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';
const isDev = NODE_ENV !== 'production';
const verboseLogs = process.env.APP_VERBOSE_LOGS === '1';

function parseIntSafe(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function computeWorkers() {
  const explicit = parseIntSafe(process.env.APP_WORKERS, 0);
  if (explicit > 0) return explicit;
  const cpuCount = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const memoryBased = Math.max(1, Math.floor(os.totalmem() / (512 * 1024 * 1024)));
  return Math.max(1, Math.min(cpuCount, memoryBased));
}

function startGcTicker() {
  if (typeof global.gc !== 'function') return;
  const gcIntervalMs = parseIntSafe(process.env.APP_GC_INTERVAL_MS, 120000);
  if (gcIntervalMs <= 0) return;
  setInterval(() => {
    try {
      global.gc();
    } catch {}
  }, gcIntervalMs).unref();
}

function setupCluster() {
  const enableCluster = process.env.APP_ENABLE_CLUSTER !== '0' && !isDev;
  const workers = computeWorkers();

  if (!enableCluster || workers <= 1 || !cluster.isPrimary) return false;

  for (let i = 0; i < workers; i += 1) {
    cluster.fork();
  }

  cluster.on('exit', () => {
    cluster.fork();
  });

  return true;
}

async function startServer() {
  const app = next({
    dev: isDev,
    hostname: HOSTNAME,
    port: PORT,
  });

  await app.prepare();
  const handle = app.getRequestHandler();

  const maxPayloadMb = parseIntSafe(process.env.APP_MAX_PAYLOAD_MB, 1);
  const maxPayloadBytes = maxPayloadMb * 1024 * 1024;
  const reqTimeoutMs = parseIntSafe(process.env.APP_REQUEST_TIMEOUT_MS, 30000);
  const keepAliveTimeoutMs = parseIntSafe(process.env.APP_KEEP_ALIVE_TIMEOUT_MS, 5000);

  const server = http.createServer((req, res) => {
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > maxPayloadBytes) {
      res.statusCode = 413;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Payload muito grande' }));
      return;
    }

    if (req.url && (req.url.includes('/_next/static/') || req.url.includes('/favicon.ico'))) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    req.setTimeout(reqTimeoutMs, () => {
      if (!res.headersSent) {
        res.statusCode = 408;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Timeout de requisição' }));
      }
      req.destroy();
    });

    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  server.requestTimeout = reqTimeoutMs;
  server.keepAliveTimeout = keepAliveTimeoutMs;
  server.headersTimeout = Math.max(reqTimeoutMs + 1000, 60000);

  server.listen(PORT, HOSTNAME, () => {
    if (isDev || verboseLogs) {
      console.log(`server listening on ${HOSTNAME}:${PORT} (${NODE_ENV})`);
    }
  });
}

if (!setupCluster()) {
  startGcTicker();
  startServer();
}
