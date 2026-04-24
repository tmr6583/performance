'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { resolveBasePath } from '@/lib/base-path';

export default function LoginPage() {
  const basePath = resolveBasePath();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = basePath ? `${basePath}/api/auth/login` : `/api/auth/login`;
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:    JSON.stringify({ email, password }),
      });

      if (res.ok) {
        window.location.assign(basePath || '/');
      } else {
        const data = await res.json();
        setError(data.error || 'Falha no login');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container fade-in">
      <div className="glass login-card">
        <div className="logo-glow" />
        <h1>Performance</h1>
        <p>Betina Limpeza — Relatório de Vendas</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
