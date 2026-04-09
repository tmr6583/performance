# RUNBOOK — Migração da aplicação para Linux Ubuntu 24.04 LTS

## 1) Objetivo

Este runbook foi escrito para ser executado por **outra IA** (ou operador técnico) e contém tudo o que é necessário para migrar a aplicação **Performance** do ambiente atual para **Ubuntu 24.04 LTS**.

O foco é:

- preservar dados e credenciais;
- manter o comportamento funcional atual;
- reduzir risco de indisponibilidade;
- permitir rollback rápido.

---

## 2) Escopo da aplicação

A solução possui dois blocos principais:

- **Dashboard**: Next.js 16 + React 19 + TypeScript;
- **Automação**: scripts Python 3.12 para coleta Olist e envio de e-mails.

Componentes críticos:

- Banco SQLite compartilhado: `database.db`;
- Tokens OAuth Olist: `.tiny_tokens.json`;
- Configurações sensíveis: `.env` e `env/performance.env`;
- Scheduler com `node-cron` inicializado no boot do servidor Next.js;
- Serviços `systemd` para token refresh e dashboard;
- Apache como reverse proxy para `/performance` na porta interna `3100`.

---

## 3) Arquivos e caminhos de referência

### 3.1 Origem (estrutura de projeto)

- `./dashboard/` — app Next.js
- `./fetch_performance.py` — coleta dados Olist
- `./send_emails.py` — envio de e-mails
- `./refresh_tokens.py` — renovação de token no boot
- `./database.db` — base SQLite (produção)
- `./.tiny_tokens.json` — tokens Oauth
- `./.env` — variáveis Python
- `./env/performance.env` — variáveis do serviço Next.js/systemd

### 3.2 Destino (Ubuntu 24)

Usar este layout no servidor:

```text
/opt/betina/performance/
├── .env
├── .tiny_tokens.json
├── database.db
├── env/performance.env
├── .venv/
└── dashboard/
```

---

## 4) Requisitos de sistema (Ubuntu 24.04)

- Ubuntu 24.04 LTS;
- Node.js 24.x (recomendado para compatibilidade com `node:sqlite`);
- npm compatível com Node 24;
- Python 3.12 + venv;
- Apache2;
- OpenSSL/CA padrão do sistema;
- acesso de rede HTTPS para Olist e SMTP.

Pacotes recomendados:

```bash
sudo apt update
sudo apt install -y curl git unzip apache2 python3.12 python3.12-venv python3-pip
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 5) Variáveis obrigatórias

### 5.1 `/opt/betina/performance/.env` (Python)

```ini
CLIENT_ID=<olist_client_id>
CLIENT_SECRET=<olist_client_secret>
OLIST_REDIRECT_URI=https://<dominio>/performance/api/olist/callback

SMTP_HOST=<smtp_host>
SMTP_PORT=465
SMTP_USER=<smtp_user>
SMTP_PASSWORD=<smtp_password>
EMAIL_FROM_NAME=<nome_exibicao_email>

SQLITE_DB_PATH=/opt/betina/performance/database.db
```

### 5.2 `/opt/betina/performance/env/performance.env` (systemd/Next.js)

```ini
JWT_SECRET=<jwt_secret_forte>
INTERNAL_SECRET=<internal_secret_forte>

OLIST_CLIENT_ID=<olist_client_id>
OLIST_CLIENT_SECRET=<olist_client_secret>
OLIST_REDIRECT_URI=https://<dominio>/performance/api/olist/callback

SQLITE_DB_PATH=/opt/betina/performance/database.db
PERFORMANCE_SCRIPT_DIR=/opt/betina/performance
NEXT_PUBLIC_BASE_PATH=/performance

NODE_ENV=production
PORT=3100
HOSTNAME=127.0.0.1
TZ=America/Sao_Paulo
APP_PORTAL_URL=https://<dominio>

