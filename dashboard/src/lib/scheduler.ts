/**
 * Scheduler via node-cron.
 *
 * Lê a configuração de agendamento do SQLite e programa o job.
 * Chamado na inicialização do servidor e após cada alteração de schedule.
 */

import cron from 'node-cron';
import db, { ensureDbInitialized } from './db';

let currentTasks: cron.ScheduledTask[] = [];
const shouldLogInfo = process.env.NODE_ENV !== 'production' || process.env.APP_VERBOSE_LOGS === '1';

function logInfo(message: string): void {
  if (shouldLogInfo) console.log(message);
}

const DIA_MAP: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6,
};

function buildWeeklyCronExpr(hora: string, dias: string): string {
  const [hh, mm] = hora.split(':');
  const nums = dias
    .split(',')
    .map(d => DIA_MAP[d.trim()])
    .filter(n => n !== undefined);

  return `${mm} ${hh} * * ${nums.join(',')}`;
}

function buildDailyCronExpr(hora: string): string {
  const [hh, mm] = hora.split(':');
  return `${mm} ${hh} * * *`;
}

function datePartsInTimeZone(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find(p => p.type === 'year')?.value ?? '0');
  const month = Number(parts.find(p => p.type === 'month')?.value ?? '0');
  const day = Number(parts.find(p => p.type === 'day')?.value ?? '0');
  return { year, month, day };
}

function shouldRunMonthly(targetDay: number, lastDayOnly: boolean, timeZone: string): boolean {
  const { year, month, day } = datePartsInTimeZone(new Date(), timeZone);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (lastDayOnly) return day === lastDay;
  const runDay = Math.min(Math.max(targetDay, 1), lastDay);
  return day === runDay;
}

async function triggerSend(): Promise<void> {
  try {
    const port    = process.env.PORT ?? 3100;
    const base    = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const baseUrl = `http://127.0.0.1:${port}${base}`;
    const secret  = process.env.INTERNAL_SECRET ?? '';
    const timeoutMs = Number(process.env.APP_INTERNAL_FETCH_TIMEOUT_MS ?? '15000');

    const res = await fetch(`${baseUrl}/api/scripts`, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({ acao: 'fetch_and_send' }),
      signal: AbortSignal.timeout(
        Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000
      ),
    });

    if (!res.ok) {
      console.error(`[scheduler] fetch_and_send retornou HTTP ${res.status}`);
    }
  } catch (e) {
    console.error('[scheduler] Erro ao disparar fetch_and_send:', e);
  }
}

export function reloadScheduler(): void {
  for (const task of currentTasks) task.stop();
  currentTasks = [];

  try {
    ensureDbInitialized();
    const rows = db.prepare(`
      SELECT id, hora, dias, recorrencia, dia_mes, ultimo_dia_mes, ativo
      FROM schedules
      ORDER BY id ASC
    `).all() as Array<{
      id: number;
      hora: string;
      dias: string;
      recorrencia?: string;
      dia_mes?: number;
      ultimo_dia_mes?: number;
      ativo: number;
    }>;

    const activeRows = rows.filter((row) => row.ativo);
    if (activeRows.length === 0) {
      logInfo('[scheduler] Agendamento desativado.');
      return;
    }

    const timeZone = process.env.TZ ?? 'America/Sao_Paulo';
    for (const row of activeRows) {
      const recorrencia = row.recorrencia ?? 'weekly';
      const diaMes = row.dia_mes ?? 1;
      const ultimoDiaMes = row.ultimo_dia_mes ? 1 : 0;

      const expr = recorrencia === 'weekly'
        ? buildWeeklyCronExpr(row.hora, row.dias)
        : buildDailyCronExpr(row.hora);

      if (!cron.validate(expr)) {
        console.error(`[scheduler] Expressão cron inválida (schedule ${row.id}): ${expr}`);
        continue;
      }

      const task = cron.schedule(expr, () => {
        if (recorrencia === 'monthly') {
          if (!shouldRunMonthly(diaMes, Boolean(ultimoDiaMes), timeZone)) return;
        }
        logInfo(`[scheduler] Disparando fetch_and_send (schedule ${row.id}) — ${new Date().toISOString()}`);
        triggerSend();
      }, { timezone: timeZone });
      currentTasks.push(task);

      const details = recorrencia === 'weekly'
        ? `${row.hora} em ${row.dias}`
        : recorrencia === 'monthly'
          ? `${row.hora} ${ultimoDiaMes ? 'no último dia do mês' : `no dia ${diaMes} do mês`}`
          : `${row.hora} todos os dias`;
      logInfo(`[scheduler] Job ${row.id} agendado: ${expr} (${details})`);
    }
  } catch (e) {
    console.error('[scheduler] Erro ao carregar schedule:', e);
  }
}

// Verifica se a requisição é interna do scheduler (via segredo compartilhado)
export function isInternalRequest(request: Request): boolean {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return false;
  return request.headers.get('x-internal-secret') === secret;
}
