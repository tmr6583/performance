'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Vendedora { id_olist: number; nome: string; email: string | null; recebe_email: number; }
interface VendedoraWithMeta extends Vendedora { meta_mensal?: number }
interface User { id: number; name: string; email: string; role: string; id_olist: number | null; recebe_relatorio: number; }
interface Schedule { hora: string; dias: string; recorrencia: 'daily' | 'weekly' | 'monthly'; dia_mes: number; ativo: number; }
interface EmailLog { id: number; enviado_em: string; tipo: string; destinatario: string; nome: string; status: string; mensagem: string; execucao_id: string; }
interface OlistStatus { status: 'connected' | 'disconnected' | 'expired' | 'loading' | 'unknown'; }

const DIAS_LABEL: Record<string, string> = {
  dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb',
};
const DIAS_ORDER = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

/* ── Helpers ────────────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="section-card card">
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <h2>{title}</h2>
        <span className={`chevron ${open ? 'open' : ''}`}>⌄</span>
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export default function AdminClient({ basePath, userName }: { basePath: string; userName: string }) {
  const [olist,       setOlist]       = useState<OlistStatus>({ status: 'loading' });
  const [vendedoras,  setVendedoras]  = useState<VendedoraWithMeta[]>([]);
  const [users,       setUsers]       = useState<User[]>([]);
  const [schedule,    setSchedule]    = useState<Schedule>({ hora: '18:00', dias: 'seg,ter,qua,qui,sex', recorrencia: 'weekly', dia_mes: 1, ativo: 0 });
  const [logs,        setLogs]        = useState<EmailLog[]>([]);
  const [logsTotal,   setLogsTotal]   = useState(0);
  const [logsPage,    setLogsPage]    = useState(0);
  const [scriptOut,   setScriptOut]   = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [msg,         setMsg]         = useState('');

  // User form
  const [newName,  setNewName]  = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPwd,   setNewPwd]   = useState('');

  /* ── Loaders ──────────────────────────────────────────────────────────── */
  const loadOlist = useCallback(async () => {
    setOlist({ status: 'loading' });
    const r = await fetch(`${basePath}/api/olist/status`);
    const d = await r.json();
    setOlist(d);
  }, [basePath]);

  const loadVendedoras = useCallback(async () => {
    const r = await fetch(`${basePath}/api/vendedores`);
    setVendedoras(await r.json());
  }, [basePath]);

  const loadUsers = useCallback(async () => {
    const r = await fetch(`${basePath}/api/users`);
    setUsers(await r.json());
  }, [basePath]);

  const loadSchedule = useCallback(async () => {
    const r = await fetch(`${basePath}/api/schedule`);
    const d = await r.json() as Partial<Schedule>;
    setSchedule({
      hora:        typeof d.hora === 'string' ? d.hora : '18:00',
      dias:        typeof d.dias === 'string' ? d.dias : 'seg,ter,qua,qui,sex',
      recorrencia: d.recorrencia === 'daily' || d.recorrencia === 'weekly' || d.recorrencia === 'monthly'
        ? d.recorrencia
        : 'weekly',
      dia_mes:     typeof d.dia_mes === 'number' && Number.isFinite(d.dia_mes) ? d.dia_mes : 1,
      ativo:       d.ativo ? 1 : 0,
    });
  }, [basePath]);

  const loadLogs = useCallback(async (page = 0) => {
    const r = await fetch(`${basePath}/api/email-logs?limit=20&offset=${page * 20}`);
    const d = await r.json();
    setLogs(d.rows);
    setLogsTotal(d.total);
    setLogsPage(page);
  }, [basePath]);

  useEffect(() => {
    loadOlist();
    loadVendedoras();
    loadUsers();
    loadSchedule();
    loadLogs(0);
  }, [loadOlist, loadVendedoras, loadUsers, loadSchedule, loadLogs]);

  /* ── Script runner ────────────────────────────────────────────────────── */
  const runScript = async (acao: string) => {
    setScriptLoading(true);
    setScriptOut('Executando...\n');
    setMsg('');
    try {
      const r = await fetch(`${basePath}/api/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      });
      const d = await r.json();
      setScriptOut(d.output ?? '(sem saída)');
      if (d.success) {
        setMsg('Concluído com sucesso.');
        loadLogs(0);
      } else {
        setMsg(`Erro (código ${d.code}).`);
      }
    } catch {
      setScriptOut('Erro de conexão.');
      setMsg('Erro de conexão.');
    } finally {
      setScriptLoading(false);
    }
  };

  /* ── Vendedoras ───────────────────────────────────────────────────────── */
  const saveVendedora = async (v: Vendedora) => {
    await fetch(`${basePath}/api/vendedores/${v.id_olist}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: v.email, recebe_email: v.recebe_email }),
    });
    setMsg('Salvo.');
  };

  const syncVendedoras = async () => {
    setMsg('Sincronizando...');
    const r = await fetch(`${basePath}/api/vendedores`, { method: 'POST' });
    const d = await r.json();
    if (d.error) { setMsg(`Erro: ${d.error}`); return; }
    setMsg(`Sincronizado: ${d.novos} nova(s), ${d.ja_existentes} já existia(m).`);
    loadVendedoras();
  };

  /* ── Schedule ─────────────────────────────────────────────────────────── */
  const saveSchedule = async () => {
    const r = await fetch(`${basePath}/api/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
    const d = await r.json();
    setMsg(d.success ? 'Agendamento salvo.' : `Erro: ${d.error}`);
  };

  const toggleDia = (dia: string) => {
    const arr = schedule.dias.split(',').map(d => d.trim()).filter(Boolean);
    const idx  = arr.indexOf(dia);
    const novo = idx >= 0 ? arr.filter(d => d !== dia) : [...arr, dia];
    setSchedule(s => ({ ...s, dias: novo.join(',') }));
  };

  /* ── Users ────────────────────────────────────────────────────────────── */
  const createUser = async () => {
    if (!newName || !newEmail || !newPwd) { setMsg('Preencha todos os campos.'); return; }
    const r = await fetch(`${basePath}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        password: newPwd,
      }),
    });
    const d = await r.json();
    if (d.error) { setMsg(`Erro: ${d.error}`); return; }
    setMsg('Usuário criado.');
    setNewName(''); setNewEmail(''); setNewPwd('');
    loadUsers();
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Excluir este usuário?')) return;
    const r = await fetch(`${basePath}/api/users/${id}`, { method: 'DELETE' });
    const d = await r.json();
    setMsg(d.success ? 'Usuário excluído.' : `Erro: ${d.error}`);
    loadUsers();
  };

  const toggleRelatorio = async (u: User) => {
    await fetch(`${basePath}/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recebe_relatorio: !u.recebe_relatorio }),
    });
    loadUsers();
  };

  /* ── Olist dot helper ─────────────────────────────────────────────────── */
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

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="fade-in">
      {/* Header */}
      <div className="dashboard-header card" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Administração</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Olá, {userName}
          </p>
        </div>
        <div className="header-actions">
          <div className="olist-bar">
            <span className={`olist-dot ${olistDot}`} />
            <span className="olist-label">{olistText}</span>
            {olist.status !== 'connected' && olist.status !== 'loading' && (
              <a href={`${basePath}/api/olist/connect`} className="btn-link" style={{ marginLeft: 6 }}>
                Conectar
              </a>
            )}
            {olist.status === 'connected' && (
              <button className="btn-link" style={{ marginLeft: 6 }} onClick={loadOlist}>↻</button>
            )}
          </div>
          <Link href="/" className="btn-secondary">Dashboard</Link>
          <a href={`${basePath}/api/auth/logout`} className="btn-secondary">Sair</a>
        </div>
      </div>

      {msg && (
        <div className="success-msg card" style={{ padding: '10px 16px', marginBottom: 'var(--space-4)' }}>
          {msg}
        </div>
      )}

      {/* ── 1. Execução Manual ───────────────────────────────────────────── */}
      <Section title="1. Execução Manual">
        <div className="btn-group" style={{ marginBottom: 'var(--space-4)' }}>
          <button className="btn-secondary" disabled={scriptLoading} onClick={() => runScript('fetch')}>
            Atualizar dados Olist
          </button>
          <button className="btn-secondary" disabled={scriptLoading} onClick={() => runScript('send')}>
            Enviar e-mails agora
          </button>
          <button className="btn-primary" disabled={scriptLoading} onClick={() => runScript('fetch_and_send')}>
            {scriptLoading ? 'Executando...' : 'Atualizar e Enviar'}
          </button>
        </div>
        {scriptOut && <pre className="script-output">{scriptOut}</pre>}
      </Section>

      {/* ── 2. Agendamento ──────────────────────────────────────────────── */}
      <Section title="2. Agendamento">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
          <div className="toggle-wrap">
            <Toggle
              checked={!!schedule.ativo}
              onChange={v => setSchedule(s => ({ ...s, ativo: v ? 1 : 0 }))}
            />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {schedule.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Horário de envio</label>
            <input
              type="time"
              value={schedule.hora}
              onChange={e => setSchedule(s => ({ ...s, hora: e.target.value }))}
              style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Recorrência</label>
            <select
              value={schedule.recorrencia}
              onChange={e => setSchedule(s => ({ ...s, recorrencia: e.target.value as Schedule['recorrencia'] }))}
              style={{ width: 180, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
            >
              <option value="daily">Todo dia</option>
              <option value="weekly">Dias da semana</option>
              <option value="monthly">Dia do mês</option>
            </select>
          </div>

          {schedule.recorrencia === 'weekly' && (
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-muted)' }}>
                Dias da semana
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DIAS_ORDER.map(dia => {
                  const ativo = schedule.dias.split(',').map(d => d.trim()).includes(dia);
                  return (
                    <button
                      key={dia}
                      onClick={() => toggleDia(dia)}
                      style={{
                        padding: '6px 12px', borderRadius: 999, border: '1.5px solid',
                        borderColor: ativo ? 'var(--accent)' : 'var(--border)',
                        background: ativo ? 'rgba(17,86,199,.1)' : 'var(--surface)',
                        color: ativo ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer',
                      }}
                    >
                      {DIAS_LABEL[dia]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {schedule.recorrencia === 'monthly' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label>Dia do mês</label>
              <input
                type="number"
                min={1}
                max={31}
                value={schedule.dia_mes}
                onChange={e => setSchedule(s => ({ ...s, dia_mes: parseInt(e.target.value, 10) || 1 }))}
                style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={saveSchedule}>Salvar agendamento</button>
        {schedule.ativo ? (
          <p style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Próximo envio: {schedule.hora}{' '}
            {schedule.recorrencia === 'daily'
              ? '(todo dia)'
              : schedule.recorrencia === 'monthly'
                ? `(dia ${schedule.dia_mes} do mês)`
                : `(dias: ${schedule.dias.replace(/,/g, ', ')})`}
          </p>
        ) : (
          <p style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Agendamento desativado.
          </p>
        )}
      </Section>

      {/* ── 3a. Vendedoras ──────────────────────────────────────────────── */}
      <Section title="3a. Destinatários — Vendedoras">
        <div className="btn-group" style={{ marginBottom: 'var(--space-5)' }}>
          <button className="btn-secondary" onClick={syncVendedoras}>
            Sincronizar lista do Olist
          </button>
        </div>

        {vendedoras.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            Nenhuma vendedora cadastrada. Clique em &quot;Sincronizar lista do Olist&quot;.
          </p>
        ) : (
          vendedoras.map(v => (
            <div key={v.id_olist} className="item-row">
              <span className="item-name">{v.nome}</span>
              <input
                type="email"
                placeholder="e-mail de destino"
                value={v.email ?? ''}
                onChange={e => setVendedoras(vs =>
                  vs.map(x => x.id_olist === v.id_olist ? { ...x, email: e.target.value } : x)
                )}
              />
              <input
                type="text"
                value={v.meta_mensal != null ? `Meta (Olist): R$ ${v.meta_mensal}` : 'Meta (Olist): —'}
                disabled
                style={{ width: 220 }}
              />
              <div className="toggle-wrap">
                <Toggle
                  checked={!!v.recebe_email}
                  onChange={val => setVendedoras(vs =>
                    vs.map(x => x.id_olist === v.id_olist ? { ...x, recebe_email: val ? 1 : 0 } : x)
                  )}
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {v.recebe_email ? 'Habilitada' : 'Desabilitada'}
                </span>
              </div>
              <button
                className="btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => saveVendedora(v as Vendedora)}
              >
                Salvar
              </button>
            </div>
          ))
        )}
      </Section>

      {/* ── 3b. Admins ──────────────────────────────────────────────────── */}
      <Section title="3b. Destinatários — Administradores (resumo da equipe)">
        {users.filter(u => u.role === 'admin').map(u => (
          <div key={u.id} className="item-row">
            <span className="item-name">{u.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', flex: 1 }}>{u.email}</span>
            <div className="toggle-wrap">
              <Toggle checked={!!u.recebe_relatorio} onChange={() => toggleRelatorio(u)} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {u.recebe_relatorio ? 'Recebe resumo' : 'Não recebe'}
              </span>
            </div>
          </div>
        ))}
      </Section>

      {/* ── 4. Usuários do Dashboard ─────────────────────────────────────── */}
      <Section title="4. Usuários do Dashboard">
        <div className="user-form">
          <input placeholder="Nome" value={newName}  onChange={e => setNewName(e.target.value)} />
          <input placeholder="E-mail" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <input placeholder="Senha (mín. 6)" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
          <button className="btn-primary" onClick={createUser}>Criar</button>
        </div>

        {users.map(u => (
          <div key={u.id} className="item-row">
            <span className="item-name">{u.name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', flex: 1 }}>{u.email}</span>
            <span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-vendedora'}`}>
              {u.role === 'admin' ? 'Admin' : 'Vendedora'}
            </span>
            <button className="btn-danger" onClick={() => deleteUser(u.id)}>Excluir</button>
          </div>
        ))}
      </Section>

      {/* ── 5. Histórico de Envios ───────────────────────────────────────── */}
      <Section title="5. Histórico de E-mails Enviados">
        <div className="table-wrap">
          <table className="perf-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Tipo</th>
                <th>Destinatário</th>
                <th>Status</th>
                <th>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum registro.</td></tr>
              ) : logs.map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.enviado_em.replace('T', ' ').slice(0, 16)}</td>
                  <td><span className={`badge ${l.tipo === 'admin' ? 'badge-admin' : 'badge-vendedora'}`}>{l.tipo}</span></td>
                  <td>{l.nome} <span style={{ color: 'var(--text-muted)' }}>&lt;{l.destinatario}&gt;</span></td>
                  <td><span className={`badge ${l.status === 'ok' ? 'badge-ok' : 'badge-erro'}`}>{l.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{l.mensagem ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button disabled={logsPage === 0} onClick={() => loadLogs(logsPage - 1)}>‹ Anterior</button>
          <span>Página {logsPage + 1} de {Math.max(1, Math.ceil(logsTotal / 20))}</span>
          <button
            disabled={(logsPage + 1) * 20 >= logsTotal}
            onClick={() => loadLogs(logsPage + 1)}
          >
            Próxima ›
          </button>
        </div>
      </Section>
    </div>
  );
}
