/**
 * unified-server.mjs
 *
 * Proxy leve que gerencia dois subprocessos Next.js e roteia por prefixo de path.
 *   /atrasados/* → porta 3101  (atrasados dashboard)
 *   /performance/* → porta 3102 (performance dashboard)
 *
 * Cada app roda com seu próprio basePath, então recebe a URL completa sem stripping.
 */

import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 3100)

const APPS = [
  {
    name: 'atrasados',
    dir: '/opt/betina/atrasados/dashboard',
    port: 3101,
    mount: '/atrasados',
    basePath: '/atrasados',
    envFile: '/opt/betina/atrasados/env/atrasados.env',
  },
  {
    name: 'performance',
    dir: '/opt/betina/performance/dashboard',
    port: 3102,
    mount: '/performance',
    basePath: '/performance',
    envFile: null, // carregado pelo systemd via EnvironmentFile
  },
]

// ── Lê env file simples ──────────────────────────────────────────────────────

function loadEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => {
          const idx = l.indexOf('=')
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
        })
    )
  } catch {
    return {}
  }
}

// ── Aguarda uma porta TCP abrir ──────────────────────────────────────────────

function waitForPort(port, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    function attempt() {
      const sock = net.createConnection(port, '127.0.0.1')
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() > deadline) return reject(new Error(`port ${port} not ready after ${timeout}ms`))
        setTimeout(attempt, 500)
      })
    }
    attempt()
  })
}

// ── Proxy de uma requisição para porta alvo ──────────────────────────────────
// Cada app foi compilado com seu próprio basePath (/atrasados ou /performance),
// então a URL completa é repassada sem modificação.

function proxyRequest(req, res, targetPort, mountPrefix) {
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers },
  }

  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res, { end: true })
  })

  proxyReq.on('error', () => {
    if (!res.headersSent) { res.writeHead(502); res.end('Bad Gateway') }
  })

  req.pipe(proxyReq, { end: true })
}

// ── Spawn e auto-restart de um app Next.js ───────────────────────────────────

function spawnApp(app) {
  const env = {
    ...process.env,
    ...(app.envFile ? loadEnvFile(app.envFile) : {}),
    PORT: String(app.port),
    HOST: '127.0.0.1',
    NEXT_PUBLIC_BASE_PATH: app.basePath,
    NEXT_PUBLIC_ASSET_PREFIX: app.basePath,
  }

  const child = spawn(
    'node_modules/.bin/next',
    ['start', '-H', '127.0.0.1', '-p', String(app.port)],
    { cwd: app.dir, env, stdio: ['ignore', 'pipe', 'pipe'] }
  )

  child.stdout.on('data', d => process.stdout.write(`[${app.name}] ${d}`))
  child.stderr.on('data', d => process.stderr.write(`[${app.name}] ${d}`))
  child.on('exit', (code, signal) => {
    process.stderr.write(`[${app.name}] exited (${code ?? signal}) — reiniciando em 3s\n`)
    setTimeout(() => spawnApp(app), 3000)
  })

  return child
}

// ── Main ─────────────────────────────────────────────────────────────────────

const children = APPS.map(spawnApp)

process.on('SIGTERM', () => { children.forEach(c => c.kill('SIGTERM')); process.exit(0) })
process.on('SIGINT',  () => { children.forEach(c => c.kill('SIGTERM')); process.exit(0) })

process.stdout.write('aguardando subprocessos Next.js...\n')

Promise.all(APPS.map(app => waitForPort(app.port))).then(() => {
  process.stdout.write('subprocessos prontos\n')

  const server = http.createServer((req, res) => {
    const pathname = req.url.split('?')[0]

    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, apps: APPS.map(a => a.name) }))
      return
    }

    if (pathname === '/') {
      res.writeHead(302, { Location: '/atrasados' })
      res.end()
      return
    }

    for (const app of APPS) {
      if (pathname === app.mount || pathname.startsWith(app.mount + '/')) {
        proxyRequest(req, res, app.port, app.mount)
        return
      }
    }

    res.writeHead(404)
    res.end('Not Found')
  })

  server.listen(PORT, HOST, () => {
    process.stdout.write(`unified proxy on http://${HOST}:${PORT}\n`)
  })
}).catch(err => {
  process.stderr.write(`startup error: ${err}\n`)
  process.exit(1)
})
