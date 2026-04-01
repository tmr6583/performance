import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { reloadScheduler } from '@/lib/scheduler';

const VALID_REC = new Set(['daily', 'weekly', 'monthly']);

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const row = db.prepare('SELECT hora, dias, recorrencia, dia_mes, ativo FROM schedules WHERE id = 1').get() as
    | { hora: string; dias: string; recorrencia?: string; dia_mes?: number; ativo: number }
    | undefined;

  return NextResponse.json(
    row ?? { hora: '18:00', dias: 'seg,ter,qua,qui,sex', recorrencia: 'weekly', dia_mes: 1, ativo: 0 }
  );
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const body = (await request.json()) as {
    hora?: unknown;
    dias?: unknown;
    recorrencia?: unknown;
    dia_mes?: unknown;
    ativo?: unknown;
  };

  const hora  = typeof body.hora  === 'string' ? body.hora.trim()  : '';
  const dias  = typeof body.dias  === 'string' ? body.dias.trim()  : '';
  const recorrencia = typeof body.recorrencia === 'string' ? body.recorrencia.trim() : 'weekly';
  const diaMes = typeof body.dia_mes === 'number'
    ? body.dia_mes
    : typeof body.dia_mes === 'string'
      ? parseInt(body.dia_mes, 10)
      : 1;
  const ativo = body.ativo ? 1 : 0;

  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) {
    return NextResponse.json({ error: 'Hora inválida (use HH:MM)' }, { status: 400 });
  }
  const [hh, mm] = hora.split(':').map(Number);
  if (hh > 23 || mm > 59) {
    return NextResponse.json({ error: 'Hora inválida (HH deve ser 00–23, MM deve ser 00–59)' }, { status: 400 });
  }

  if (!VALID_REC.has(recorrencia)) {
    return NextResponse.json({ error: 'Recorrência inválida' }, { status: 400 });
  }

  const DIAS_VALIDOS = new Set(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']);
  const diasArr = dias.split(',').map((d: string) => d.trim()).filter(Boolean);
  if (recorrencia === 'weekly') {
    if (diasArr.length === 0) {
      return NextResponse.json({ error: 'Pelo menos um dia deve ser selecionado' }, { status: 400 });
    }
    if (!diasArr.every((d: string) => DIAS_VALIDOS.has(d))) {
      return NextResponse.json({ error: 'Dia inválido. Use: dom, seg, ter, qua, qui, sex, sab' }, { status: 400 });
    }
  }

  if (recorrencia === 'monthly') {
    if (!Number.isFinite(diaMes) || diaMes < 1 || diaMes > 31) {
      return NextResponse.json({ error: 'Dia do mês inválido (use 1–31)' }, { status: 400 });
    }
  }

  ensureDbInitialized();

  db.prepare(
    'UPDATE schedules SET hora = ?, dias = ?, recorrencia = ?, dia_mes = ?, ativo = ?, modificado = CURRENT_TIMESTAMP WHERE id = 1'
  ).run(hora, dias, recorrencia, diaMes, ativo);

  reloadScheduler();

  return NextResponse.json({ success: true });
}
