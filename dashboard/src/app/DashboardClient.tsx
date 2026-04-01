'use client';

import Link from 'next/link';

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Row = {
  id_vendedor: number;
  nome_vendedor: string;
  pedidos_dia: number;
  valor_dia: number;
  ticket_medio_dia: number;
  pedidos_mes: number;
  valor_mes: number;
  ticket_medio_mes: number;
};

interface Props {
  user: { name: string; role: string };
  hoje: string;
  rows: Row[];
  totais: {
    pedidosDia: number;
    valorDia: string;
    pedidosMes: number;
    valorMes: string;
  };
  basePath: string;
}

export default function DashboardClient({ user, hoje, rows, totais, basePath }: Props) {
  const [, mes, dia] = hoje.split('-');
  const dataExib = `${dia}/${mes}/${hoje.slice(0, 4)}`;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="dashboard-header card" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Performance de Vendas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {user.role === 'admin' ? 'Visão consolidada da equipe' : `Bem-vinda, ${user.name}`}
            {' — '}{dataExib}
          </p>
        </div>
        <div className="header-actions">
          {user.role === 'admin' && (
            <Link href="/admin" className="btn-primary">
              Administração
            </Link>
          )}
          <a href={`${basePath}/api/auth/logout`} className="btn-secondary">
            Sair
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi-card card">
          <div className="kpi-label">Pedidos Hoje</div>
          <div className="kpi-value">{totais.pedidosDia}</div>
        </div>
        <div className="kpi-card card">
          <div className="kpi-label">Faturado Hoje</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{totais.valorDia}</div>
        </div>
        <div className="kpi-card card">
          <div className="kpi-label">Pedidos no Mês</div>
          <div className="kpi-value">{totais.pedidosMes}</div>
        </div>
        <div className="kpi-card card">
          <div className="kpi-label">Faturado no Mês</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{totais.valorMes}</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 'var(--text-base)' }}>
            {user.role === 'admin' ? 'Desempenho por Vendedora' : 'Seu Desempenho'}
          </h2>
        </div>
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', color: 'var(--text-muted)', textAlign: 'center' }}>
              Nenhum dado disponível para hoje. Execute a atualização no painel de administração.
            </div>
          ) : (
            <table className="perf-table">
              <thead>
                <tr>
                  {user.role === 'admin' && <th>Vendedora</th>}
                  <th className="text-right">Pd. Hoje</th>
                  <th className="text-right">Valor Hoje</th>
                  <th className="text-right">Ticket Médio Dia</th>
                  <th className="text-right">Pd. Mês</th>
                  <th className="text-right">Valor Mês</th>
                  <th className="text-right">Ticket Médio Mês</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id_vendedor}>
                    {user.role === 'admin' && <td className="font-bold">{r.nome_vendedor}</td>}
                    <td className="text-right">{r.pedidos_dia}</td>
                    <td className="text-right">{fmtBrl(r.valor_dia)}</td>
                    <td className="text-right">{fmtBrl(r.ticket_medio_dia)}</td>
                    <td className="text-right">{r.pedidos_mes}</td>
                    <td className="text-right text-accent font-bold">{fmtBrl(r.valor_mes)}</td>
                    <td className="text-right">{fmtBrl(r.ticket_medio_mes)}</td>
                  </tr>
                ))}
              </tbody>
              {user.role === 'admin' && rows.length > 1 && (
                <tfoot>
                  <tr style={{ background: 'rgba(241,245,249,.8)' }}>
                    <td className="font-bold">TOTAL</td>
                    <td className="text-right font-bold">
                      {rows.reduce((s, r) => s + r.pedidos_dia, 0)}
                    </td>
                    <td className="text-right font-bold">
                      {fmtBrl(rows.reduce((s, r) => s + r.valor_dia, 0))}
                    </td>
                    <td />
                    <td className="text-right font-bold">
                      {rows.reduce((s, r) => s + r.pedidos_mes, 0)}
                    </td>
                    <td className="text-right font-bold text-accent">
                      {fmtBrl(rows.reduce((s, r) => s + r.valor_mes, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
