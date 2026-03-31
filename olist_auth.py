"""Módulo de autenticação OAuth 2.0 para a API Olist/Tiny v3.

Gerencia o ciclo de vida dos tokens: carregamento, persistência,
renovação automática via refresh token e tratamento de 401.
"""

import json
import os

import requests

from config import CLIENT_ID, CLIENT_SECRET, TOKEN_FILE, TOKEN_URL
from logger_util import setup_logger

logger = setup_logger("OlistAuth")


class OlistAuthError(Exception):
    """Exceção para erros de autenticação na API Olist."""
    pass


class OlistAuth:
    """Gerencia tokens OAuth 2.0 da API Olist.

    Carrega tokens persistidos em disco, renova automaticamente via
    refresh token e orienta o usuário a reautorizar pelo dashboard
    quando ambos os tokens estiverem expirados.
    """

    def __init__(self) -> None:
        self.access_token: str | None = None
        self.refresh_token: str | None = None
        self._load_tokens()

    def _token_path(self) -> str:
        """Resolve o caminho absoluto do arquivo de tokens."""
        if os.path.isabs(TOKEN_FILE):
            return TOKEN_FILE
        project_root = os.path.dirname(os.path.abspath(__file__))
        return os.path.join(project_root, TOKEN_FILE)

    def _load_tokens(self) -> None:
        path = self._token_path()
        if not os.path.exists(path):
            return
        try:
            with open(path, "r") as f:
                data = json.load(f)
            self.access_token  = data.get("access_token")
            self.refresh_token = data.get("refresh_token")
        except Exception as e:
            logger.warning(f"Erro ao ler tokens: {e}. Nova autorização necessária.")
            self._clear_tokens()

    def _save_tokens(self) -> None:
        path = self._token_path()
        try:
            with open(path, "w") as f:
                json.dump(
                    {"access_token": self.access_token, "refresh_token": self.refresh_token},
                    f,
                )
        except Exception as e:
            logger.error(f"Erro ao salvar tokens: {e}")

    def _clear_tokens(self) -> None:
        self.access_token  = None
        self.refresh_token = None
        path = self._token_path()
        if os.path.exists(path):
            os.remove(path)

    def refresh_access_token(self) -> bool:
        """Tenta renovar o access token via refresh token.

        Returns:
            ``True`` se a renovação foi bem-sucedida.
        """
        logger.info("Token expirado — tentando renovação automática...")
        if not self.refresh_token:
            raise OlistAuthError("Refresh token não disponível. Reautorize pelo dashboard.")

        data = {
            "grant_type":    "refresh_token",
            "client_id":     CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "refresh_token": self.refresh_token,
        }
        try:
            resp = requests.post(TOKEN_URL, data=data, timeout=30)
            resp.raise_for_status()
            tokens = resp.json()
            self.access_token  = tokens.get("access_token")
            self.refresh_token = tokens.get("refresh_token", self.refresh_token)
            self._save_tokens()
            logger.info("Token renovado com sucesso.")
            return True
        except requests.RequestException as e:
            logger.error(f"Falha na renovação do token: {e}")
            self._clear_tokens()
            return False

    def get_valid_access_token(self) -> str:
        """Retorna um access token válido, renovando se necessário.

        Raises:
            OlistAuthError: Se não houver tokens ou a renovação falhar.
        """
        if not self.access_token and not self.refresh_token:
            raise OlistAuthError(
                "Nenhum token Olist encontrado. "
                "Acesse o painel de administração e clique em 'Conectar ao Olist'."
            )

        if not self.access_token and self.refresh_token:
            if not self.refresh_access_token():
                raise OlistAuthError(
                    "Token expirado e renovação falhou. "
                    "Acesse o painel e clique em 'Conectar ao Olist'."
                )

        if not self.access_token:
            raise OlistAuthError("Não foi possível obter access token válido.")

        return self.access_token


class OlistClient:
    """Cliente HTTP autenticado para a API Olist/Tiny v3."""

    def __init__(self, auth: OlistAuth) -> None:
        self.auth = auth

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.auth.get_valid_access_token()}",
            "Content-Type":  "application/json",
        }

    def api_get(self, endpoint: str, params: dict | None = None) -> dict:
        """Executa GET autenticado, renova token em 401.

        Args:
            endpoint: Caminho relativo (ex.: ``"pedidos"``).
            params:   Query parameters opcionais.

        Returns:
            Dicionário com o corpo JSON da resposta.

        Raises:
            requests.RequestException: Em falha de rede irrecuperável.
            OlistAuthError: Se a renovação do token falhar.
        """
        from config import API_URL_BASE
        url = f"{API_URL_BASE}/{endpoint}"

        response = requests.get(url, headers=self._headers(), params=params, timeout=30)

        if response.status_code == 401:
            logger.warning("401 recebido — tentando renovar token...")
            if self.auth.refresh_access_token():
                response = requests.get(url, headers=self._headers(), params=params, timeout=30)
            else:
                raise OlistAuthError(
                    "Token inválido e renovação falhou. "
                    "Acesse o painel e clique em 'Conectar ao Olist'."
                )

        response.raise_for_status()
        return response.json()

    def paginar(self, endpoint: str, params: dict | None = None) -> list:
        """Itera todas as páginas de um endpoint de listagem.

        Args:
            endpoint: Caminho relativo.
            params:   Params base (sem limit/offset).

        Returns:
            Lista com todos os itens de todas as páginas.
        """
        import time
        from config import API_LIMIT, API_REQUEST_SLEEP

        base = dict(params or {})
        base["limit"] = API_LIMIT

        todos: list = []
        offset = 0

        while True:
            base["offset"] = offset
            data   = self.api_get(endpoint, params=base)
            itens  = data.get("itens") or []
            total  = data.get("paginacao", {}).get("total", 0)
            todos.extend(itens)
            offset += API_LIMIT
            if offset >= total:
                break
            time.sleep(API_REQUEST_SLEEP)

        return todos
