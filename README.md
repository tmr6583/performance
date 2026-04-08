# Betina Performance — Dashboard de Desempenho de Vendas

Sistema de monitoramento e reporte de performance de vendas integrado à API Olist/Tiny ERP v3. Envia e-mails diários de desempenho para cada vendedora e um resumo consolidado para os administradores. Possui painel web para execução manual, agendamento e gerenciamento de usuários.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Estrutura de Diretórios](#estrutura-de-diretórios)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Banco de Dados](#banco-de-dados)
- [Scripts Python](#scripts-python)
- [Dashboard Next.js](#dashboard-nextjs)
- [API Routes](#api-routes)
- [Serviços systemd](#serviços-systemd)
- [Configuração Apache](#configuração-apache)
- [Primeiro Acesso](#primeiro-acesso)
- [Operação](#operação)
- [Monitoramento e Logs](#monitoramento-e-logs)
- [Fluxo de Dados](#fluxo-de-dados)
- [Recuperação de Falhas](#recuperação-de-falhas)

---

## Visão Geral

O sistema é composto por duas camadas:

| Camada | Tecnologia | Função |
|---|---|---|
| Python | Python 3.12 + venv | Busca dados na API Olist, calcula métricas, envia e-mails |
| Dashboard | Next.js 16 (App Router) | Interface web, autenticação, agendamento, gerenciamento |

**Acesso público:** `https://betinalimpeza.ddns.net/performance`

**Porta interna:** `localhost:3100`

---

## Arquitetura

```
Internet (HTTPS:443)
       │
  Apache2 (reverse proxy)
       │  /performance/* → localhost:3100
       │
  Next.js (performance-dashboard.service)
       │
       ├── Middleware (JWT auth)
       ├── App Router (Server + Client Components)
       ├── API Routes (/api/*)
       │       └── POST /api/scripts → executa Python via child_process
       │
       └── node-cron (scheduler)
               └── dispara fetch_performance.py + send_emails.py

  Python Scripts (.venv/bin/python)
       ├── fetch_performance.py → API Olist → SQLite
       └── send_emails.py       → SQLite → SMTP (email-ssl.com.br:465)

  SQLite (database.db)
       └── users, vendedores, performance_cache, email_logs, schedules

  systemd
       ├── performance-token-refresh.service  (oneshot, boot)
       └── performance-dashboard.service      (always, após token-refresh)
```

---

## Requisitos

- Ubuntu 24.04 LTS
- Node.js 22+ (com `node:sqlite` experimental)
- Python 3.12+
- Apache2 com `mod_proxy`, `mod_proxy_http`, `mod_headers`, `mod_ssl`
- Certificado SSL (Let's Encrypt)
- Conta Olist/Tiny ERP com aplicação OAuth registrada
- Servidor SMTP com SSL/TLS na porta 465

---

## Estrutura de Diretórios

```
/opt/betina/performance/
├── .env                        # Variáveis para scripts Python
├── .tiny_tokens.json           # Tokens OAuth Olist (gerado automaticamente)
├── database.db                 # Banco de dados SQLite
├── performance.log             # Log unificado dos scripts Python
│
├── config.py                   # Configurações compartilhadas (Python)
├── logger_util.py              # Utilitário de logging
├── olist_auth.py               # Gerenciamento OAuth 2.0 + cliente HTTP
├── fetch_performance.py        # Busca métricas na API e salva no SQLite
├── send_emails.py              # Envia e-mails de performance
├── email_templates.py          # Templates HTML dos e-mails
├── refresh_tokens.py           # Renovação de tokens na inicialização
├── requirements.txt            # Dependências Python
│
├── .venv/                      # Ambiente virtual Python
│
├── env/
│   └── performance.env         # Variáveis para o serviço systemd (Next.js)
│
└── dashboard/                  # Aplicação Next.js
    ├── .env.local              # Variáveis para desenvolvimento local
    ├── next.config.ts          # Configuração Next.js (basePath)
    ├── package.json
    └── src/
        ├── instrumentation.ts  # Inicializa o scheduler no boot do Next.js
        ├── middleware.ts        # Proteção de rotas por JWT
        └── app/
            ├── layout.tsx
            ├── page.tsx         # Página principal (performance do dia)
            ├── login/
            │   └── page.tsx
            ├── admin/
            │   ├── page.tsx
            │   └── AdminClient.tsx
            ├── DashboardClient.tsx
            └── api/
                ├── auth/
                │   ├── login/route.ts
                │   └── logout/route.ts
                ├── olist/
                │   ├── connect/route.ts
                │   ├── callback/route.ts
                │   └── status/route.ts
                ├── scripts/route.ts
                ├── schedule/route.ts
                ├── vendedores/
                │   ├── route.ts
                │   └── [id]/route.ts
                ├── users/
                │   ├── route.ts
                │   └── [id]/route.ts
                └── email-logs/route.ts
```

---

## Variáveis de Ambiente

### `/opt/betina/performance/.env` — Python

```ini
CLIENT_ID=<Olist Client ID>
CLIENT_SECRET=<Olist Client Secret>
OLIST_REDIRECT_URI=https://betinalimpeza.ddns.net/performance/api/olist/callback

SMTP_HOST=email-ssl.com.br
SMTP_PORT=465
SMTP_USER=contato@betinalimpeza.com.br
SMTP_PASSWORD=<senha SMTP>
EMAIL_FROM_NAME=Betina Limpeza

SQLITE_DB_PATH=/opt/betina/performance/database.db
```

### `/opt/betina/performance/env/performance.env` — systemd / Next.js

```ini
JWT_SECRET=<string aleatória longa>
INTERNAL_SECRET=<outra string aleatória para auth do cron job interno>
OLIST_CLIENT_ID=<Olist Client ID>
OLIST_CLIENT_SECRET=<Olist Client Secret>
OLIST_REDIRECT_URI=https://betinalimpeza.ddns.net/performance/api/olist/callback
SQLITE_DB_PATH=/opt/betina/performance/database.db
PERFORMANCE_SCRIPT_DIR=/opt/betina/performance
NEXT_PUBLIC_BASE_PATH=/performance
```

> **Nota sobre Standalone Build:** O Next.js usa um caminho absoluto para o `SQLITE_DB_PATH` garantindo que o build `.next/standalone` não crie um banco isolado e utilize a base de produção correta.

### `/opt/betina/performance/dashboard/.env.local` — desenvolvimento local

```ini
JWT_SECRET=<mesmo JWT_SECRET>
INTERNAL_SECRET=<mesmo INTERNAL_SECRET>
NEXT_PUBLIC_BASE_PATH=
OLIST_CLIENT_ID=<Olist Client ID>
OLIST_CLIENT_SECRET=<Olist Client Secret>
OLIST_REDIRECT_URI=http://localhost:3100/api/olist/callback
SQLITE_DB_PATH=c:\GitHubLocal\performance\database.db
```

---

## Banco de Dados

Arquivo: `/opt/betina/performance/database.db` (SQLite, WAL mode)

### Tabela `users`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INTEGER PK | Auto-incremento |
| `name` | TEXT | Nome do usuário |
| `email` | TEXT UNIQUE | E-mail (usado como login) |
| `password` | TEXT | Hash bcrypt |
| `role` | TEXT | `admin` ou `salesperson` |
| `recebe_relatorio` | INTEGER | `1` = recebe e-mail de resumo da equipe |
| `created_at` | DATETIME | Data de criação |

### Tabela `vendedores`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id_olist` | INTEGER PK | ID do vendedor na API Olist |
| `nome` | TEXT | Nome (sincronizado via API) |
| `email` | TEXT | E-mail para envio de relatório |
| `recebe_email` | INTEGER | `1` = recebe e-mail individual |
| `meta_mensal` | REAL | Meta financeira estipulada para o mês |
| `updated_at` | DATETIME | Última atualização |

### Tabela `performance_cache`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INTEGER PK | Auto-incremento |
| `data` | TEXT | Data no formato `YYYY-MM-DD` |
| `id_vendedor` | INTEGER | ID Olist do vendedor |
| `nome_vendedor` | TEXT | Nome snapshot |
| `pedidos_dia` | INTEGER | Pedidos no dia |
| `valor_dia` | REAL | Valor total dos pedidos do dia |
| `ticket_medio_dia` | REAL | Ticket médio do dia |
| `pedidos_mes` | INTEGER | Pedidos no mês corrente |
| `valor_mes` | REAL | Valor total do mês |
| `ticket_medio_mes` | REAL | Ticket médio do mês |
| `atualizado_em` | DATETIME | Última atualização |

> **Restrição:** `UNIQUE(data, id_vendedor)` — upsert automático em re-execuções.

### Tabela `email_logs`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INTEGER PK | Auto-incremento |
| `enviado_em` | DATETIME | Timestamp do envio |
| `execucao_id` | TEXT | UUID da execução em lote |
| `tipo` | TEXT | `vendedora` ou `admin` |
| `destinatario` | TEXT | Endereço de e-mail |
| `nome` | TEXT | Nome do destinatário |
| `status` | TEXT | `ok` ou `erro` |
| `mensagem` | TEXT | Detalhe do erro (quando `erro`) |

### Tabela `schedules`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | INTEGER PK | Identificador do agendamento (suporta múltiplas linhas) |
| `hora` | TEXT | Horário no formato `HH:MM` |
| `dias` | TEXT | Dias separados por vírgula: `seg,ter,qua,qui,sex` |
| `recorrencia` | TEXT | `daily`, `weekly` ou `monthly` |
| `dia_mes` | INTEGER | Dia do mês para recorrência mensal (1–31) |
| `ultimo_dia_mes` | INTEGER | `1` para executar no último dia do mês |
| `ativo` | INTEGER | `1` = agendamento ativo |
| `modificado` | DATETIME | Última modificação |

---

## Scripts Python

### `config.py`

Carrega variáveis de ambiente do `.env` via `python-dotenv`. Define todas as constantes compartilhadas: URLs OAuth, parâmetros SMTP, caminhos de arquivo, limites de paginação.

### `logger_util.py`

Cria logger nomeado com saída simultânea para console e para `/opt/betina/performance/performance.log`.

### `olist_auth.py`

**Classe `OlistAuth`:** Gerencia o ciclo de vida dos tokens OAuth 2.0.

- `_load_tokens()` — lê `.tiny_tokens.json`
- `_save_tokens()` — persiste tokens após renovação
- `refresh_access_token()` — chama `POST /token` com `grant_type=refresh_token`
- `get_valid_access_token()` — retorna token válido, renova automaticamente se necessário

**Classe `OlistClient`:** Cliente HTTP autenticado.

- `api_get(endpoint, params)` — GET com retry em 401
- `paginar(endpoint, params)` — itera todas as páginas usando `paginacao.total`

### `fetch_performance.py`

```
Execução: .venv/bin/python fetch_performance.py
```

1. Lista todos os vendedores ativos (`situacao` A ou B) via API
2. Para cada vendedor: busca pedidos do dia e do mês corrente. A lógica do "Faturamento do Mês" espelha o painel da Olist: **soma-se o valor de todos os pedidos criados no mês vigente que não foram cancelados (status `1`).**
3. Calcula quantidade, valor total e ticket médio por período
4. Faz upsert em `performance_cache`
5. Sai com código `1` se todos os vendedores falharem, `0` se ao menos um tiver êxito

### `send_emails.py`

```
Execução: .venv/bin/python send_emails.py
```

1. Consulta `performance_cache` para a data de hoje
2. Para cada vendedora com `recebe_email=1`: gera e envia e-mail individual
3. Para cada admin com `recebe_relatorio=1`: gera e envia e-mail de resumo da equipe
4. Registra cada envio em `email_logs` com UUID de execução
5. Falha de autenticação SMTP aborta todo o lote (`sys.exit(1)`)
6. Erros individuais são registrados mas não interrompem os demais envios

### `email_templates.py`

Gera HTML responsivo e sem métricas irrelevantes (estatísticas diárias não são exibidas para focar no fechamento mensal).

- **`vendedora_html()`** — métricas individuais mensais focadas no faturamento vs metas.
- **`admin_html()`** — tabela consolidada da equipe (1040px max-width), alinhada aos indicadores do dashboard de vendas. O assunto exibe a data formatada como `dd/mm/yyyy`.

### `refresh_tokens.py`

```
Execução automática: service performance-token-refresh (boot)
Execução manual: .venv/bin/python refresh_tokens.py
```

Executado pelo systemd como `oneshot` antes do dashboard iniciar:

1. Lê tokens do `.tiny_tokens.json`
2. Se não há tokens (OAuth não autorizado): loga e encerra sem erro
3. Força renovação do `access_token` via `refresh_token`
4. Se renovação falha (tokens expirados): envia e-mail de alerta aos admins
5. Sempre encerra com código `0` para não bloquear o dashboard

---

## Dashboard Next.js

**Tecnologias:** Next.js 16.2.1, React 19, TypeScript, node-cron, bcryptjs, jsonwebtoken

**Porta:** `3100` (binding em `127.0.0.1`)

**Base Path:** `/performance`

### Autenticação

- JWT armazenado em cookie `httpOnly` com validade de 8 horas
- Middleware protege todas as rotas exceto `/login`, `/api/auth/*`, `/api/olist/callback` e assets estáticos
- Dois papéis: `admin` (acesso total) e `salesperson` (vê apenas própria performance)

### Middleware

O arquivo `middleware.ts` intercepta todas as requisições:

- Verifica cookie `auth_token`
- Redireciona para `/performance/login` se ausente ou inválido
- Libera rotas públicas listadas acima

### Scheduler (node-cron)

Inicializado em `instrumentation.ts` quando o Next.js inicia:

```
instrumentation.ts → reloadScheduler() → node-cron
                                              │
                      (no horário configurado)│
                                              └── POST /api/scripts
                                                  { acao: "fetch_and_send" }
                                                  Header: x-internal-secret: <INTERNAL_SECRET>
```

O header `x-internal-secret` permite que o scheduler execute os scripts sem cookie JWT.

### Páginas

| Rota | Acesso | Descrição |
|---|---|---|
| `/performance/login` | Público | Formulário de login |
| `/performance` | Autenticado | Performance consolidada. Permite ordenação clicando nas colunas da tabela. (Admin vê todos; Vendedora vê só a própria) |
| `/performance/admin` | Admin | Painel de administração completo |

### Painel Admin — Seções

1. **Execução Manual** — botões para Atualizar dados Olist, Enviar e-mails agora, Enviar e-mails só admins ou Atualizar e Enviar; exibe saída do script em terminal
2. **Agendamento** — suporta múltiplos agendamentos, recorrência diária/semanal/mensal, opção de último dia do mês, alerta de conflito de horário e exibe o **Horário atual do Servidor**
3. **Destinatários — Vendedoras** — sincroniza lista da API Olist, define e-mail, gerencia a **Meta do Mês** de cada vendedora, e ativa/desativa envio individual
4. **Destinatários — Admins** — ativa/desativa recebimento do relatório consolidado por usuário admin
5. **Usuários Dashboard** — cria, edita e exclui usuários; altera senhas
6. **Histórico de E-mails** — consulta paginada dos logs com filtros por tipo e status, com opção de **Limpar Histórico**

---

## API Routes

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login com e-mail e senha. Retorna cookie JWT |
| GET | `/api/auth/logout` | Remove cookie e redireciona para `/login` |

### Olist OAuth

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/olist/connect` | Admin | Inicia fluxo OAuth — redireciona para Tiny |
| GET | `/api/olist/callback` | Público | Recebe código, troca por tokens, salva em `.tiny_tokens.json` |
| GET | `/api/olist/status` | Admin | Retorna `connected`, `expired`, `disconnected` ou `unknown` |

### Scripts

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/scripts` | Admin / Internal | `{ acao: "fetch" \| "send" \| "send_admin_only" \| "fetch_and_send" }` |

`fetch_and_send` executa `fetch_performance.py` e, se bem-sucedido, executa `send_emails.py`.

### Agendamento

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/schedule` | Admin | Retorna lista de agendamentos, agendamento principal e horário do servidor |
| POST | `/api/schedule` | Admin | Atualiza todos os agendamentos e recarrega os cron jobs |

### Vendedoras

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/vendedores` | Admin | Lista vendedoras do banco local |
| POST | `/api/vendedores` | Admin | Sincroniza com a API Olist |
| PATCH | `/api/vendedores/[id]` | Admin | Atualiza e-mail e/ou `recebe_email` |

### Usuários

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/users` | Admin | Lista todos os usuários |
| POST | `/api/users` | Admin | Cria usuário (senha mínimo 6 caracteres) |
| PATCH | `/api/users/[id]` | Admin / Próprio | Altera senha ou `recebe_relatorio` |
| DELETE | `/api/users/[id]` | Admin | Remove usuário (com validações) |

Restrições de exclusão:
- Não é possível excluir a si mesmo
- Não é possível excluir o último admin
- Exclusão de admins restrita a usuários privilegiados

### Logs de E-mail

| Método | Rota | Acesso | Parâmetros | Descrição |
|---|---|---|---|---|
| GET | `/api/email-logs` | Admin | `limit` (máx 200), `offset` | Histórico paginado |
| DELETE | `/api/email-logs` | Admin | Nenhum | Apaga todo o histórico da tabela |

---

## Serviços systemd

### `performance-token-refresh.service`

```ini
[Unit]
Description=Renova token Olist na inicialização (Performance)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/betina/performance
EnvironmentFile=/opt/betina/performance/env/performance.env
ExecStart=/opt/betina/performance/.venv/bin/python /opt/betina/performance/refresh_tokens.py
User=www-data
Group=www-data
```

### `performance-dashboard.service`

```ini
[Unit]
Description=Performance Dashboard (Next.js)
After=network.target performance-token-refresh.service
Wants=performance-token-refresh.service

[Service]
Type=simple
WorkingDirectory=/opt/betina/performance/dashboard
EnvironmentFile=/opt/betina/performance/env/performance.env
Environment=NODE_ENV=production
Environment=PORT=3100
Environment=HOSTNAME=127.0.0.1
# Usa a versão otimizada (standalone) com limite de 128MB de RAM para economizar recursos
ExecStart=/usr/bin/npm run start:optimized
Restart=always
RestartSec=5
User=www-data
Group=www-data
```

### Comandos úteis

```bash
# Status dos serviços
systemctl status performance-dashboard
systemctl status performance-token-refresh

# Reiniciar dashboard
systemctl restart performance-dashboard

# Executar refresh de tokens manualmente
systemctl start performance-token-refresh

# Ver logs do dashboard (últimas 100 linhas)
journalctl -u performance-dashboard -n 100

# Ver logs do token refresh
journalctl -u performance-token-refresh -n 50

# Seguir logs em tempo real
journalctl -u performance-dashboard -f
```

---

## Configuração Apache

Arquivo: `/etc/apache2/sites-enabled/betinalimpeza-le-ssl.conf`

```apache
ProxyPass        /performance/ http://127.0.0.1:3100/performance/
ProxyPassReverse /performance/ http://127.0.0.1:3100/performance/
ProxyPass        /performance http://127.0.0.1:3100/performance
ProxyPassReverse /performance http://127.0.0.1:3100/performance
```

Módulos necessários: `proxy`, `proxy_http`, `headers`, `ssl`

---

## Primeiro Acesso

### 1. Configurar OAuth Olist

1. Acesse `https://betinalimpeza.ddns.net/performance` e faça login
2. Vá para o Painel Admin
3. Clique em **"Conectar ao Olist"** — será redirecionado para a Olist/Tiny
4. Autorize o acesso — você voltará automaticamente ao painel
5. O status deverá mostrar **"Conectado"**

### 2. Sincronizar Vendedoras

1. No Painel Admin → **Destinatários — Vendedoras**
2. Clique em **"Sincronizar com Olist"**
3. Configure o e-mail de cada vendedora
4. Ative o toggle **"Recebe E-mail"** para as desejadas

### 3. Configurar Administradores para Relatório

1. No Painel Admin → **Destinatários — Admins**
2. Ative o toggle para cada admin que deve receber o e-mail consolidado

### 4. Configurar Agendamento

1. No Painel Admin → **Agendamento**
2. Adicione um ou mais agendamentos com o botão **"Novo agendamento"**
3. Para recorrência mensal, escolha dia fixo ou ative **"Último dia do mês"**
4. Ative os agendamentos desejados
5. Clique em **"Salvar agendamentos"**

### 5. Testar Manualmente

1. No Painel Admin → **Execução Manual**
2. Clique em **"Atualizar e Enviar"** para ciclo completo ou **"Enviar e-mails só admins"** para envio exclusivo a administradores
3. Acompanhe a saída na área de terminal abaixo dos botões

---

## Operação

### Ciclo Diário Automático

```
[Horário configurado]
    node-cron dispara
        → POST /api/scripts { acao: "fetch_and_send" }
            → fetch_performance.py (busca API Olist → salva SQLite)
            → send_emails.py (SQLite → e-mails SMTP)
```

### Desenvolvimento Local

```bash
cd /opt/betina/performance/dashboard
npm run dev
# Acesse: http://localhost:3100
```

> Em desenvolvimento, `NEXT_PUBLIC_BASE_PATH` é vazio, então a aplicação fica na raiz.

### Rebuild após alterações

```bash
cd /opt/betina/performance/dashboard
npm run build
systemctl restart performance-dashboard
```

### Dependências Python

```bash
cd /opt/betina/performance
.venv/bin/pip install -r requirements.txt
```

---

## Monitoramento e Logs

| Fonte | Localização | Conteúdo |
|---|---|---|
| Log Python | `/opt/betina/performance/performance.log` | Fetch, e-mails, autenticação |
| Journal dashboard | `journalctl -u performance-dashboard` | Saída do Next.js |
| Journal token refresh | `journalctl -u performance-token-refresh` | Resultado da renovação de tokens |
| Banco de dados | Tabela `email_logs` | Histórico de todos os envios |
| Painel web | `/performance/admin` → Histórico | Interface visual dos logs |

---

## Limpeza de Arquivos

Arquivos/pastas que **podem ser removidos com segurança** durante manutenção:

- Artefatos de compilação TypeScript: `dashboard/tsconfig.tsbuildinfo`
- PID temporário local: `dashboard/.dev.pid`
- Scripts de teste pontuais fora da aplicação (`test_*.py` na raiz)

Arquivos que são temporários, mas podem estar em uso e reaparecer automaticamente:

- `database.db-wal`
- `database.db-shm`

Esses dois arquivos pertencem ao modo WAL do SQLite e são recriados automaticamente conforme o banco é aberto.

---

## Fluxo de Dados

```
API Olist (api.tiny.com.br)
    │
    │ GET /vendedores  →  lista vendedores ativos
    │ GET /pedidos     →  pedidos do dia e do mês por vendedor
    │
fetch_performance.py
    │
    │ INSERT OR UPDATE performance_cache
    │
SQLite (database.db)
    │
    │ SELECT performance_cache WHERE data = hoje
    │ SELECT vendedores WHERE recebe_email = 1
    │ SELECT users WHERE role='admin' AND recebe_relatorio = 1
    │
send_emails.py
    │
    │ SMTP_SSL (email-ssl.com.br:465)
    │
E-mails entregues → Vendedoras e Administradores
    │
    │ INSERT email_logs { execucao_id, tipo, destinatario, status }
    │
SQLite (database.db)
```

---

## Recuperação de Falhas

### Tokens Olist Expirados (ex: servidor ficou desligado mais de 7 dias)

O `access_token` Olist expira em ~30 minutos. O `refresh_token` dura vários dias. Em caso de desligamento prolongado:

1. `performance-token-refresh.service` tenta renovar o token no boot
2. Se a renovação falhar, admins com `recebe_relatorio=1` recebem e-mail de alerta
3. Acesse o painel → **"Conectar ao Olist"** para reautorizar manualmente

### Dashboard não inicia

```bash
# Verificar logs
journalctl -u performance-dashboard -n 50

# Verificar se a porta está ocupada
ss -tlnp | grep 3100

# Verificar variáveis de ambiente
systemctl show performance-dashboard | grep Env
```

### E-mails não estão sendo enviados

1. Verifique o log: `tail -100 /opt/betina/performance/performance.log`
2. Consulte a tabela `email_logs` no painel Admin → Histórico
3. Execute manualmente: `sudo -u www-data .venv/bin/python send_emails.py`

### Dados de performance não atualizados

Execute manualmente e observe a saída:

```bash
cd /opt/betina/performance
sudo -u www-data env $(cat .env | grep -v '^#' | xargs) .venv/bin/python fetch_performance.py
```
