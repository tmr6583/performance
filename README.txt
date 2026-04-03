================================================================================
  BETINA PERFORMANCE — DASHBOARD DE DESEMPENHO DE VENDAS
  Documentação Completa
================================================================================

Sistema de monitoramento e reporte de performance de vendas integrado à API
Olist/Tiny ERP v3. Envia e-mails diários de desempenho para cada vendedora e
um resumo consolidado para administradores. Possui painel web para execução
manual, agendamento automático e gerenciamento de usuários.

URL pública: https://betinalimpeza.ddns.net/performance


================================================================================
  ÍNDICE
================================================================================

  1. Visão Geral
  2. Arquitetura
  3. Requisitos
  4. Estrutura de Diretórios
  5. Variáveis de Ambiente
  6. Banco de Dados
  7. Scripts Python
  8. Dashboard Next.js
  9. API Routes
 10. Serviços systemd
 11. Configuração Apache
 12. Primeiro Acesso
 13. Operação
 14. Monitoramento e Logs
 15. Fluxo de Dados
 16. Recuperação de Falhas


================================================================================
  1. VISÃO GERAL
================================================================================

O sistema é composto por duas camadas independentes:

  CAMADA PYTHON
  - Busca dados de pedidos e vendedores na API Olist/Tiny ERP v3
  - Calcula métricas diárias e mensais por vendedora
  - Gera e envia e-mails HTML via SMTP SSL/TLS
  - Scripts executados via linha de comando ou disparados pelo dashboard

  CAMADA DASHBOARD (Next.js)
  - Interface web com autenticação JWT
  - Gerenciamento de usuários, vendedoras e configuração de agendamento
  - Dispara scripts Python via API interna
  - Exibe performance do dia e histórico de e-mails enviados
  - Agendamento automático via node-cron

  COMUNICAÇÃO SMTP
  Host    : email-ssl.com.br
  Porta   : 465
  Segurança: SSL/TLS direto (SMTP_SSL, não STARTTLS)
  Usuário : contato@betinalimpeza.com.br

  INTEGRAÇÃO API
  Provedor: Olist/Tiny ERP v3
  Auth    : OAuth 2.0 Authorization Code Flow
  Base URL: https://api.tiny.com.br/public-api/v3
  Tokens  : access_token (~30 min) + refresh_token (vários dias)


================================================================================
  2. ARQUITETURA
