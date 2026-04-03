"""Script de envio de e-mails de performance.

Lê os dados do dia no SQLite e envia:
  - E-mail individual para cada vendedora habilitada
  - E-mail de resumo para cada admin com recebe_relatorio = 1

Uso::

    python send_emails.py

Variáveis de ambiente obrigatórias (.env):
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
"""

import smtplib
import sqlite3
import ssl
import sys
import uuid
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import (
    EMAIL_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)
from db_util import get_db
from email_templates import admin_html, vendedora_html
from logger_util import setup_logger

logger = setup_logger("send_emails")


# ── SMTP ───────────────────────────────────────────────────────────────────

def _enviar_email(destinatario: str, assunto: str, html: str) -> None:
    """Envia um e-mail HTML via SSL/TLS direto (porta 465).

    Raises:
        smtplib.SMTPAuthenticationError: Credenciais inválidas — interrompe tudo.
        Exception: Qualquer outro erro de rede/SMTP — deve ser capturado pelo chamador.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto
    msg["From"]    = EMAIL_FROM
    msg["To"]      = destinatario

    msg.attach(MIMEText(html, "html", "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=30) as smtp:
        smtp.ehlo()
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.sendmail(SMTP_USER, destinatario, msg.as_string())



def _registrar_log(
    conn: sqlite3.Connection,
    execucao_id: str,
    tipo: str,
    destinatario: str,
    nome: str,
    status: str,
    mensagem: str = "",
) -> None:
    conn.execute(
        """
        INSERT INTO email_logs
            (execucao_id, tipo, destinatario, nome, status, mensagem)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (execucao_id, tipo, destinatario, nome, status, mensagem),
    )


# ── Ponto de entrada ───────────────────────────────────────────────────────

def main() -> None:
    if not SMTP_PASSWORD:
        logger.error("SMTP_PASSWORD não definido. Verifique o arquivo .env.")
        sys.exit(1)

    hoje        = date.today().isoformat()
    execucao_id = str(uuid.uuid4())
    logger.info(f"=== Início do envio de e-mails — execução {execucao_id} ===")
    logger.info(f"Data de referência: {hoje}")

    conn = get_db()
    ok_count  = 0
    err_count = 0

    try:
        # ── 1. Dados de performance do dia ─────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS metas_vendedores (
                id_olist     INTEGER PRIMARY KEY,
                meta_mensal  REAL    NOT NULL DEFAULT 0,
                vigencia_ini TEXT,
                vigencia_fim TEXT,
                updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        caches = conn.execute(
            "SELECT * FROM performance_cache WHERE data = ?", (hoje,)
        ).fetchall()

        cache_por_vendedor: dict[int, dict] = {
            row["id_vendedor"]: dict(row) for row in caches
        }

        metas_rows = conn.execute(
            "SELECT id_olist, meta_mensal FROM metas_vendedores"
        ).fetchall()
        metas_por_vendedor: dict[int, float] = {
            r["id_olist"]: float(r["meta_mensal"] or 0) for r in metas_rows
        }

        # ── 2. E-mails individuais para vendedoras ─────────────────────────
        vendedoras = conn.execute(
            "SELECT * FROM vendedores WHERE recebe_email = 1 AND email IS NOT NULL AND email != ''"
        ).fetchall()

        logger.info(f"{len(vendedoras)} vendedora(s) habilitada(s) para receber e-mail.")

        for v in vendedoras:
            vid  = v["id_olist"]
            nome = v["nome"]
            dest = v["email"]

            dados = cache_por_vendedor.get(vid, {})
            meta  = metas_por_vendedor.get(vid, 0.0)
            valor_mes = float(dados.get("valor_mes", 0.0) or 0.0)
            perc_meta = round((valor_mes / meta) * 100, 2) if meta > 0 else 0.0
            falta     = round(max(meta - valor_mes, 0.0), 2) if meta > 0 else 0.0
            html  = vendedora_html(
                nome        = nome,
                pedidos_dia = dados.get("pedidos_dia",      0),
                valor_dia   = dados.get("valor_dia",        0.0),
                ticket_dia  = dados.get("ticket_medio_dia", 0.0),
                pedidos_mes = dados.get("pedidos_mes",      0),
                valor_mes   = dados.get("valor_mes",        0.0),
                ticket_mes  = dados.get("ticket_medio_mes", 0.0),
                meta_mensal = meta,
                perc_meta   = perc_meta,
                falta_meta  = falta,
                data        = hoje,
            )
            assunto = f"Seu desempenho,  {nome}"

            try:
                _enviar_email(dest, assunto, html)
                _registrar_log(conn, execucao_id, "vendedora", dest, nome, "ok")
                conn.commit()
                logger.info(f"  ✓ Enviado para {nome} <{dest}>")
                ok_count += 1

            except smtplib.SMTPAuthenticationError:
                logger.error("Falha de autenticação SMTP — abortando todos os envios.")
                _registrar_log(
                    conn, execucao_id, "vendedora", dest, nome, "erro",
                    "Falha de autenticação SMTP"
                )
                conn.commit()
                sys.exit(1)

            except Exception as e:
                msg = str(e)
                logger.error(f"  ✗ Falha ao enviar para {nome} <{dest}>: {msg}")
                _registrar_log(conn, execucao_id, "vendedora", dest, nome, "erro", msg)
                conn.commit()
                err_count += 1

        # ── 3. E-mail de resumo para administradores ───────────────────────
        admins = conn.execute(
            "SELECT name, email FROM users WHERE role = 'admin' AND recebe_relatorio = 1"
        ).fetchall()

        logger.info(f"{len(admins)} admin(s) habilitado(s) para receber resumo.")

        if admins:
            hoje_br = date.today().strftime("%d/%m/%Y")
            todos_dados = []
            for vid, row in cache_por_vendedor.items():
                meta = metas_por_vendedor.get(vid, 0.0)
                valor_mes = float(row.get("valor_mes", 0.0) or 0.0)
                perc_meta = round((valor_mes / meta) * 100, 2) if meta > 0 else 0.0
                falta     = round(max(meta - valor_mes, 0.0), 2) if meta > 0 else 0.0
                r = dict(row)
                r["meta_mensal"] = meta
                r["perc_meta"]   = perc_meta
                r["falta_meta"]  = falta
                todos_dados.append(r)
            html_admin  = admin_html(todos_dados, data=hoje)
            assunto_admin = f"Desempenho da Equipe — {hoje_br}"

            for a in admins:
                nome_admin = a["name"]
                dest_admin = a["email"]

                try:
                    _enviar_email(dest_admin, assunto_admin, html_admin)
                    _registrar_log(conn, execucao_id, "admin", dest_admin, nome_admin, "ok")
                    conn.commit()
                    logger.info(f"  ✓ Resumo enviado para {nome_admin} <{dest_admin}>")
                    ok_count += 1

                except smtplib.SMTPAuthenticationError:
                    logger.error("Falha de autenticação SMTP — abortando.")
                    _registrar_log(
                        conn, execucao_id, "admin", dest_admin, nome_admin, "erro",
                        "Falha de autenticação SMTP"
                    )
                    conn.commit()
                    sys.exit(1)

                except Exception as e:
                    msg = str(e)
                    logger.error(f"  ✗ Falha ao enviar resumo para {nome_admin}: {msg}")
                    _registrar_log(conn, execucao_id, "admin", dest_admin, nome_admin, "erro", msg)
                    conn.commit()
                    err_count += 1

    finally:
        conn.close()

    logger.info(
        f"=== Envio concluído | {ok_count} enviado(s) | {err_count} erro(s) ==="
    )

    if ok_count == 0 and err_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
