import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { reloadScheduler } from '@/lib/scheduler';

const VALID_REC = new Set(['daily', 'weekly', 'monthly']);
const DIAS_VALIDOS = new Set(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']);

type SchedulePayload = {
  id?: unknown;
  hora?: unknown;
  dias?: unknown;
  recorrencia?: unknown;
  dia_mes?: unknown;
  ultimo_dia_mes?: unknown;
  ativo?: unknown;
};

type NormalizedSchedule = {
  id?: number;
  hora: string;
  dias: string;
  recorrencia: 'daily' | 'weekly' | 'monthly';
  dia_mes: number;
  ultimo_dia_mes: number;
  ativo: number;
};

function normalizeSchedule(raw: SchedulePayload): NormalizedSchedule | { error: string } {
  const id = typeof raw.id === 'number' && Number.isInteger(raw.id) && raw.id > 0 ? raw.id : undefined;
  const hora = typeof raw.hora === 'string' ? raw.hora.trim() : '';
  const dias = typeof raw.dias === 'string' ? raw.dias.trim() : '';
  const recorrenciaRaw = typeof raw.recorrencia === 'string' ? raw.recorrencia.trim() : 'weekly';
  const recorrencia = VALID_REC.has(recorrenciaRaw)
    ? (recorrenciaRaw as 'daily' | 'weekly' | 'monthly')
    : null;
  const diaMes = typeof raw.dia_mes === 'number'
    ? raw.dia_mes
    : typeof raw.dia_mes === 'string'
      ? parseInt(raw.dia_mes, 10)
      : 1;
  const ultimoDiaMes = raw.ultimo_dia_mes ? 1 : 0;
  const ativo = raw.ativo ? 1 : 0;

  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) {
    return { error: 'Hora inválida (use HH:MM)' };
  }
  const [hh, mm] = hora.split(':').map(Number);
  if (hh > 23 || mm > 59) {
    return { error: 'Hora inválida (HH deve ser 00–23, MM deve ser 00–59)' };
  }

  if (!recorrencia) {
    return { error: 'Recorrência inválida' };
  }

  const diasArr = dias.split(',').map((d: string) => d.trim()).filter(Boolean);
  if (recorrencia === 'weekly') {
    if (diasArr.length === 0) {
      return { error: 'Pelo menos um dia deve ser selecionado' };
    }
    if (!diasArr.every((d: string) => DIAS_VALIDOS.has(d))) {
      return { error: 'Dia inválido. Use: dom, seg, ter, qua, qui, sex, sab' };
    }
  }

  if (recorrencia === 'monthly' && !ultimoDiaMes) {
    if (!Number.isFinite(diaMes) || diaMes < 1 || diaMes > 31) {
      return { error: 'Dia do mês inválido (use 1–31)' };
    }
  }

  return {
    id,
    hora,
    dias,
    recorrencia,
    dia_mes: Number.isFinite(diaMes) ? diaMes : 1,
    ultimo_dia_mes: ultimoDiaMes,
    ativo,
  };
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

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

  const serverTime = new Date().toLocaleString('pt-BR', { timeZone: process.env.TZ || 'America/Sao_Paulo' });
  const schedules = rows.map((row) => ({
    id: row.id,
    hora: row.hora,
    dias: row.dias,
    recorrencia: row.recorrencia ?? 'weekly',
    dia_mes: row.dia_mes ?? 1,
    ultimo_dia_mes: row.ultimo_dia_mes ? 1 : 0,
    ativo: row.ativo ? 1 : 0,
  }));
  const fallback = { id: 1, hora: '18:00', dias: 'seg,ter,qua,qui,sex', recorrencia: 'weekly', dia_mes: 1, ultimo_dia_mes: 0, ativo: 0 };
  const first = schedules[0] ?? fallback;

  return NextResponse.json(
    {
      ...first,
      schedules: schedules.length > 0 ? schedules : [fallback],
      server_time: serverTime,
    }
  );
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const body = (await request.json()) as { schedules?: unknown } & SchedulePayload;
  const rawSchedules = Array.isArray(body.schedules) ? body.schedules : [body];
  if (rawSchedules.length === 0) {
    return NextResponse.json({ error: 'Informe ao menos um agendamento' }, { status: 400 });
  }

  const normalized: NormalizedSchedule[] = [];
  for (const raw of rawSchedules) {
    const parsed = normalizeSchedule((raw ?? {}) as SchedulePayload);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    normalized.push(parsed);
  }

  ensureDbInitialized();

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM schedules');
    const stmt = db.prepare(`
      INSERT INTO schedules (id, hora, dias, recorrencia, dia_mes, ultimo_dia_mes, ativo, modificado)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    for (const item of normalized) {
      stmt.run(
        item.id ?? null,
        item.hora,
        item.dias,
        item.recorrencia,
        item.dia_mes,
        item.ultimo_dia_mes,
        item.ativo
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return NextResponse.json({ error: `Falha ao salvar agendamentos: ${(error as Error).message}` }, { status: 500 });
  }

  reloadScheduler();

  return NextResponse.json({ success: true });
}