APP_VERBOSE_LOGS=0
APP_ENABLE_CLUSTER=0
APP_WORKERS=1
APP_REQUEST_TIMEOUT_MS=30000
APP_KEEP_ALIVE_TIMEOUT_MS=5000
APP_MAX_PAYLOAD_MB=1
APP_GC_INTERVAL_MS=120000
APP_HTTP_MAX_CONNECTIONS=8
NODE_OPTIONS=--max-old-space-size=192 --expose-gc
```

---

## 6) Checklist pré-migração

Antes de qualquer alteração no ambiente destino:

- confirmar backup íntegro de:
  - `database.db`
  - `.tiny_tokens.json`
  - `.env`
  - `env/performance.env`
- confirmar domínio e certificado SSL válidos;
- confirmar credenciais SMTP e OAuth válidas;
- confirmar versão Node >= 24 e Python 3.12 no destino;
- confirmar que o serviço `atrasados.service` (porta 3000) está saudável antes da mudança;
- confirmar plano de rollback pronto;
- confirmar janela de mudança.

Backup sugerido no servidor origem:

```bash
mkdir -p /tmp/performance_backup_$(date +%F)
cp -a /opt/betina/performance/database.db /tmp/performance_backup_$(date +%F)/
cp -a /opt/betina/performance/.tiny_tokens.json /tmp/performance_backup_$(date +%F)/ 2>/dev/null || true
cp -a /opt/betina/performance/.env /tmp/performance_backup_$(date +%F)/
cp -a /opt/betina/performance/env/performance.env /tmp/performance_backup_$(date +%F)/
tar -czf /tmp/performance_backup_$(date +%F).tar.gz /tmp/performance_backup_$(date +%F)
```

---

## 7) Procedimento de migração (passo a passo)

## Etapa A — Provisionar destino

```bash
sudo mkdir -p /opt/betina/performance
sudo mkdir -p /opt/betina/performance/env
sudo chown -R www-data:www-data /opt/betina/performance
```

## Etapa B — Publicar código

```bash
cd /opt/betina
sudo -u www-data git clone <repo_url> performance
cd /opt/betina/performance
```

## Etapa C — Restaurar dados e segredos

```bash
sudo -u www-data cp /caminho_seguro/database.db /opt/betina/performance/database.db
sudo -u www-data cp /caminho_seguro/.tiny_tokens.json /opt/betina/performance/.tiny_tokens.json
sudo -u www-data cp /caminho_seguro/.env /opt/betina/performance/.env
sudo -u www-data cp /caminho_seguro/performance.env /opt/betina/performance/env/performance.env
sudo chmod 600 /opt/betina/performance/.env /opt/betina/performance/env/performance.env /opt/betina/performance/.tiny_tokens.json
```

## Etapa D — Instalar Python

```bash
cd /opt/betina/performance
sudo -u www-data python3.12 -m venv .venv
sudo -u www-data .venv/bin/pip install --upgrade pip
sudo -u www-data .venv/bin/pip install -r requirements.txt
```

## Etapa E — Instalar/buildar Dashboard

```bash
cd /opt/betina/performance/dashboard
sudo -u www-data npm ci
sudo -u www-data npm run build
```

## Etapa F — Criar serviços systemd

Criar `/etc/systemd/system/performance-token-refresh.service`:

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

[Install]
WantedBy=multi-user.target
```

Criar `/etc/systemd/system/performance-dashboard.service`:

```ini
[Unit]
Description=Performance Dashboard (Next.js)
After=network.target performance-token-refresh.service
Wants=performance-token-refresh.service

[Service]
Type=simple
WorkingDirectory=/opt/betina/performance/dashboard
EnvironmentFile=/opt/betina/performance/env/performance.env
ExecStart=/usr/bin/npm run start:optimized
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Aplicar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable performance-token-refresh
sudo systemctl enable performance-dashboard
sudo systemctl start performance-token-refresh
sudo systemctl start performance-dashboard
```

## Etapa G — Configurar Apache reverse proxy

Módulos:

```bash
sudo a2enmod proxy proxy_http headers ssl rewrite
```

No VirtualHost SSL do domínio:

```apache
ProxyPass        /performance/ http://127.0.0.1:3100/performance/
ProxyPassReverse /performance/ http://127.0.0.1:3100/performance/
ProxyPass        /performance  http://127.0.0.1:3100/performance
ProxyPassReverse /performance  http://127.0.0.1:3100/performance
```

