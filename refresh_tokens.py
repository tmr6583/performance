"""Renova o access token Olist na inicialização do servidor.

Executado como serviço oneshot pelo systemd antes do dashboard iniciar.
Se a renovação falhar (tokens expirados ou ausentes), registra no log e
sai com código 0 para não bloquear a inicialização do dashboard.

Uso::

    python refresh_tokens.py
"""

import os
import sys

# Garante que os módulos do projeto sejam encontrados independente do cwd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from logger_util import setup_logger
from olist_auth import OlistAuth, OlistAuthError

logger = setup_logger("refresh_tokens")


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
    logger.info("Aviso por e-mail desabilitado para falha de renovação de token.")

    # Sai com 0 para não bloquear o dashboard
    sys.exit(0)


if __name__ == "__main__":
    main()
