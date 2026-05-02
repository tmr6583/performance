"""Módulo de autenticação OAuth 2.0 para a API Olist/Tiny v3.

Gerencia o ciclo de vida dos tokens: carregamento, persistência,
renovação automática via refresh token e tratamento de 401.
"""

import json
import os
import random
import time

import requests

from config import (
    API_MAX_RETRIES,
    API_RETRY_BASE_DELAY,
    API_RETRY_JITTER,
    API_RETRY_MAX_DELAY,
    CLIENT_ID,
    CLIENT_SECRET,
    TOKEN_FILE,
    TOKEN_URL,
)
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
            resp = getattr(e, "response", None)
            if resp is not None and resp.status_code in (400, 401):
                logger.error("Token rejeitado pelo servidor (400/401) — limpando tokens.")
                self._clear_tokens()
            else:
                logger.error(f"Falha de rede ao renovar token (tokens preservados): {e}")
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
        self.session = requests.Session()

    @staticmethod
    def _retry_after_seconds(response: requests.Response) -> float | None:
        raw = response.headers.get("Retry-After")
        if not raw:
            return None
        try:
            return max(0.0, float(raw))
        except ValueError:
            return None

    @staticmethod
    def _backoff_seconds(attempt: int) -> float:
        base = max(0.1, API_RETRY_BASE_DELAY)
        max_delay = max(base, API_RETRY_MAX_DELAY)
        jitter = max(0.0, API_RETRY_JITTER)
        wait = min(max_delay, base * (2 ** attempt))
        if jitter > 0:
            wait += random.uniform(0, jitter)
        return wait

    def _request_with_retries(self, url: str, params: dict | None = None) -> requests.Response:
        retriable_status = {429, 500, 502, 503, 504}
        max_retries = max(0, API_MAX_RETRIES)
        refreshed_token = False
        last_network_err: requests.RequestException | None = None
        response: requests.Response | None = None

        for attempt in range(max_retries + 1):
            try:
                response = self.session.get(url, headers=self._headers(), params=params, timeout=30)
            except requests.RequestException as e:
                last_network_err = e
                if attempt >= max_retries:
                    raise
                wait = self._backoff_seconds(attempt)
                logger.warning(
                    f"Falha de rede ao chamar Olist (tentativa {attempt + 1}/{max_retries + 1}). "
                    f"Nova tentativa em {wait:.2f}s."
                )
                time.sleep(wait)
                continue

            if response.status_code == 401 and not refreshed_token:
                logger.warning("401 recebido — tentando renovar token...")
                refreshed_token = True
                if self.auth.refresh_access_token():
                    continue
                raise OlistAuthError(
                    "Token inválido e renovação falhou. "
                    "Acesse o painel e clique em 'Conectar ao Olist'."
                )

            if response.status_code in retriable_status and attempt < max_retries:
                retry_after = self._retry_after_seconds(response)
                wait = retry_after if retry_after is not None else self._backoff_seconds(attempt)
                logger.warning(
                    f"Olist retornou HTTP {response.status_code} (tentativa {attempt + 1}/{max_retries + 1}). "
                    f"Nova tentativa em {wait:.2f}s."
                )
                time.sleep(wait)
                continue

            return response

        if response is not None:
            return response
        if last_network_err is not None:
            raise last_network_err
        raise requests.RequestException("Falha inesperada ao chamar API Olist.")

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
        response = self._request_with_retries(url, params=params)

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
