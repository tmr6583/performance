# CHECKLIST RÁPIDO — Migração para Ubuntu 24.04

## 1) Preparação

- Confirmar janela de migração e responsável por rollback.
- Confirmar acesso SSH com sudo no servidor novo.
- Confirmar domínio, SSL e callback OAuth válidos.
- Confirmar que o `atrasados.service` (porta 3000) está ativo e saudável.
- Confirmar backups de:
  - `/opt/betina/performance/database.db`
  - `/opt/betina/performance/.tiny_tokens.json`
  - `/opt/betina/performance/.env`
  - `/opt/betina/performance/env/performance.env`

## 2) Provisionar Ubuntu 24

```bash
sudo apt update
sudo apt install -y curl git unzip apache2 python3.12 python3.12-venv python3-pip
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3) Estrutura base

```bash
sudo mkdir -p /opt/betina/performance/env
sudo chown -R www-data:www-data /opt/betina/performance
```

## 4) Código + dados

```bash
cd /opt/betina
sudo -u www-data git clone <repo_url> performance
sudo -u www-data cp /caminho_seguro/database.db /opt/betina/performance/database.db
sudo -u www-data cp /caminho_seguro/.tiny_tokens.json /opt/betina/performance/.tiny_tokens.json
sudo -u www-data cp /caminho_seguro/.env /opt/betina/performance/.env
sudo -u www-data cp /caminho_seguro/performance.env /opt/betina/performance/env/performance.env
sudo chmod 600 /opt/betina/performance/.env /opt/betina/performance/.tiny_tokens.json /opt/betina/performance/env/performance.env
```

## 5) Instalar dependências

```bash
cd /opt/betina/performance
sudo -u www-data python3.12 -m venv .venv
sudo -u www-data .venv/bin/pip install --upgrade pip
sudo -u www-data .venv/bin/pip install -r requirements.txt

cd /opt/betina/performance/dashboard
sudo -u www-data npm ci
sudo -u www-data npm run build
```

## 6) Variáveis críticas (validar)

- `SQLITE_DB_PATH=/opt/betina/performance/database.db`
- `PERFORMANCE_SCRIPT_DIR=/opt/betina/performance`
- `NEXT_PUBLIC_BASE_PATH=/performance`
- `PORT=3100`
- `HOSTNAME=127.0.0.1`
- `OLIST_REDIRECT_URI=https://<dominio>/performance/api/olist/callback`
- `APP_PORTAL_URL=https://<dominio>`
- `JWT_SECRET` e `INTERNAL_SECRET` fortes
- `TZ=America/Sao_Paulo`

## 7) Criar serviços systemd

- Criar:
  - `/etc/systemd/system/performance-token-refresh.service`
  - `/etc/systemd/system/performance-token-refresh.timer`
  - `/etc/systemd/system/performance-dashboard.service`
- Aplicar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable performance-token-refresh.timer
sudo systemctl enable performance-dashboard
sudo systemctl start performance-token-refresh.timer
sudo systemctl start performance-dashboard
```

## 8) Apache reverse proxy

```bash
sudo a2enmod proxy proxy_http headers ssl rewrite
sudo apachectl configtest
sudo systemctl reload apache2
```

- Reiniciar Apache é permitido se necessário durante a janela.
- Restringir alterações ao bloco `/performance`, sem impactar `atrasados` (porta 3000).

Bloco obrigatório no VirtualHost:

```apache
ProxyPass        /performance/ http://127.0.0.1:3100/performance/
ProxyPassReverse /performance/ http://127.0.0.1:3100/performance/
ProxyPass        /performance  http://127.0.0.1:3100/performance
ProxyPassReverse /performance  http://127.0.0.1:3100/performance
```

## 8.1) Portal de serviços

- Validar em `/opt/betina/index.html`:
  - Card **"Envio de Performance de Vendas"** apontando para `/performance/`.
  - Card de `atrasados` permanece inalterado.

## 9) Smoke test técnico

```bash
systemctl status performance-token-refresh --no-pager
systemctl status performance-token-refresh.timer --no-pager
systemctl status performance-dashboard --no-pager
journalctl -u performance-dashboard -n 100 --no-pager
journalctl -u performance-token-refresh -n 50 --no-pager
systemctl list-timers performance-token-refresh.timer --no-pager
curl -I http://127.0.0.1:3100/performance/login
curl -I https://<dominio>/performance/login
```

## 10) Validação funcional

- Login admin.
- Abrir `/performance` e `/performance/admin`.
- Executar manual:
  - `fetch`
  - `send`
  - `send_admin_only`
- Validar OAuth conectado.
- Validar agendamento e logs.
- Validar botão **"Sair"** da aplicação Performance redirecionando para a página inicial do portal (`/`).

## 11) Cutover

- Alterar DNS/proxy para novo host.
- Monitorar logs em tempo real:

```bash
journalctl -u performance-dashboard -f
journalctl -u performance-token-refresh -f
systemctl list-timers performance-token-refresh.timer
```

## 12) Rollback rápido

```bash
sudo systemctl stop performance-dashboard
sudo systemctl stop performance-token-refresh.timer
sudo systemctl stop performance-token-refresh
```

- Reverter tráfego para servidor anterior.
- Restaurar dados no ambiente anterior se necessário.
- Revalidar login, dashboard e envios.
