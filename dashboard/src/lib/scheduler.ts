/**
 * Scheduler via node-cron.
 *
 * Lê a configuração de agendamento do SQLite e programa o job.
 * Chamado na inicialização do servidor e após cada alteração de schedule.
 */

import cron from 'node-cron';
import db, { ensureDbInitialized } from './db';

let currentTask: cron.ScheduledTask | null = null;

const DIA_MAP: Record<string, number> = {
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6,
};

function buildCronExpr(hora: string, dias: string): string {
  const [hh, mm] = hora.split(':');
  const nums = dias
    .split(',')
    .map(d => DIA_MAP[d.trim()])
    .filter(n => n !== undefined);

  return `${mm} ${hh} * * ${nums.join(',')}`;
}

async function triggerSend(): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH
      ? `http://127.0.0.1:${process.env.PORT ?? 3200}${process.env.NEXT_PUBLIC_BASE_PATH}`
      : `http://127.0.0.1:${process.env.PORT ?? 3200}`;

    await fetch(`${baseUrl}/api/scripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal': '1' },
      body: JSON.stringify({ acao: 'fetch_and_send' }),
    });
  } catch (e) {
    console.error('[scheduler] Erro ao disparar fetch_and_send:', e);
  }
}

export function reloadScheduler(): void {
  // Para job anterior
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  try {
    ensureDbInitialized();
    const row = db.prepare('SELECT hora, dias, ativo FROM schedules WHERE id = 1').get() as
      | { hora: string; dias: string; ativo: number }
      | undefined;

    if (!row || !row.ativo) {
      console.log('[scheduler] Agendamento desativado.');
      return;
    }

    const expr = buildCronExpr(row.hora, row.dias);

    if (!cron.validate(expr)) {
      console.error(`[scheduler] Expressão cron inválida: ${expr}`);
      return;
    }

    currentTask = cron.schedule(expr, () => {
      console.log(`[scheduler] Disparando fetch_and_send — ${new Date().toISOString()}`);
      triggerSend();
    });

    console.log(`[scheduler] Job agendado: ${expr} (${row.hora} em ${row.dias})`);
  } catch (e) {
    console.error('[scheduler] Erro ao carregar schedule:', e);
  }
}

// Middleware interno: permite que /api/scripts seja chamado pelo scheduler
// sem cookie de autenticação
export function isInternalRequest(request: Request): boolean {
  return request.headers.get('x-internal') === '1';
}
