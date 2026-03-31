/**
 * Módulo de acesso ao banco de dados SQLite — projeto Performance.
 *
 * Schema:
 *   users              — usuários do dashboard (admins + vendedoras com login)
 *   vendedores         — vendedoras do Olist com e-mail e toggle
 *   performance_cache  — dados de desempenho por vendedora por dia
 *   email_logs         — histórico de envios
 *   schedules          — configuração de agendamento
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(process.cwd(), '..', 'database.db');

const db = new DatabaseSync(dbPath);

let initialized = false;

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function initDb(): void {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  // ── Usuários do dashboard ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      email            TEXT    UNIQUE NOT NULL,
      password         TEXT    NOT NULL,
      role             TEXT    CHECK(role IN ('admin','salesperson')) NOT NULL,
      recebe_relatorio INTEGER NOT NULL DEFAULT 0,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migração: adiciona recebe_relatorio se vier de schema antigo
  try {
    db.exec('ALTER TABLE users ADD COLUMN recebe_relatorio INTEGER NOT NULL DEFAULT 0');
  } catch { /* coluna já existe */ }

  // ── Vendedoras do Olist ───────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendedores (
      id_olist     INTEGER PRIMARY KEY,
      nome         TEXT    NOT NULL,
      email        TEXT,
      recebe_email INTEGER NOT NULL DEFAULT 0,
      updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Cache de performance ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS performance_cache (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      data             TEXT    NOT NULL,
      id_vendedor      INTEGER NOT NULL,
      nome_vendedor    TEXT    NOT NULL,
      pedidos_dia      INTEGER NOT NULL DEFAULT 0,
      valor_dia        REAL    NOT NULL DEFAULT 0,
      ticket_medio_dia REAL    NOT NULL DEFAULT 0,
      pedidos_mes      INTEGER NOT NULL DEFAULT 0,
      valor_mes        REAL    NOT NULL DEFAULT 0,
      ticket_medio_mes REAL    NOT NULL DEFAULT 0,
      atualizado_em    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(data, id_vendedor)
    )
  `);

  // ── Log de e-mails enviados ───────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      enviado_em   DATETIME DEFAULT CURRENT_TIMESTAMP,
      execucao_id  TEXT     NOT NULL,
      tipo         TEXT     NOT NULL CHECK(tipo IN ('vendedora','admin')),
      destinatario TEXT     NOT NULL,
      nome         TEXT,
      status       TEXT     NOT NULL CHECK(status IN ('ok','erro')),
      mensagem     TEXT
    )
  `);

  // ── Configuração de agendamento ───────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      hora       TEXT    NOT NULL DEFAULT '18:00',
      dias       TEXT    NOT NULL DEFAULT 'seg,ter,qua,qui,sex',
      ativo      INTEGER NOT NULL DEFAULT 0,
      modificado DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Garante que existe a linha de schedule (id = 1)
  db.exec(`
    INSERT OR IGNORE INTO schedules (id, hora, dias, ativo)
    VALUES (1, '18:00', 'seg,ter,qua,qui,sex', 0)
  `);

  // ── Admin padrão ──────────────────────────────────────────────────────
  const adminExists = db
    .prepare("SELECT count(*) as count FROM users WHERE role = 'admin'")
    .get() as { count: number };

  if (adminExists.count === 0) {
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);

    db.prepare(
      'INSERT INTO users (name, email, password, role, recebe_relatorio) VALUES (?, ?, ?, ?, ?)'
    ).run('Administrador', 'admin@empresa.com', hashedPassword, 'admin', 1);

    if (process.env.NODE_ENV !== 'test') {
      console.log('\n========================================================');
      console.log('  ADMIN CRIADO: admin@empresa.com');
      console.log(`  SENHA TEMPORÁRIA: ${tempPassword}`);
      console.log('  Altere a senha imediatamente após o primeiro login.');
      console.log('========================================================\n');
    }
  }
}

export function ensureDbInitialized(): void {
  if (initialized) return;

  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      initDb();
      initialized = true;
      return;
    } catch (err: unknown) {
      const error = err as { errcode?: number; errstr?: string; code?: string; message?: string };
      const isLocked =
        error?.errcode === 5 ||
        error?.errstr === 'database is locked' ||
        error?.message === 'database is locked' ||
        error?.code === 'ERR_SQLITE_ERROR';

      if (!isLocked || attempt === maxAttempts) throw err;
      sleepSync(50 * attempt);
    }
  }
}

export default db;
