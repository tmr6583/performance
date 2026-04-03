'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

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
  clientes_atendidos_mes: number;
  clientes_vendas_mes: number;
  faturamento_mes: number;
  meta_mensal: number;
};

interface OlistStatus { status: 'connected' | 'disconnected' | 'expired' | 'loading' | 'unknown'; }

interface Props {
  user: { name: string; role: string };
  hoje: string;
  rows: Row[];
  totais: {
    pedidosDia: number;
    valorDia: string;
    pedidosMes: number;
    valorMes: string;
    clientesAtendidos: number;
    clientesVendas: number;
    metaMensal: string;
    metaMensalNum: number;
    faturamento: string;
    faturamentoNum: number;
    valorMesNum: number;
  };
  basePath: string;
}

export default function DashboardClient({ user, hoje, rows, totais, basePath }: Props) {
  const [, mes, dia] = hoje.split('-');
  const dataExib = `${dia}/${mes}/${hoje.slice(0, 4)}`;

  const [olist, setOlist] = useState<OlistStatus>({ status: 'loading' });
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const sortedRows = [...rows];
  if (sortConfig !== null) {
    sortedRows.sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      if (sortConfig.key === 'nome_vendedor') {
        aValue = a.nome_vendedor.toLowerCase();
        bValue = b.nome_vendedor.toLowerCase();
      } else if (sortConfig.key === 'meta_mensal') {
        aValue = a.meta_mensal;
        bValue = b.meta_mensal;
      } else if (sortConfig.key === 'valor_mes') {
        aValue = a.valor_mes;
        bValue = b.valor_mes;
      } else if (sortConfig.key === 'faturamento_mes') {
        aValue = a.faturamento_mes;
        bValue = b.faturamento_mes;
      } else if (sortConfig.key === 'realizado') {
        aValue = a.meta_mensal > 0 ? (a.faturamento_mes / a.meta_mensal) : 0;
        bValue = b.meta_mensal > 0 ? (b.faturamento_mes / b.meta_mensal) : 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const loadOlist = useCallback(async () => {
    if (user.role !== 'admin') return;
    setOlist({ status: 'loading' });
    try {
      const r = await fetch(`${basePath}/api/olist/status`);
      const d = await r.json();
      setOlist(d);
    } catch {
      setOlist({ status: 'unknown' });
    }
  }, [basePath, user.role]);

  useEffect(() => {
    loadOlist();
  }, [loadOlist]);

  const olistDot = {
    connected:    'olist-connected',
    disconnected: 'olist-disconnected',
    expired:      'olist-expired',
    loading:      'olist-loading',
    unknown:      'olist-unknown',
  }[olist.status] ?? 'olist-unknown';

  const olistText = {
    connected:    'Olist conectado',
    disconnected: 'Olist desconectado',
    expired:      'Token expirado',
    loading:      'Verificando...',
    unknown:      'Status desconhecido',
  }[olist.status] ?? '';

  const [scriptLoading, setScriptLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const runScript = async (acao: string) => {
    setScriptLoading(true);
    setMsg('');
    try {
      const r = await fetch(`${basePath}/api/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg('Dados atualizados com sucesso!');
        // Força recarregamento da página para atualizar os dados do banco de dados (RSC)
        window.location.reload();
      } else {
        setMsg(`Erro na atualização (código ${d.code}). Output: ${d.output}`);
      }
    } catch {
      setMsg('Erro de conexão ao atualizar dados.');
    } finally {
      setScriptLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('olist_ok') === '1') {
      setMsg('Conectado ao Olist com sucesso!');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('olist_error')) {
      setMsg(`Erro Olist: ${params.get('olist_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
            <>
              <div className="olist-bar" style={{ marginRight: '8px' }}>
                <span className={`olist-dot ${olistDot}`} />
                <span className="olist-label">{olistText}</span>
                {olist.status !== 'connected' && olist.status !== 'loading' && (
                  <a href={`${basePath}/api/olist/connect`} className="btn-link" style={{ marginLeft: 6 }}>
                    Conectar ao Olist
                  </a>
                )}
                {olist.status === 'connected' && (
                  <>
                    <button className="btn-link" style={{ marginLeft: 6, marginRight: 6 }} onClick={loadOlist}>↻</button>
                    |
                    <button className="btn-link" style={{ marginLeft: 6 }} disabled={scriptLoading} onClick={() => runScript('fetch')}>
                      {scriptLoading ? 'Atualizando...' : 'Atualizar Dados'}
                    </button>
                  </>
                )}
              </div>
              <Link href={`${basePath}/admin`} className="btn-primary">
                Administração
              </Link>
            </>
          )}
          <a href={`${basePath}/api/auth/logout`} className="btn-secondary">
            Sair
          </a>
        </div>
      </div>

      {msg && (
        <div className="success-msg card" style={{ padding: '10px 16px', marginBottom: 'var(--space-4)' }}>
          {msg}
        </div>
      )}

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
              Nenhum dado disponível para hoje. Execute a atualização Olist .
            </div>
          ) : (
            <table className="perf-table">
              <thead>
                <tr>
                  {user.role === 'admin' && (
                    <th onClick={() => handleSort('nome_vendedor')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Vendedor <span style={{ opacity: 0.5, fontSize: '0.8em' }}>{getSortIcon('nome_vendedor')}</span>
                    </th>
                  )}
                  <th className="text-right" onClick={() => handleSort('meta_mensal')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Meta do mês <span style={{ opacity: 0.5, fontSize: '0.8em' }}>{getSortIcon('meta_mensal')}</span>
                  </th>
                  <th className="text-right" onClick={() => handleSort('valor_mes')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Vendas no mês <span style={{ opacity: 0.5, fontSize: '0.8em' }}>{getSortIcon('valor_mes')}</span>
                  </th>
                  <th className="text-right" onClick={() => handleSort('faturamento_mes')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Faturamento no mês <span style={{ opacity: 0.5, fontSize: '0.8em' }}>{getSortIcon('faturamento_mes')}</span>
                  </th>
                  <th className="text-right" onClick={() => handleSort('realizado')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Realizado <span style={{ opacity: 0.5, fontSize: '0.8em' }}>{getSortIcon('realizado')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(r => {
                  const realizado = r.meta_mensal > 0 ? (r.faturamento_mes / r.meta_mensal) * 100 : 0;
                  return (
                    <tr key={r.id_vendedor}>
                      {user.role === 'admin' && <td className="font-bold">{r.nome_vendedor}</td>}
                      <td className="text-right">{fmtBrl(r.meta_mensal)}</td>
                      <td className="text-right text-accent font-bold">{fmtBrl(r.valor_mes)}</td>
                      <td className="text-right">{fmtBrl(r.faturamento_mes)}</td>
                      <td className="text-right font-bold">
                        {r.meta_mensal > 0 ? `${realizado.toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {user.role === 'admin' && rows.length > 1 && (
                <tfoot>
                  <tr style={{ background: 'rgba(241,245,249,.8)' }}>
                    <td className="font-bold">Totais</td>
                    <td className="text-right font-bold">{totais.metaMensal}</td>
                    <td className="text-right font-bold text-accent">{totais.valorMes}</td>
                    <td className="text-right font-bold">{totais.faturamento}</td>
                    <td className="text-right font-bold">
                      {totais.metaMensalNum > 0 ? `${((totais.faturamentoNum / totais.metaMensalNum) * 100).toFixed(2)}%` : '-'}
                    </td>
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
