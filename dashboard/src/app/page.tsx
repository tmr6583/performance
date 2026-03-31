import { getAuthUser } from '@/lib/auth';
import db, { ensureDbInitialized } from '@/lib/db';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function HomePage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

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
  };

  let cacheRows: CacheRow[] = [];

  if (user.role === 'admin') {
    cacheRows = db
      .prepare('SELECT * FROM performance_cache WHERE data = ? ORDER BY valor_mes DESC')
      .all(hoje) as CacheRow[];
  } else {
    // Salesperson: encontra id_olist pelo e-mail
    const vend = db
      .prepare('SELECT id_olist FROM vendedores WHERE email = ?')
      .get(user.email) as { id_olist: number } | undefined;

    if (vend) {
      const row = db
        .prepare('SELECT * FROM performance_cache WHERE data = ? AND id_vendedor = ?')
        .get(hoje, vend.id_olist) as CacheRow | undefined;
      if (row) cacheRows = [row];
    }
  }

  const totalPedidosDia = cacheRows.reduce((s, r) => s + r.pedidos_dia,  0);
  const totalValorDia   = cacheRows.reduce((s, r) => s + r.valor_dia,    0);
  const totalPedidosMes = cacheRows.reduce((s, r) => s + r.pedidos_mes,  0);
  const totalValorMes   = cacheRows.reduce((s, r) => s + r.valor_mes,    0);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
      }}
      basePath={basePath}
    />
  );
}
