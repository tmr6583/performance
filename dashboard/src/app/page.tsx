import { getAuthUser } from '@/lib/auth';
import db, { ensureDbInitialized } from '@/lib/db';
import { resolveBasePath } from '@/lib/base-path';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function HomePage() {
  const user = await getAuthUser();
  const basePath = resolveBasePath();
  
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/login');

  ensureDbInitialized();

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  type CacheRow = {
    id_vendedor: number;
    nome_vendedor: string;
    pedidos_dia: number;
    valor_dia: number;
    ticket_medio_dia: number;
    pedidos_mes: number;
    valor_mes: number;
    ticket_medio_mes: number;
    clientes_atendidos_mes: number;
    clientes_vendas_mes: number;
    faturamento_mes: number;
    meta_mensal: number;
  };
  type UpdateEventRow = {
    quando: string;
    registros: number;
  };

  let cacheRows: CacheRow[] = [];

  const dbRows = db
    .prepare(`
      SELECT 
        pc.*, 
        COALESCE(m.meta_mensal, 0) as meta_mensal 
      FROM performance_cache pc
      LEFT JOIN metas_vendedores m ON pc.id_vendedor = m.id_olist
      WHERE pc.data = ? 
      ORDER BY pc.faturamento_mes DESC
    `)
    .all(hoje) as CacheRow[];

  cacheRows = dbRows.map(row => ({ ...row }));

  const lastUpdateRow = db
    .prepare(`
      SELECT datetime(MAX(atualizado_em), 'localtime') AS ultima_atualizacao
      FROM performance_cache
    `)
    .get() as { ultima_atualizacao: string | null };

  const rawUpdateEvents = db
    .prepare(`
      SELECT datetime(atualizado_em, 'localtime') AS quando, COUNT(*) AS registros
      FROM performance_cache
      WHERE data = ?
      GROUP BY atualizado_em
      ORDER BY atualizado_em DESC
      LIMIT 5
    `)
    .all(hoje) as UpdateEventRow[];
  const updateEvents = rawUpdateEvents.map(event => ({
    quando: event.quando,
    registros: Number(event.registros ?? 0),
  }));

  const totalPedidosDia = cacheRows.reduce((s, r) => s + r.pedidos_dia,  0);
  const totalValorDia   = cacheRows.reduce((s, r) => s + r.valor_dia,    0);
  const totalPedidosMes = cacheRows.reduce((s, r) => s + r.pedidos_mes,  0);
  const totalValorMes   = cacheRows.reduce((s, r) => s + r.valor_mes,    0);
  const totalClientesAtendidos = cacheRows.reduce((s, r) => s + r.clientes_atendidos_mes, 0);
  const totalClientesVendas = cacheRows.reduce((s, r) => s + r.clientes_vendas_mes, 0);
  const totalMetaMensal = cacheRows.reduce((s, r) => s + r.meta_mensal, 0);
  const totalFaturamento = cacheRows.reduce((s, r) => s + r.faturamento_mes, 0);

  return (
    <DashboardClient
      user={{ name: user.name, role: user.role }}
      hoje={hoje}
      rows={cacheRows}
      totais={{
        pedidosDia: totalPedidosDia,
        valorDia:   fmtBrl(totalValorDia),
        pedidosMes: totalPedidosMes,
        valorMes:   fmtBrl(totalValorMes),
        clientesAtendidos: totalClientesAtendidos,
        clientesVendas: totalClientesVendas,
        metaMensal: fmtBrl(totalMetaMensal),
        metaMensalNum: totalMetaMensal,
        faturamento: fmtBrl(totalFaturamento),
        faturamentoNum: totalFaturamento,
        valorMesNum: totalValorMes,
      }}
      basePath={basePath}
      updateLog={{
        ultimaAtualizacao: lastUpdateRow?.ultima_atualizacao ?? null,
        eventos: updateEvents,
      }}
    />
  );
}