================================================================================

  Internet (HTTPS:443)
         |
    Apache2 (reverse proxy + SSL termination)
         |  /performance/* --> localhost:3200
         |
    Next.js  [performance-dashboard.service]
         |
         +-- middleware.ts     (verificação JWT em todas as rotas)
         +-- App Router        (Server Components + Client Components)
         +-- API Routes (/api/*)
         |       |
         |       +-- POST /api/scripts --> child_process.execFile(python)
         |
         +-- node-cron (scheduler)
                 |
    (no horário configurado)
                 |
                 +--> POST /api/scripts { acao: "fetch_and_send" }
                              |
                 +--> fetch_performance.py --> API Olist --> SQLite
                 +--> send_emails.py       --> SQLite    --> SMTP

  SQLite (database.db)
    Tabelas: users, vendedores, performance_cache, email_logs, schedules

  systemd
    performance-token-refresh.service  (oneshot, executa no boot)
    performance-dashboard.service      (always, inicia após token-refresh)


================================================================================
  3. REQUISITOS
================================================================================

  Sistema Operacional : Ubuntu 24.04 LTS
  Node.js             : 22+ (necessário para node:sqlite experimental)
  Python              : 3.12+
  Apache2             : com módulos proxy, proxy_http, headers, ssl
  SSL                 : Certificado Let's Encrypt ativo
  API Olist           : Aplicação OAuth registrada no painel Tiny ERP
  SMTP                : Servidor com SSL/TLS na porta 465


================================================================================
  4. ESTRUTURA DE DIRETÓRIOS
================================================================================

  /opt/betina/performance/
  |
  +-- .env                        Variáveis de ambiente para scripts Python
  +-- .tiny_tokens.json           Tokens OAuth Olist (gerado automaticamente)
  +-- database.db                 Banco de dados SQLite
  +-- performance.log             Log unificado dos scripts Python
  |
  +-- config.py                   Configurações compartilhadas (Python)
  +-- logger_util.py              Utilitário de logging com arquivo + console
  +-- olist_auth.py               Gerenciamento OAuth 2.0 + cliente HTTP
  +-- fetch_performance.py        Busca métricas na API e salva no SQLite
  +-- send_emails.py              Envia e-mails de performance via SMTP
  +-- email_templates.py          Templates HTML dos e-mails
  +-- refresh_tokens.py           Renovação de tokens na inicialização do SO
  +-- requirements.txt            Dependências Python
  |
  +-- .venv/                      Ambiente virtual Python
  |
  +-- env/
  |   +-- performance.env         Variáveis para o serviço systemd (Next.js)
  |
  +-- dashboard/
      +-- .env.local              Variáveis para desenvolvimento local
      +-- next.config.ts          Configuração Next.js (basePath /performance)
      +-- package.json
      +-- src/
          +-- instrumentation.ts  Inicializa o scheduler no boot do Next.js
          +-- middleware.ts        Proteção de rotas por JWT
          +-- app/
              +-- layout.tsx
              +-- page.tsx         Página principal (performance do dia)
              +-- login/page.tsx
              +-- admin/
              |   +-- page.tsx
              |   +-- AdminClient.tsx
              +-- DashboardClient.tsx
              +-- api/
                  +-- auth/login/route.ts
                  +-- auth/logout/route.ts
                  +-- olist/connect/route.ts
                  +-- olist/callback/route.ts
                  +-- olist/status/route.ts
                  +-- scripts/route.ts
                  +-- schedule/route.ts
                  +-- vendedores/route.ts
                  +-- vendedores/[id]/route.ts
                  +-- users/route.ts
                  +-- users/[id]/route.ts
                  +-- email-logs/route.ts


================================================================================
  5. VARIÁVEIS DE AMBIENTE
================================================================================

  ------------------------------------------------------------------------
  /opt/betina/performance/.env   (usado pelos scripts Python via python-dotenv)
  ------------------------------------------------------------------------

  CLIENT_ID=<Olist Client ID>
  CLIENT_SECRET=<Olist Client Secret>
  OLIST_REDIRECT_URI=https://betinalimpeza.ddns.net/performance/api/olist/callback

  SMTP_HOST=email-ssl.com.br
  SMTP_PORT=465
  SMTP_USER=contato@betinalimpeza.com.br
  SMTP_PASSWORD=<senha SMTP>
  EMAIL_FROM_NAME=Betina Limpeza

  SQLITE_DB_PATH=/opt/betina/performance/database.db

  ------------------------------------------------------------------------
  /opt/betina/performance/env/performance.env   (EnvironmentFile do systemd)
  ------------------------------------------------------------------------

  JWT_SECRET=<string aleatória longa — nunca expor publicamente>
  INTERNAL_SECRET=<outra string aleatória para auth do cron job interno>
  OLIST_CLIENT_ID=<Olist Client ID>
  OLIST_CLIENT_SECRET=<Olist Client Secret>
  OLIST_REDIRECT_URI=https://betinalimpeza.ddns.net/performance/api/olist/callback
  SQLITE_DB_PATH=/opt/betina/performance/database.db
  PERFORMANCE_SCRIPT_DIR=/opt/betina/performance
  NEXT_PUBLIC_BASE_PATH=/performance

  NOTA SOBRE STANDALONE BUILD: O Next.js usa caminho absoluto no SQLITE_DB_PATH
  para garantir que a base não seja duplicada dentro da pasta .next/standalone.

  ------------------------------------------------------------------------
  /opt/betina/performance/dashboard/.env.local  (desenvolvimento local)
  ------------------------------------------------------------------------

  JWT_SECRET=<mesmo JWT_SECRET>
  INTERNAL_SECRET=<mesmo INTERNAL_SECRET>
  NEXT_PUBLIC_BASE_PATH=
  OLIST_CLIENT_ID=<Olist Client ID>
  OLIST_CLIENT_SECRET=<Olist Client Secret>
  OLIST_REDIRECT_URI=http://localhost:3200/api/olist/callback
  SQLITE_DB_PATH=c:\GitHubLocal\performance\database.db

  NOTA: Em desenvolvimento, NEXT_PUBLIC_BASE_PATH é vazio (app fica na raiz).


================================================================================
  6. BANCO DE DADOS
================================================================================

  Arquivo : /opt/betina/performance/database.db
  Engine  : SQLite
  Modo    : WAL (Write-Ahead Logging) para leitura/escrita concorrente
  Timeout : 5000ms de espera em bloqueios

  -----------------------------------------------------------------------
  Tabela: users
  -----------------------------------------------------------------------
  id               INTEGER  PK AUTOINCREMENT
  name             TEXT     Nome do usuário
  email            TEXT     UNIQUE — usado como login
  password         TEXT     Hash bcrypt (custo 10)
  role             TEXT     'admin' ou 'salesperson'
  recebe_relatorio INTEGER  1 = recebe e-mail consolidado da equipe
  created_at       DATETIME Data/hora de criação

  Nota: Na primeira inicialização, um admin padrão é criado com e-mail
  admin@empresa.com e senha aleatória. A senha é impressa uma única vez
  no log do serviço. Consulte:
    journalctl -u performance-dashboard | grep "SENHA TEMPORÁRIA"

  -----------------------------------------------------------------------
  Tabela: vendedores
  -----------------------------------------------------------------------
  id_olist         INTEGER  PK — ID do vendedor na API Olist
  nome             TEXT     Nome (sincronizado via API)
  email            TEXT     E-mail para envio de relatório individual
  recebe_email     INTEGER  1 = recebe e-mail diário de performance
  meta_mensal      REAL     Meta financeira estipulada para o mês
  updated_at       DATETIME Última atualização

  -----------------------------------------------------------------------
  Tabela: performance_cache
  -----------------------------------------------------------------------
  id               INTEGER  PK AUTOINCREMENT
  data             TEXT     Data no formato YYYY-MM-DD
  id_vendedor      INTEGER  ID Olist do vendedor
  nome_vendedor    TEXT     Nome snapshot do vendedor
  pedidos_dia      INTEGER  Quantidade de pedidos no dia
  valor_dia        REAL     Valor total dos pedidos do dia (R$)
  ticket_medio_dia REAL     Ticket médio do dia (R$)
  pedidos_mes      INTEGER  Quantidade de pedidos no mês corrente
  valor_mes        REAL     Valor total do mês (R$)
  ticket_medio_mes REAL     Ticket médio do mês (R$)
  atualizado_em    DATETIME Timestamp da última atualização

  Restrição: UNIQUE(data, id_vendedor)
  Em re-execuções no mesmo dia, os dados são sobrescritos (upsert).

  -----------------------------------------------------------------------
  Tabela: email_logs
  -----------------------------------------------------------------------
  id               INTEGER  PK AUTOINCREMENT
  enviado_em       DATETIME Timestamp do envio
  execucao_id      TEXT     UUID que agrupa todos os envios de uma execução
  tipo             TEXT     'vendedora' ou 'admin'
  destinatario     TEXT     Endereço de e-mail do destinatário
  nome             TEXT     Nome do destinatário
  status           TEXT     'ok' ou 'erro'
  mensagem         TEXT     Detalhe do erro (preenchido quando status='erro')

  -----------------------------------------------------------------------
  Tabela: schedules
  -----------------------------------------------------------------------
  id               INTEGER  PK — fixo em 1 (linha única)
  hora             TEXT     Horário no formato HH:MM (ex: '18:00')
  dias             TEXT     Dias separados por vírgula (ex: 'seg,ter,qua,qui,sex')
  ativo            INTEGER  1 = agendamento ativo, 0 = desativado
  modificado       DATETIME Timestamp da última alteração

  Dias válidos: dom, seg, ter, qua, qui, sex, sab


================================================================================
  7. SCRIPTS PYTHON
================================================================================

  Todos os scripts devem ser executados com o interpretador do venv:
    /opt/betina/performance/.venv/bin/python <script.py>

  -----------------------------------------------------------------------
  config.py
  -----------------------------------------------------------------------
  Carrega o arquivo .env via python-dotenv. Define todas as constantes
  compartilhadas: URLs OAuth/API, parâmetros SMTP, caminhos de arquivo,
  limites de paginação (API_LIMIT=100, API_REQUEST_SLEEP=0.25s).

  -----------------------------------------------------------------------
  logger_util.py
  -----------------------------------------------------------------------
  Cria logger nomeado com saída simultânea para:
  - Console (stdout)
  - Arquivo /opt/betina/performance/performance.log

  Formato: DD/MM/AAAA HH:MM:SS - nome - NÍVEL - mensagem

  -----------------------------------------------------------------------
  olist_auth.py
  -----------------------------------------------------------------------
  Gerencia o ciclo de vida dos tokens OAuth 2.0.

  Classe OlistAuth:
    _load_tokens()           Lê .tiny_tokens.json do disco
    _save_tokens()           Persiste tokens após renovação
    _clear_tokens()          Remove tokens e arquivo em caso de falha
    refresh_access_token()   Chama POST /token com grant_type=refresh_token
    get_valid_access_token() Retorna token válido, renova se necessário

  Classe OlistClient:
    api_get(endpoint, params)   GET autenticado com retry em 401
    paginar(endpoint, params)   Itera todas as páginas via paginacao.total

  Exceção OlistAuthError: lançada quando não há tokens ou renovação falha.

  -----------------------------------------------------------------------
  fetch_performance.py
  -----------------------------------------------------------------------
  Execução: .venv/bin/python fetch_performance.py

  Fluxo:
    1. Lista vendedores ativos (situacao = 'A' ou 'B') via GET /vendedores
    2. Para cada vendedor:
       a. Busca pedidos do dia (dataInicial = dataFinal = hoje)
       b. Busca pedidos do mês (dataInicial = 1º do mês, dataFinal = hoje).
          A lógica espelha o painel da Olist: faturamento é a soma de
          todos os pedidos criados no mês vigente com status 1 (não-cancelado).
       c. Calcula: pedidos, valor total, ticket médio (dia e mês)
       d. Faz upsert em performance_cache
    3. Loga resumo: vendedores processados / com erro

  Códigos de saída:
    0 = pelo menos um vendedor processado com sucesso
    1 = todos os vendedores falharam

  -----------------------------------------------------------------------
  send_emails.py
  -----------------------------------------------------------------------
  Execução: .venv/bin/python send_emails.py

  Fluxo:
    1. Consulta performance_cache WHERE data = hoje
    2. Para cada vendedora com recebe_email=1 e email preenchido:
       - Gera HTML via vendedora_html()
       - Envia via SMTP_SSL (email-ssl.com.br:465)
       - Registra em email_logs (status ok ou erro)
    3. Para cada admin com recebe_relatorio=1:
       - Gera HTML consolidado via admin_html()
       - Envia via SMTP_SSL
       - Registra em email_logs

  Comportamentos especiais:
    - Falha de autenticação SMTP: aborta todo o lote (sys.exit(1))
    - Falha em e-mail individual: registra e continua para o próximo
    - Todos com erro e nenhum com sucesso: sys.exit(1)

  -----------------------------------------------------------------------
  email_templates.py
  -----------------------------------------------------------------------
  Gera HTML responsivo e sem métricas diárias irrelevantes, focando no
  fechamento mensal vs. meta.

  vendedora_html(nome, pedidos_dia, valor_dia, ticket_dia,
                 pedidos_mes, valor_mes, ticket_mes, data)
    - Exibe métricas individuais mensais
    - Layout responsivo com gradiente azul e destaque amarelo

  admin_html(vendedoras[], data)
    - Tabela consolidada da equipe (max-width: 696px)
    - Ordenada por valor_mes decrescente
    - Assunto exibido com data formatada (dd/mm/yyyy)

  Funções auxiliares:
    _fmt_brl(valor)    --> "R$ 1.234,56"
    _fmt_data(dt)      --> "31 de março de 2026"
    _fmt_mes_ano(dt)   --> "março de 2026"

  -----------------------------------------------------------------------
  refresh_tokens.py
  -----------------------------------------------------------------------
  Execução automática: systemd performance-token-refresh.service (boot)
  Execução manual    : .venv/bin/python refresh_tokens.py

  Fluxo:
    1. Lê tokens de .tiny_tokens.json
    2. Se arquivo vazio ou inexistente: loga e encerra (OAuth não autorizado)
    3. Força refresh_access_token() via API Tiny
    4. Se renovação falhar: envia e-mail de alerta a todos os admins
       com recebe_relatorio=1
    5. Sempre encerra com código 0 para não bloquear o dashboard

  O e-mail de alerta contém link direto para o painel de administração
  onde o admin deve clicar em "Conectar ao Olist" para reautorizar.


================================================================================
  8. DASHBOARD NEXT.JS
================================================================================

  Tecnologia : Next.js 16.2.1 com App Router
  React      : 19.0.0
  Linguagem  : TypeScript
  Porta      : 3200 (binding em 127.0.0.1 — não acessível externamente)
  Base Path  : /performance

  -----------------------------------------------------------------------
  Autenticação
  -----------------------------------------------------------------------
  - JWT armazenado em cookie httpOnly (nome: auth_token)
  - Validade: 8 horas
  - Dois papéis: admin e salesperson

  Rotas PÚBLICAS (não requerem JWT):
    /performance/login
    /performance/api/auth/*
    /performance/api/olist/callback
    Arquivos estáticos (_next/*, favicon, etc.)

  Todas as demais rotas exigem cookie JWT válido.

  -----------------------------------------------------------------------
  Middleware (middleware.ts)
  -----------------------------------------------------------------------
  Intercepta todas as requisições antes de chegar às rotas.
  Verifica o cookie auth_token e redireciona para /login se ausente
  ou inválido.

  -----------------------------------------------------------------------
  Scheduler (lib/scheduler.ts + instrumentation.ts)
  -----------------------------------------------------------------------
  Inicializado automaticamente quando o Next.js inicia (instrumentation.ts).

  instrumentation.ts
    register() --> reloadScheduler()  (apenas no runtime Node.js)

  reloadScheduler()
    - Lê configuração da tabela schedules (id=1)
    - Se ativo=1: cria job node-cron com expressão calculada
    - Expressão cron: "MM HH * * DOW" (ex: "0 18 * * 1,2,3,4,5")
    - Mapeamento de dias: dom=0 seg=1 ter=2 qua=3 qui=4 sex=5 sab=6

  Quando o cron dispara:
    triggerSend() --> POST /api/scripts { acao: "fetch_and_send" }
                      Header: x-internal: 1

  O header x-internal: 1 permite execução sem cookie JWT (bypass de auth
  apenas para requisições originadas internamente pelo scheduler).

  -----------------------------------------------------------------------
  Páginas
  -----------------------------------------------------------------------

  /performance/login
    Formulário de login. POST para /api/auth/login. Redireciona para /
    em caso de sucesso.

  /performance  (page.tsx — Server Component)
    - Requer autenticação
    - admin: vê métricas de todos os vendedores do dia
    - salesperson: vê apenas a própria performance (match por e-mail)
    - Exibe KPIs e tabela com possibilidade de ORDENAÇÃO ao clicar nas colunas.
    - Renderiza DashboardClient.tsx

  /performance/admin  (admin/page.tsx)
    - Requer role='admin' (redireciona para / se salesperson)
    - Renderiza AdminClient.tsx

  -----------------------------------------------------------------------
  Painel Admin — Seções (AdminClient.tsx)
  -----------------------------------------------------------------------

  1. EXECUÇÃO MANUAL
     Botões: "Buscar Dados", "Enviar E-mails", "Buscar e Enviar"
     Saída do script exibida em terminal dark abaixo dos botões.

  2. AGENDAMENTO
     Configura hora (HH:MM) e dias da semana (pílulas clicáveis).
     Exibe o horário atual do servidor.
     Toggle para ativar/desativar agendamento.
     Salva via POST /api/schedule e recarrega o cron job imediatamente.

  3. DESTINATÁRIOS — VENDEDORAS
     Lista vendedoras do banco local.
     Botão "Sincronizar com Olist" (POST /api/vendedores).
     Campo de e-mail e campo de "Meta do Mês" editáveis.
     Toggle "Recebe E-mail" por vendedora.

  4. DESTINATÁRIOS — ADMINS
     Lista admins do banco.
     Toggle "Recebe Relatório" por admin.

  5. USUÁRIOS DASHBOARD
     Cria novos usuários (nome, e-mail, senha, papel).
     Altera senhas (admin pode alterar qualquer senha; usuário comum
     precisa confirmar senha atual).
     Remove usuários (com validações de segurança).

  6. HISTÓRICO DE E-MAILS
     Tabela paginada de email_logs.
     Filtros por tipo (vendedora/admin) e status (ok/erro).
     Botão "Limpar Histórico" que executa DELETE /api/email-logs.


================================================================================
  9. API ROUTES
================================================================================

  Base: https://betinalimpeza.ddns.net/performance/api

  -----------------------------------------------------------------------
  Autenticação
  -----------------------------------------------------------------------
  POST /auth/login
    Body: { email, password }
    Retorna: cookie auth_token (JWT, httpOnly, 8h)
    Erro 401: credenciais inválidas

  GET /auth/logout
    Remove cookie auth_token, redireciona para /login

  -----------------------------------------------------------------------
  Olist OAuth
  -----------------------------------------------------------------------
  GET /olist/connect          [admin]
    Redireciona para accounts.tiny.com.br para autorização OAuth.

  GET /olist/callback         [público]
    Recebe código de autorização, troca por tokens via POST /token.
    Salva tokens em .tiny_tokens.json.
    Redireciona para /admin após sucesso.

  GET /olist/status           [admin]
    Verifica status da conexão Olist.
    Retorna: { status: "connected" | "expired" | "disconnected" | "unknown" }

  -----------------------------------------------------------------------
  Scripts
  -----------------------------------------------------------------------
  POST /api/scripts           [admin ou x-internal: 1]
    Body: { acao: "fetch" | "send" | "fetch_and_send" }

    fetch         : executa fetch_performance.py
    send          : executa send_emails.py
    fetch_and_send: executa fetch_performance.py; se OK, executa send_emails.py

    Timeout: 5 minutos por script.
    Retorna: { success, code, output, step? }

  -----------------------------------------------------------------------
  Agendamento
  -----------------------------------------------------------------------
  GET /api/schedule           [admin]
    Retorna: { hora, dias, ativo }

  POST /api/schedule          [admin]
    Body: { hora, dias, ativo }
    Salva no banco e recarrega node-cron.
    Retorna: { success: true }

  -----------------------------------------------------------------------
  Vendedoras
  -----------------------------------------------------------------------
  GET /api/vendedores         [admin]
    Retorna lista de vendedores do banco local.

  POST /api/vendedores        [admin]
    Sincroniza com a API Olist:
    - Busca todos os vendedores ativos
    - Insere novos (preserva email e recebe_email existentes)
    - Atualiza nomes
    Retorna: { success, total, novos, ja_existentes }

  PATCH /api/vendedores/[id]  [admin]
    Body: { email?, recebe_email? }
    Atualiza e-mail e/ou flag de envio.
    Retorna: { success: true }

  -----------------------------------------------------------------------
  Usuários
  -----------------------------------------------------------------------
  GET /api/users              [admin]
    Retorna: [{ id, name, email, role, recebe_relatorio, created_at }]

  POST /api/users             [admin]
    Body: { name, email, password, role }
    Senha mínima: 6 caracteres. Hash bcrypt aplicado automaticamente.
    Retorna: usuário criado (sem campo password)

  PATCH /api/users/[id]       [admin ou próprio usuário]
    Troca de senha:
      Admin: body { password } — sem verificação da senha atual
      Próprio: body { currentPassword, password }
    Toggle recebe_relatorio (admin only): body { recebe_relatorio }
    Retorna: { success: true }

  DELETE /api/users/[id]      [admin]
    Restrições:
    - Não é possível excluir a si mesmo
    - Não é possível excluir o último admin
    - Exclusão de admins restrita a usuários privilegiados
    Retorna: { success: true }

  -----------------------------------------------------------------------
  Logs de E-mail
  -----------------------------------------------------------------------
  GET /api/email-logs         [admin]
    Query params:
      tipo    : "vendedora" | "admin"  (opcional)
      status  : "ok" | "erro"          (opcional)
      limit   : número, máximo 200     (padrão: 50)
      offset  : número                 (padrão: 0)
    Retorna: { total, rows: [...] }


================================================================================
  10. SERVIÇOS SYSTEMD
================================================================================

  -----------------------------------------------------------------------
  performance-token-refresh.service
  /etc/systemd/system/performance-token-refresh.service
  -----------------------------------------------------------------------

  [Unit]
  Description=Renova token Olist na inicialização (Performance)
  After=network-online.target
  Wants=network-online.target

  [Service]
  Type=oneshot
  WorkingDirectory=/opt/betina/performance
  EnvironmentFile=/opt/betina/performance/env/performance.env
  ExecStart=/opt/betina/performance/.venv/bin/python \
            /opt/betina/performance/refresh_tokens.py
  User=www-data
  Group=www-data
  StandardOutput=journal
  StandardError=journal

  [Install]
  WantedBy=multi-user.target

  Comportamento:
  - Type=oneshot: executa uma vez no boot e encerra
  - Aguarda rede completamente disponível (network-online.target)
  - Tenta renovar access_token; se falhar, notifica admins por e-mail
  - Sempre encerra com código 0 (não bloqueia o dashboard)

  -----------------------------------------------------------------------
  performance-dashboard.service
  /etc/systemd/system/performance-dashboard.service
  /etc/systemd/system/performance-dashboard.service.d/override.conf
  -----------------------------------------------------------------------

  [Unit]
  Description=Performance Dashboard (Next.js)
  After=network.target performance-token-refresh.service
  Wants=performance-token-refresh.service

  [Service]
  Type=simple
  WorkingDirectory=/opt/betina/performance/dashboard
  EnvironmentFile=/opt/betina/performance/env/performance.env
  Environment=NODE_ENV=production
  Environment=PORT=3200
  Environment=HOSTNAME=127.0.0.1
  # Usa a versão otimizada (standalone) com limite de 128MB de RAM para economizar recursos
  ExecStart=/usr/bin/npm run start:optimized
  Restart=always
  RestartSec=5
  User=www-data
  Group=www-data

  [Install]
  WantedBy=multi-user.target

  Comportamento:
  - Inicia APÓS performance-token-refresh.service concluir
  - Usa versão build 'standalone' otimizada (npm run start:optimized)
  - Limite rígido de memória via flag --max-old-space-size=128
  - Binding em 127.0.0.1:3200 (não exposto diretamente na internet)
  - Reinicia automaticamente em caso de falha (intervalo 5s)
  - Carrega variáveis de performance.env

  -----------------------------------------------------------------------
  Comandos de Gerenciamento
  -----------------------------------------------------------------------

  # Verificar status
  systemctl status performance-dashboard
  systemctl status performance-token-refresh

  # Iniciar / parar / reiniciar
  systemctl start performance-dashboard
  systemctl stop performance-dashboard
  systemctl restart performance-dashboard

  # Executar refresh de tokens manualmente
  systemctl start performance-token-refresh

  # Habilitar inicialização automática no boot
  systemctl enable performance-dashboard
  systemctl enable performance-token-refresh

  # Ver logs do dashboard (últimas 100 linhas)
  journalctl -u performance-dashboard -n 100

  # Ver logs do token refresh
  journalctl -u performance-token-refresh -n 50

  # Seguir logs em tempo real
  journalctl -u performance-dashboard -f


================================================================================
  11. CONFIGURAÇÃO APACHE
================================================================================

  Arquivo: /etc/apache2/sites-enabled/betinalimpeza-le-ssl.conf

  Bloco relevante para o Performance:

    ProxyPass        /performance/ http://127.0.0.1:3200/performance/
    ProxyPassReverse /performance/ http://127.0.0.1:3200/performance/
    ProxyPass        /performance  http://127.0.0.1:3200/performance
    ProxyPassReverse /performance  http://127.0.0.1:3200/performance

  As duas linhas duplicadas (com e sem barra final) garantem que tanto
  /performance quanto /performance/ sejam roteados corretamente.

  Apache termina HTTPS e proxia HTTP puro para o Next.js internamente.

  Módulos necessários:
    a2enmod proxy proxy_http headers ssl
    systemctl reload apache2

  Verificar se módulos estão ativos:
    apache2ctl -M | grep proxy


================================================================================
  12. PRIMEIRO ACESSO
================================================================================

  -----------------------------------------------------------------------
  Passo 1 — Recuperar senha do admin padrão
  -----------------------------------------------------------------------
  Na primeira inicialização, o sistema cria o usuário:
    E-mail : admin@empresa.com
    Senha  : gerada aleatoriamente (16 caracteres hexadecimais)

  Para ver a senha gerada:
    journalctl -u performance-dashboard | grep "SENHA TEMPORÁRIA"

  Troque a senha imediatamente após o primeiro login.

  -----------------------------------------------------------------------
  Passo 2 — Conectar ao Olist (OAuth)
  -----------------------------------------------------------------------
  1. Acesse https://betinalimpeza.ddns.net/performance
  2. Faça login com admin@empresa.com e a senha temporária
  3. Vá para o Painel Admin (ícone de engrenagem ou menu)
  4. Clique em "Conectar ao Olist"
  5. Você será redirecionado para a Tiny — autorize o acesso
  6. Após autorização, você voltará ao painel automaticamente
  7. O indicador de status deve mostrar "Conectado"

  -----------------------------------------------------------------------
  Passo 3 — Sincronizar Vendedoras
  -----------------------------------------------------------------------
  1. No Painel Admin > seção "Destinatários — Vendedoras"
  2. Clique em "Sincronizar com Olist"
  3. A lista de vendedoras ativas da Tiny será importada
  4. Configure o e-mail de cada vendedora no campo correspondente
  5. Ative o toggle "Recebe E-mail" para as vendedoras desejadas

  -----------------------------------------------------------------------
  Passo 4 — Configurar Destinatários Admin
  -----------------------------------------------------------------------
  1. No Painel Admin > seção "Destinatários — Admins"
  2. Ative o toggle "Recebe Relatório" para cada admin que deve
     receber o e-mail consolidado da equipe

  -----------------------------------------------------------------------
  Passo 5 — Configurar Agendamento
  -----------------------------------------------------------------------
  1. No Painel Admin > seção "Agendamento"
  2. Defina o horário (recomendado: 18:00)
  3. Selecione os dias da semana (clique nas pílulas)
  4. Ative o agendamento com o toggle
  5. Clique em "Salvar Agendamento"

  -----------------------------------------------------------------------
  Passo 6 — Testar o Sistema
  -----------------------------------------------------------------------
  1. No Painel Admin > seção "Execução Manual"
  2. Clique em "Buscar e Enviar"
  3. Aguarde a execução (pode levar 1-2 minutos dependendo do volume)
  4. Verifique a saída na área de terminal
  5. Confirme o recebimento dos e-mails

  -----------------------------------------------------------------------
  Passo 7 — Criar Usuários para Vendedoras (opcional)
  -----------------------------------------------------------------------
  Para que vendedoras acessem o dashboard e vejam sua própria performance:
  1. No Painel Admin > seção "Usuários Dashboard"
  2. Crie um usuário com:
     - Role: salesperson
     - E-mail: MESMO e-mail configurado para a vendedora
       (o match é feito por e-mail)
  3. A vendedora fará login e verá apenas seus próprios dados


================================================================================
  13. OPERAÇÃO
================================================================================

  -----------------------------------------------------------------------
  Ciclo Automático Diário
  -----------------------------------------------------------------------

  [Horário configurado, ex: 18:00]
       |
  node-cron dispara
       |
  POST /api/scripts { acao: "fetch_and_send" }
  Header: x-internal: 1
       |
       +-- fetch_performance.py
       |       |
       |       +-- GET /vendedores (API Olist)
       |       +-- GET /pedidos por vendedor (dia e mês)
       |       +-- UPSERT performance_cache (SQLite)
       |
       +-- (somente se fetch OK)
       |
       +-- send_emails.py
               |
               +-- SELECT performance_cache WHERE data = hoje
               +-- Para cada vendedora com recebe_email=1:
               |       SMTP SSL → e-mail individual
               +-- Para cada admin com recebe_relatorio=1:
                       SMTP SSL → e-mail consolidado
               +-- INSERT email_logs (resultado de cada envio)

  -----------------------------------------------------------------------
  Execução Manual
  -----------------------------------------------------------------------
  Via painel web (recomendado):
    Admin > Execução Manual > botão desejado

  Via linha de comando:
    cd /opt/betina/performance
    sudo -u www-data env $(cat .env | grep -v '^#' | xargs) \
      .venv/bin/python fetch_performance.py
    sudo -u www-data env $(cat .env | grep -v '^#' | xargs) \
      .venv/bin/python send_emails.py

  -----------------------------------------------------------------------
  Desenvolvimento Local
  -----------------------------------------------------------------------
    cd /opt/betina/performance/dashboard
    npm run dev
    # Acesse: http://localhost:3200

  -----------------------------------------------------------------------
  Rebuild após alterações no código
  -----------------------------------------------------------------------
    cd /opt/betina/performance/dashboard
    npm run build
    systemctl restart performance-dashboard

  -----------------------------------------------------------------------
  Atualizar dependências Python
  -----------------------------------------------------------------------
    cd /opt/betina/performance
    .venv/bin/pip install -r requirements.txt

  -----------------------------------------------------------------------
  Atualizar dependências Node.js
  -----------------------------------------------------------------------
    cd /opt/betina/performance/dashboard
    npm install
    npm run build
    systemctl restart performance-dashboard


================================================================================
  14. MONITORAMENTO E LOGS
================================================================================

  FONTE                     LOCALIZAÇÃO / COMANDO
  ------------------------  ------------------------------------------------
  Log Python                /opt/betina/performance/performance.log
  Journal dashboard         journalctl -u performance-dashboard
  Journal token refresh     journalctl -u performance-token-refresh
  Histórico e-mails (web)   /performance/admin > seção Histórico
  Banco de dados            Tabela email_logs em database.db

  Comandos úteis de diagnóstico:

  # Verificar status dos serviços
  systemctl status performance-dashboard performance-token-refresh

  # Últimas 50 linhas do log Python
  tail -50 /opt/betina/performance/performance.log

  # Logs do dashboard em tempo real
  journalctl -u performance-dashboard -f

  # Verificar se o Next.js está ouvindo na porta 3200
  ss -tlnp | grep 3200

  # Verificar se o Apache está com mod_proxy ativo
  apache2ctl -M | grep proxy

  # Testar conexão interna do Apache ao Next.js
  curl -s http://127.0.0.1:3200/performance | head -20

  # Consultar últimos e-mails enviados (Node.js)
  node -e "
    const {DatabaseSync} = require('node:sqlite');
    const db = new DatabaseSync('/opt/betina/performance/database.db');
    const rows = db.prepare(
      'SELECT * FROM email_logs ORDER BY enviado_em DESC LIMIT 10'
    ).all();
    console.table(rows);
  "


================================================================================
  15. FLUXO DE DADOS
================================================================================

  ┌─────────────────────────────────────────────────────────────────────┐
  │  API Olist (api.tiny.com.br/public-api/v3)                         │
  │  GET /vendedores  →  lista vendedores com situacao A ou B          │
  │  GET /pedidos     →  pedidos filtrados por vendedor e data         │
  └───────────────────────────────┬─────────────────────────────────────┘
                                  │ OlistClient.paginar()
                                  │ (paginação automática até total)
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  fetch_performance.py                                               │
  │  - Calcula pedidos, valor total, ticket médio (dia e mês)          │
  │  - INSERT OR UPDATE performance_cache ON CONFLICT(data,id_vendedor) │
  └───────────────────────────────┬─────────────────────────────────────┘
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  SQLite — database.db                                               │
  │  Tabela: performance_cache                                          │
  └──────────┬────────────────────────────────────────┬────────────────┘
             │ SELECT WHERE data = hoje               │
             │ JOIN vendedores (recebe_email=1)        │ JOIN users
             ▼                                        │ (recebe_relatorio=1)
  ┌──────────────────────────┐             ┌──────────▼─────────────────┐
  │  E-mail Individual       │             │  E-mail Consolidado (Admin) │
  │  vendedora_html()        │             │  admin_html()               │
  │  - Métricas do dia       │             │  - Tabela toda equipe       │
  │  - Métricas do mês       │             │  - KPIs totalizadores       │
  │  - Alerta se sem pedidos │             │  - Ordenado por valor_mes   │
  └──────────┬───────────────┘             └──────────┬─────────────────┘
             │                                        │
             └────────────────┬───────────────────────┘
                              │ smtplib.SMTP_SSL(email-ssl.com.br:465)
                              ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │  E-mails entregues                                                  │
  │  INSERT email_logs { execucao_id, tipo, destinatario, status }     │
  └─────────────────────────────────────────────────────────────────────┘


================================================================================
  16. RECUPERAÇÃO DE FALHAS
================================================================================

  -----------------------------------------------------------------------
  TOKENS OLIST EXPIRADOS
  (servidor ficou desligado por período prolongado)
  -----------------------------------------------------------------------
  Sintoma: scripts falham com "OlistAuthError: Token expirado"
           ou "Refresh token não disponível"

  Causa: access_token expira em ~30 minutos; refresh_token em vários dias.
         Servidor desligado no fim de semana geralmente não é problema,
         pois o refresh_token sobrevive. Porém desligamentos de semanas
         podem expirar ambos.

  Solução automática (boot):
    performance-token-refresh.service tenta renovar no boot.
    Se falhar, e-mail de alerta é enviado aos admins.

  Solução manual:
    1. Acesse https://betinalimpeza.ddns.net/performance/admin
    2. Clique em "Conectar ao Olist"
    3. Autorize novamente na Tiny

  -----------------------------------------------------------------------
  DASHBOARD NÃO INICIA
  -----------------------------------------------------------------------
  Diagnóstico:
    journalctl -u performance-dashboard -n 50
    systemctl status performance-dashboard

  Causas comuns:
    - JWT_SECRET não definido no performance.env
    - Porta 3200 ocupada por outro processo
    - Falha no build do Next.js (arquivos .next/ ausentes ou corrompidos)

  Soluções:
    # Verificar porta
    ss -tlnp | grep 3200

    # Rebuild completo
    cd /opt/betina/performance/dashboard
    npm run build
    systemctl restart performance-dashboard

  -----------------------------------------------------------------------
  E-MAILS NÃO ESTÃO SENDO ENVIADOS
  -----------------------------------------------------------------------
  Diagnóstico:
    tail -100 /opt/betina/performance/performance.log
    # Ou via painel: Admin > Histórico de E-mails

  Causas comuns:
    - SMTP_PASSWORD incorreto no .env
    - Conexão bloqueada por firewall na porta 465
    - Vendedoras sem e-mail configurado no banco

  Teste manual:
    cd /opt/betina/performance
    sudo -u www-data env $(cat .env | grep -v '^#' | xargs) \
      .venv/bin/python send_emails.py

  -----------------------------------------------------------------------
  DADOS DE PERFORMANCE NÃO ATUALIZADOS
  -----------------------------------------------------------------------
  Diagnóstico:
    tail -100 /opt/betina/performance/performance.log

  Causas comuns:
    - Tokens Olist expirados (ver seção acima)
    - Erro na API Olist (timeout, manutenção)
    - Agendamento desativado no painel

  Teste manual:
    cd /opt/betina/performance
    sudo -u www-data env $(cat .env | grep -v '^#' | xargs) \
      .venv/bin/python fetch_performance.py

  -----------------------------------------------------------------------
  SENHA DO ADMIN PERDIDA
  -----------------------------------------------------------------------
  Redefina diretamente no banco via Node.js:

    node -e "
      const {DatabaseSync} = require('node:sqlite');
      const bcrypt = require('/opt/betina/performance/dashboard/node_modules/bcryptjs');
      const db = new DatabaseSync('/opt/betina/performance/database.db');
      const hash = bcrypt.hashSync('nova_senha_aqui', 10);
      db.prepare(\"UPDATE users SET password=? WHERE email='admin@empresa.com'\")
        .run(hash);
      console.log('Senha redefinida com sucesso.');
    "

  -----------------------------------------------------------------------
  BANCO DE DADOS CORROMPIDO OU BLOQUEADO
  -----------------------------------------------------------------------
  O WAL mode e o busy_timeout de 5s protegem contra a maioria dos casos.

  Para verificar integridade:
    node -e "
      const {DatabaseSync} = require('node:sqlite');
      const db = new DatabaseSync('/opt/betina/performance/database.db');
      const r = db.prepare('PRAGMA integrity_check').get();
      console.log(r);
    "

  Se o banco estiver bloqueado por um processo travado:
    fuser /opt/betina/performance/database.db
    # Encerre o processo com kill <PID> se necessário


================================================================================
  FIM DA DOCUMENTAÇÃO
================================================================================

  Projeto  : Betina Performance
  Versão   : 1.0
  Servidor : Ubuntu 24.04 LTS — AWS
  Data     : março de 2026
  Contato  : contato@betinalimpeza.com.br
