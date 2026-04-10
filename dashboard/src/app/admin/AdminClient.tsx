'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Vendedora { id_olist: number; nome: string; email: string | null; recebe_email: number; }
interface VendedoraWithMeta extends Vendedora { meta_mensal?: number }
interface User { id: number; name: string; email: string; role: string; id_olist: number | null; recebe_relatorio: number; }
interface Schedule { id?: number; hora: string; dias: string; recorrencia: 'daily' | 'weekly' | 'monthly'; dia_mes: number; ultimo_dia_mes: number; ativo: number; }
interface EmailLog { id: number; enviado_em: string; tipo: string; destinatario: string; nome: string; status: string; mensagem: string; execucao_id: string; }
interface TokenRefreshLog { id: number; attempted_at: string; attempted_at_local?: string; status: 'ok' | 'erro' | 'info'; message: string; }

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
export default function AdminClient({ basePath, userName, userId }: { basePath: string; userName: string; userId: number }) {
  const [vendedoras,  setVendedoras]  = useState<VendedoraWithMeta[]>([]);
  const [users,       setUsers]       = useState<User[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([
    { hora: '18:00', dias: 'seg,ter,qua,qui,sex', recorrencia: 'weekly', dia_mes: 1, ultimo_dia_mes: 0, ativo: 0 },
  ]);
  const [serverTime, setServerTime] = useState<string>('');
  const [logs,        setLogs]        = useState<EmailLog[]>([]);
  const [logsTotal,   setLogsTotal]   = useState(0);
  const [logsPage,    setLogsPage]    = useState(0);
  const [scriptOut,   setScriptOut]   = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [msg,         setMsg]         = useState('');
  const [tokenRedirectUri, setTokenRedirectUri] = useState('');
  const [tokenClientId, setTokenClientId] = useState('');
  const [tokenClientSecret, setTokenClientSecret] = useState('');
  const [tokenClientSecretSet, setTokenClientSecretSet] = useState(false);
  const [tokenRefreshTokenSet, setTokenRefreshTokenSet] = useState(false);
  const [tokenUpdatedAt, setTokenUpdatedAt] = useState<string | null>(null);
  const [tokenLogs, setTokenLogs] = useState<TokenRefreshLog[]>([]);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenRefreshing, setTokenRefreshing] = useState(false);

  const getDefaultRedirectUri = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const safeBasePath = basePath ? `/${basePath.replace(/^\/+|\/+$/g, '')}` : '';
    return `${window.location.origin}${safeBasePath}/api/olist/callback`;
  }, [basePath]);

  // User form
  const [newName,  setNewName]  = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPwd,   setNewPwd]   = useState('');

  // Password change
  const [pwdModalUser, setPwdModalUser] = useState<User | null>(null);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');

  /* ── Loaders ──────────────────────────────────────────────────────────── */
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
    const d = await r.json() as Partial<Schedule> & { schedules?: Schedule[]; server_time?: string };
    if (d.server_time) setServerTime(d.server_time);
    const rawSchedules = Array.isArray(d.schedules) && d.schedules.length > 0
      ? d.schedules
      : [d];
    setSchedules(rawSchedules.map((item) => ({
      id: typeof item.id === 'number' ? item.id : undefined,
      hora: typeof item.hora === 'string' ? item.hora : '18:00',
      dias: typeof item.dias === 'string' ? item.dias : 'seg,ter,qua,qui,sex',
      recorrencia: item.recorrencia === 'daily' || item.recorrencia === 'weekly' || item.recorrencia === 'monthly'
        ? item.recorrencia
        : 'weekly',
      dia_mes: typeof item.dia_mes === 'number' && Number.isFinite(item.dia_mes) ? item.dia_mes : 1,
      ultimo_dia_mes: item.ultimo_dia_mes ? 1 : 0,
      ativo: item.ativo ? 1 : 0,
    })));
  }, [basePath]);

  const loadLogs = useCallback(async (page = 0) => {
    const r = await fetch(`${basePath}/api/email-logs?limit=20&offset=${page * 20}`);
    const d = await r.json();
    setLogs(d.rows);
    setLogsTotal(d.total);
    setLogsPage(page);
  }, [basePath]);

  const loadTokenPanel = useCallback(async () => {
    setTokenLoading(true);
    try {
      const r = await fetch(`${basePath}/api/olist/token`);
      const d = await r.json();
      if (!r.ok) return;
      const credentials = d.credentials ?? {};
      const persistedRedirectUri = typeof credentials.redirect_uri === 'string' ? credentials.redirect_uri.trim() : '';
      setTokenRedirectUri(persistedRedirectUri || getDefaultRedirectUri());
      setTokenClientId(typeof credentials.client_id === 'string' ? credentials.client_id : '');
      setTokenClientSecret('');
      setTokenClientSecretSet(!!credentials.client_secret_set);
      setTokenRefreshTokenSet(!!credentials.refresh_token_set);
      setTokenUpdatedAt(typeof credentials.updated_at === 'string' ? credentials.updated_at : null);
      setTokenLogs(Array.isArray(d.logs) ? d.logs : []);
    } finally {
      setTokenLoading(false);
    }
  }, [basePath, getDefaultRedirectUri]);

  useEffect(() => {
    loadVendedoras();
    loadUsers();
    loadSchedule();
    loadLogs(0);
    loadTokenPanel();
  }, [loadVendedoras, loadUsers, loadSchedule, loadLogs, loadTokenPanel]);

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
  const saveVendedora = async (v: VendedoraWithMeta) => {
    await fetch(`${basePath}/api/vendedores/${v.id_olist}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: v.email, recebe_email: v.recebe_email, meta_mensal: v.meta_mensal }),
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
      body: JSON.stringify({ schedules }),
    });
    const d = await r.json();
    setMsg(d.success ? 'Agendamento salvo.' : `Erro: ${d.error}`);
    if (d.success) loadSchedule();
  };

  const updateSchedule = (index: number, patch: Partial<Schedule>) => {
    setSchedules((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addSchedule = () => {
    setSchedules((prev) => [
      ...prev,
      { hora: '18:00', dias: 'seg,ter,qua,qui,sex', recorrencia: 'weekly', dia_mes: 1, ultimo_dia_mes: 0, ativo: 1 },
    ]);
  };

  const removeSchedule = (index: number) => {
    setSchedules((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleDia = (index: number, dia: string) => {
    const arr = schedules[index]?.dias.split(',').map(d => d.trim()).filter(Boolean) ?? [];
    const idx  = arr.indexOf(dia);
    const novo = idx >= 0 ? arr.filter(d => d !== dia) : [...arr, dia];
    updateSchedule(index, { dias: novo.join(',') });
  };

  const horariosConflitantes = useMemo(() => {
    const contagem = schedules.reduce<Record<string, number>>((acc, item) => {
      if (!item.ativo || !item.hora) return acc;
      acc[item.hora] = (acc[item.hora] ?? 0) + 1;
      return acc;
    }, {});
    return new Set(
      Object.entries(contagem)
        .filter(([, qtd]) => qtd > 1)
        .map(([hora]) => hora)
    );
  }, [schedules]);

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

  const changePassword = async () => {
    if (!pwdModalUser) return;
    if (pwdNew.length < 6) { setMsg('A nova senha deve ter no mínimo 6 caracteres.'); return; }
    
    const body: Record<string, string> = { newPassword: pwdNew };
    if (pwdModalUser.id === userId) {
      if (!pwdCurrent) { setMsg('A senha atual é obrigatória.'); return; }
      body.currentPassword = pwdCurrent;
    }

    const r = await fetch(`${basePath}/api/users/${pwdModalUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    
    if (d.error) {
      setMsg(`Erro: ${d.error}`);
    } else {
      setMsg('Senha alterada com sucesso.');
      setPwdModalUser(null);
      setPwdCurrent('');
      setPwdNew('');
    }
  };

  /* ── Email Logs ───────────────────────────────────────────────────────── */
  const clearLogs = async () => {
    if (!confirm('Tem certeza que deseja apagar todo o histórico de e-mails? Esta ação não pode ser desfeita.')) return;
    setMsg('Apagando histórico...');
    try {
      const r = await fetch(`${basePath}/api/email-logs`, { method: 'DELETE' });
      const d = await r.json();
      if (d.success) {
        setMsg('Histórico apagado com sucesso.');
        loadLogs(0);
      } else {
        setMsg(`Erro ao apagar histórico: ${d.error}`);
      }
    } catch {
      setMsg('Erro de conexão ao apagar histórico.');
    }
  };

  const saveTokenSettings = async () => {
    setTokenSaving(true);
    setMsg('');
    try {
      const r = await fetch(`${basePath}/api/olist/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          redirect_uri: tokenRedirectUri,
          client_id: tokenClientId,
          client_secret: tokenClientSecret,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setMsg(`Erro: ${d.error ?? 'Falha ao salvar dados do token.'}`);
        return;
      }
      setMsg('Dados Olist salvos.');
      setTokenClientSecret('');
      await loadTokenPanel();
    } catch {
      setMsg('Erro de conexão ao salvar dados do token.');
    } finally {
      setTokenSaving(false);
    }
  };

  const refreshTokenNow = async () => {
    setTokenRefreshing(true);
    setMsg('');
    try {
      const r = await fetch(`${basePath}/api/olist/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      });
      const d = await r.json();
      if (d.success) {
        setMsg('Token renovado com sucesso.');
      } else {
        setMsg('Falha na renovação do token. Verifique o log abaixo.');
      }
      await loadTokenPanel();
    } catch {
      setMsg('Erro de conexão ao renovar token.');
    } finally {
      setTokenRefreshing(false);
    }
  };

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
          <button className="btn-secondary" disabled={scriptLoading} onClick={() => runScript('send_admin_only')}>
            Enviar e-mails só admins
          </button>
          <button className="btn-primary" disabled={scriptLoading} onClick={() => runScript('fetch_and_send')}>
            {scriptLoading ? 'Executando...' : 'Atualizar e Enviar'}
          </button>
        </div>
        {scriptOut && <pre className="script-output">{scriptOut}</pre>}
      </Section>

      {/* ── 2. Agendamento ──────────────────────────────────────────────── */}
      <Section title="2. Agendamento">
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
          <strong style={{ color: 'var(--text-accent)' }}>Horário do Servidor agora: </strong> {serverTime || 'Carregando...'}
        </p>
        {schedules.map((schedule, index) => (
          <div
            key={schedule.id ?? `new-${index}`}
            className="card"
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-4)',
              border: schedule.ativo && horariosConflitantes.has(schedule.hora) ? '1px solid #f59e0b' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <strong>Agendamento {index + 1}</strong>
              <button className="btn-secondary" disabled={schedules.length <= 1} onClick={() => removeSchedule(index)}>
                Remover
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
              <div className="toggle-wrap">
                <Toggle
                  checked={!!schedule.ativo}
                  onChange={v => updateSchedule(index, { ativo: v ? 1 : 0 })}
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
                  onChange={e => updateSchedule(index, { hora: e.target.value })}
                  style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Recorrência</label>
                <select
                  value={schedule.recorrencia}
                  onChange={e => updateSchedule(index, {
                    recorrencia: e.target.value as Schedule['recorrencia'],
                    ultimo_dia_mes: 0,
                  })}
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
                          key={`${index}-${dia}`}
                          onClick={() => toggleDia(index, dia)}
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
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Dia do mês</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      disabled={!!schedule.ultimo_dia_mes}
                      value={schedule.dia_mes}
                      onChange={e => updateSchedule(index, { dia_mes: parseInt(e.target.value, 10) || 1 })}
                      style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div className="toggle-wrap">
                    <Toggle
                      checked={!!schedule.ultimo_dia_mes}
                      onChange={v => updateSchedule(index, { ultimo_dia_mes: v ? 1 : 0 })}
                    />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      Último dia do mês
                    </span>
                  </div>
                </div>
              )}
            </div>
            {schedule.ativo ? (
              <p style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Envio: {schedule.hora}{' '}
                {schedule.recorrencia === 'daily'
                  ? '(todo dia)'
                  : schedule.recorrencia === 'monthly'
                    ? schedule.ultimo_dia_mes
                      ? '(último dia do mês)'
                      : `(dia ${schedule.dia_mes} do mês)`
                    : `(dias: ${schedule.dias.replace(/,/g, ', ')})`}
              </p>
            ) : (
              <p style={{ marginTop: 12, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Agendamento desativado.
              </p>
            )}
            {schedule.ativo && horariosConflitantes.has(schedule.hora) && (
              <p style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: '#b45309', fontWeight: 600 }}>
                Atenção: existe outro agendamento ativo neste mesmo horário.
              </p>
            )}
          </div>
        ))}
        <div className="btn-group">
          <button className="btn-secondary" onClick={addSchedule}>Novo agendamento</button>
          <button className="btn-primary" onClick={saveSchedule}>Salvar agendamentos</button>
        </div>
      </Section>

      {/* ── 3a. Vendedoras ──────────────────────────────────────────────── */}
      <Section title="3a. Destinatários & Metas — Vendedoras">
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
            <div key={v.id_olist} className="item-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <span className="item-name" style={{ minWidth: 200 }}>{v.nome}</span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Meta (R$):</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={v.meta_mensal ?? ''}
                  onChange={e => setVendedoras(vs =>
                    vs.map(x => x.id_olist === v.id_olist ? { ...x, meta_mensal: parseFloat(e.target.value) || 0 } : x)
                  )}
                  style={{ width: 120, padding: '6px 10px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 250 }}>
                <input
                  type="email"
                  placeholder="e-mail de destino"
                  value={v.email ?? ''}
                  onChange={e => setVendedoras(vs =>
                    vs.map(x => x.id_olist === v.id_olist ? { ...x, email: e.target.value } : x)
                  )}
                  style={{ flex: 1, padding: '6px 10px' }}
                />
              </div>
              
              <div className="toggle-wrap" style={{ minWidth: 120 }}>
                <Toggle
                  checked={!!v.recebe_email}
                  onChange={val => setVendedoras(vs =>
                    vs.map(x => x.id_olist === v.id_olist ? { ...x, recebe_email: val ? 1 : 0 } : x)
                  )}
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {v.recebe_email ? 'Recebe E-mail' : 'Não Recebe'}
                </span>
              </div>
              
              <button
                className="btn-secondary"
                style={{ whiteSpace: 'nowrap', padding: '6px 16px' }}
                onClick={() => saveVendedora(v)}
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
          <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <div className="item-row" style={{ margin: 0 }}>
              <span className="item-name">{u.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', flex: 1 }}>{u.email}</span>
              <span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-vendedora'}`}>
                {u.role === 'admin' ? 'Admin' : 'Vendedora'}
              </span>
              <button className="btn-secondary" onClick={() => {
                setPwdModalUser(pwdModalUser?.id === u.id ? null : u);
                setPwdCurrent('');
                setPwdNew('');
              }}>
                Alterar Senha
              </button>
              <button className="btn-danger" onClick={() => deleteUser(u.id)}>Excluir</button>
            </div>

            {pwdModalUser?.id === u.id && (
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {u.id === userId && (
                  <input
                    type="password"
                    placeholder="Senha atual"
                    value={pwdCurrent}
                    onChange={e => setPwdCurrent(e.target.value)}
                  />
                )}
                <input
                  type="password"
                  placeholder="Nova senha (mín. 6)"
                  value={pwdNew}
                  onChange={e => setPwdNew(e.target.value)}
                />
                <button className="btn-primary" onClick={changePassword}>Salvar Senha</button>
                <button className="btn-secondary" onClick={() => setPwdModalUser(null)}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* ── 5. Histórico de Envios ───────────────────────────────────────── */}
      <Section title="5. Histórico de E-mails Enviados">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
          <button className="btn-danger" onClick={clearLogs} disabled={logs.length === 0}>
            Limpar Histórico
          </button>
        </div>
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

      <div className="section-card card">
        <div className="section-header">
          <h2>6. Renovação Token Olist (12h)</h2>
        </div>
        <div className="section-body">
          <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>URL de Redirecionamento</label>
              <input
                type="text"
                value={tokenRedirectUri}
                onChange={e => setTokenRedirectUri(e.target.value)}
                placeholder="https://seu-dominio/performance/api/olist/callback"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Client ID</label>
              <input
                type="text"
                value={tokenClientId}
                onChange={e => setTokenClientId(e.target.value)}
                placeholder="Informe o Client ID"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Client Secret</label>
              <input
                type="password"
                value={tokenClientSecret}
                onChange={e => setTokenClientSecret(e.target.value)}
                placeholder={tokenClientSecretSet ? 'Já configurado. Digite para substituir.' : 'Informe o Client Secret'}
              />
            </div>
          </div>

          <div className="btn-group" style={{ marginBottom: 'var(--space-4)' }}>
            <button className="btn-primary" onClick={saveTokenSettings} disabled={tokenSaving}>
              {tokenSaving ? 'Salvando...' : 'Salvar dados Olist'}
            </button>
            <button className="btn-secondary" onClick={refreshTokenNow} disabled={tokenRefreshing}>
              {tokenRefreshing ? 'Renovando...' : 'Renovar token agora'}
            </button>
            <button className="btn-secondary" onClick={loadTokenPanel} disabled={tokenLoading}>
              {tokenLoading ? 'Atualizando...' : 'Atualizar log'}
            </button>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>
            Renovação automática configurada para cada 12 horas.
            {tokenRefreshTokenSet ? ' Refresh token disponível.' : ' Refresh token ausente; conecte a conta Olist.'}
            {tokenUpdatedAt ? ` Dados atualizados em: ${tokenUpdatedAt.replace('T', ' ').slice(0, 16)}` : ''}
          </p>

          <div className="script-output" style={{ minHeight: 220, maxHeight: 300 }}>
            {tokenLogs.length === 0
              ? 'Nenhum log de renovação registrado.'
              : tokenLogs.map(l => `${(l.attempted_at_local ?? l.attempted_at).replace('T', ' ').slice(0, 19)} [${l.status}] ${l.message}`).join('\n')}
          </div>
        </div>
      </div>
    </div>
  );
}
