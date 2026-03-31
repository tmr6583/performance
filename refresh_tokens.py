"""Renova o access token Olist na inicialização do servidor.

Executado como serviço oneshot pelo systemd antes do dashboard iniciar.
Se a renovação falhar (tokens expirados ou ausentes), envia e-mail de
alerta para os administradores cadastrados no banco e sai com código 0
para não bloquear a inicialização do dashboard.

Uso::

    python refresh_tokens.py
"""

import os
import smtplib
import ssl
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Garante que os módulos do projeto sejam encontrados independente do cwd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    EMAIL_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)
from db_util import get_db
from logger_util import setup_logger
from olist_auth import OlistAuth, OlistAuthError

logger = setup_logger("refresh_tokens")


def _admins_com_email() -> list[dict]:
    """Retorna admins com recebe_relatorio=1 e e-mail configurado."""
    try:
        conn = get_db()
        rows = conn.execute(
            "SELECT name, email FROM users "
            "WHERE role = 'admin' AND recebe_relatorio = 1 "
            "AND email IS NOT NULL AND email != ''"
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.warning(f"Não foi possível consultar admins no banco: {e}")
        return []


def _enviar_alerta(destinatario: str, nome: str) -> None:
    assunto = "⚠️ Betina Performance — Reautorização Olist necessária"
    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="color:#c0392b">Reautorização Olist necessária</h2>
  <p>Olá, <strong>{nome}</strong>.</p>
  <p>
    O servidor <strong>Betina Performance</strong> foi reiniciado, mas a renovação
    automática do token de acesso à API Olist <strong>falhou</strong>.
  </p>
  <p>Isso acontece quando o servidor permanece desligado por tempo suficiente
     para expirar tanto o <em>access token</em> quanto o <em>refresh token</em>.</p>
  <p>
    <strong>Ação necessária:</strong> acesse o painel de administração e clique
    em <em>"Conectar ao Olist"</em> para reautorizar a integração.
  </p>
  <p style="margin-top:24px">
    <a href="https://betinalimpeza.ddns.net/performance"
       style="background:#2980b9;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px">
      Acessar Painel
    </a>
  </p>
  <hr style="margin-top:32px;border:none;border-top:1px solid #eee">
  <p style="font-size:12px;color:#999">Betina Limpeza — sistema automático</p>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto
    msg["From"] = EMAIL_FROM
    msg["To"] = destinatario
    msg.attach(MIMEText(html, "html", "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=30) as smtp:
        smtp.ehlo()
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.sendmail(SMTP_USER, destinatario, msg.as_string())


def _notificar_admins() -> None:
    if not SMTP_PASSWORD:
        logger.warning("SMTP_PASSWORD não configurado — alertas por e-mail desabilitados.")
        return

    admins = _admins_com_email()
    if not admins:
        logger.warning("Nenhum admin com e-mail cadastrado para notificação.")
        return

    for admin in admins:
        try:
            _enviar_alerta(admin["email"], admin["name"])
            logger.info(f"Alerta enviado para {admin['name']} <{admin['email']}>")
        except smtplib.SMTPAuthenticationError:
            logger.error("Falha de autenticação SMTP — não foi possível enviar alertas.")
            break
        except Exception as e:
            logger.error(f"Erro ao enviar alerta para {admin['email']}: {e}")


def main() -> None:
    logger.info("=== Verificação de tokens Olist na inicialização ===")

    auth = OlistAuth()

    if not auth.access_token and not auth.refresh_token:
        logger.info(
            "Nenhum token encontrado — OAuth ainda não autorizado. "
            "Acesse o painel e conecte ao Olist."
        )
        sys.exit(0)

    if auth.access_token and not auth.refresh_token:
        # Só access token sem refresh: tenta forçar renovação mesmo assim
        logger.info("Apenas access token presente (sem refresh token). Tentando renovar...")

    logger.info("Forçando renovação do access token...")
    try:
        sucesso = auth.refresh_access_token()
    except OlistAuthError as e:
        logger.error(f"Renovação falhou: {e}")
        sucesso = False

    if sucesso:
        logger.info("Token renovado com sucesso. Sistema pronto.")
        sys.exit(0)

    logger.error(
        "Não foi possível renovar o token. "
        "Ambos os tokens expiraram — reautorização manual necessária."
    )
    _notificar_admins()

    # Sai com 0 para não bloquear o dashboard
    sys.exit(0)


if __name__ == "__main__":
    main()