Recarregar Apache:

```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

Observação operacional:

- É permitido reiniciar o Apache se necessário durante a janela de mudança;
- as alterações devem ficar restritas ao bloco `/performance`, sem impacto no roteamento do serviço `atrasados` (porta 3000).

## Etapa H — Atualizar portal de serviços

Arquivo: `/opt/betina/index.html`

- O card **"Envio de Performance de Vendas"** deve apontar para:

```html
<a href="/performance/" class="card">
```

- Não alterar os links do serviço de `atrasados`.

---

## 8) Validação pós-migração

## 8.1 Técnica

```bash
systemctl status performance-token-refresh --no-pager
systemctl status performance-dashboard --no-pager
journalctl -u performance-dashboard -n 100 --no-pager
journalctl -u performance-token-refresh -n 50 --no-pager
curl -I http://127.0.0.1:3100/performance/login
curl -I https://<dominio>/performance/login
```

## 8.2 Funcional

Validar manualmente:

- login admin;
- página `/performance`;
- página `/performance/admin`;
- execução manual `fetch`;
- execução manual `send`;
- execução manual `send_admin_only`;
- status OAuth conectado;
- gravação em `email_logs`;
- agendamentos múltiplos visíveis e persistindo.
- card do portal **"Envio de Performance de Vendas"** abrindo `/performance/`;
- botão **"Sair"** do dashboard redirecionando para a página inicial do portal (`/`) após logoff.

---

## 9) Riscos conhecidos e mitigação

### Risco 1 — Falha de bootstrap SQLite em ambiente novo

Há um ponto de atenção na inicialização do banco relacionado à ordem de operações com `login_attempts`. Mitigar com validação prévia em staging e ajuste de ordem no código se necessário.

### Risco 2 — Caminho incorreto do SQLite

Se `SQLITE_DB_PATH` ficar relativo, pode gerar base paralela. Mitigar sempre com caminho absoluto:

```ini
SQLITE_DB_PATH=/opt/betina/performance/database.db
```

### Risco 3 — OAuth callback divergente

Se `OLIST_REDIRECT_URI` não bater com o cadastrado na Olist, login OAuth falha. Garantir igualdade exata.

### Risco 4 — Permissões

Sem permissão de escrita em `/opt/betina/performance`, SQLite WAL/SHM e logs falham. Garantir owner/grupo corretos para o usuário de serviço.

---

## 10) Plano de rollback

Se houver falha após cutover:

1. parar serviços no novo servidor:

```bash
sudo systemctl stop performance-dashboard
sudo systemctl stop performance-token-refresh
```

2. reverter tráfego/DNS para servidor antigo;
3. restaurar `database.db` e `.tiny_tokens.json` no ambiente antigo se houve alteração;
4. reiniciar serviços no antigo;
5. validar login, dashboard e envios.

---

## 11) Critérios de aceite da migração

Migração é considerada concluída apenas se:

- aplicação acessível em `https://<dominio>/performance`;
- login admin funcional;
- dashboard exibe dados atuais;
- envio de e-mails funciona em modo normal e admin-only;
- scheduler ativo e disparando no horário;
- logs sem erros críticos recorrentes por ao menos 1 ciclo completo de operação.

---

## 12) Instruções para outra IA operar este runbook

A IA executora deve seguir estas regras:

- executar etapas na ordem;
- parar imediatamente em erro crítico;
- registrar saída de cada comando;
- nunca sobrescrever backups;
- nunca expor segredos em logs de resposta;
- só iniciar cutover após validação técnica e funcional completa;
- ter rollback pronto antes de alterar DNS/proxy.

---

## 13) Comandos de operação contínua

```bash
# status
systemctl status performance-dashboard
systemctl status performance-token-refresh

# reiniciar dashboard
systemctl restart performance-dashboard

# rodar refresh de token manual
systemctl start performance-token-refresh

# logs
journalctl -u performance-dashboard -f
journalctl -u performance-token-refresh -f
```

