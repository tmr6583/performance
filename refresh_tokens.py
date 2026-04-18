"""Renova o access token Olist na inicialização do servidor.

Executado como serviço oneshot pelo systemd antes do dashboard iniciar.
Se a renovação falhar (tokens expirados ou ausentes), registra no log e
sai com código 0 para não bloquear a inicialização do dashboard.

Uso::

    python refresh_tokens.py
"""

import os
import sqlite3
import sys

# Garante que os módulos do projeto sejam encontrados independente do cwd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from logger_util import setup_logger

logger = setup_logger("refresh_tokens")


def _carregar_credenciais_do_painel() -> None:
    """Carrega CLIENT_ID/CLIENT_SECRET do banco (painel), quando disponíveis.

    Isso evita divergência entre credenciais salvas no Admin e variáveis estáticas
    de ambiente usadas pelos scripts Python.
    """
    project_root = os.path.dirname(os.path.abspath(__file__))
    db_path = os.getenv("SQLITE_DB_PATH", os.path.join(project_root, "database.db"))
    if not os.path.isabs(db_path):
        db_path = os.path.join(project_root, db_path)

    if not os.path.exists(db_path):
        return

    try:
        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT client_id, client_secret FROM olist_credentials WHERE id = 1"
        ).fetchone()
        conn.close()
    except Exception as e:
        logger.warning(f"Não foi possível ler credenciais no banco: {e}")
        return

    if not row:
        return

    client_id = (row[0] or "").strip()
    client_secret = (row[1] or "").strip()

    if client_id:
        os.environ["CLIENT_ID"] = client_id
    if client_secret:
        os.environ["CLIENT_SECRET"] = client_secret

    if client_id or client_secret:
        logger.info("Credenciais Olist carregadas a partir do painel (SQLite).")


def main() -> None:
    logger.info("=== Verificação de tokens Olist na inicialização ===")
    _carregar_credenciais_do_painel()

    # Importa depois de carregar credenciais do painel para garantir que
    # config.py/olist_auth.py recebam os valores mais atuais.
    from olist_auth import OlistAuth, OlistAuthError

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
    logger.info("Aviso por e-mail desabilitado para falha de renovação de token.")

    # Sai com 0 para não bloquear o dashboard
    sys.exit(0)


if __name__ == "__main__":
    main()
