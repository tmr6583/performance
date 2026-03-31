"""Script de extração de dados de performance via API Olist/Tiny v3.

Busca pedidos de cada vendedora (hoje e mês corrente) e persiste
os resultados em performance_cache no SQLite.

Uso::

    python fetch_performance.py

Variáveis de ambiente obrigatórias (.env):
    CLIENT_ID, CLIENT_SECRET
"""

import sqlite3
import sys
import time
from datetime import date, datetime

import requests

from config import CLIENT_ID, CLIENT_SECRET, API_REQUEST_SLEEP
from db_util import get_db
from logger_util import setup_logger
from olist_auth import OlistAuth, OlistAuthError, OlistClient

logger = setup_logger("fetch_performance")


# ── Helpers de data ────────────────────────────────────────────────────────

def _hoje() -> str:
    return date.today().strftime("%Y-%m-%d")


def _inicio_mes() -> str:
    hoje = date.today()
    return hoje.replace(day=1).strftime("%Y-%m-%d")


def _fmt_br(iso: str) -> str:
    """Converte 'YYYY-MM-DD' para 'DD/MM/YYYY'."""
    try:
        return datetime.strptime(iso, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return iso



def _upsert_cache(conn: sqlite3.Connection, row: dict) -> None:
    conn.execute(
        """
        INSERT INTO performance_cache
            (data, id_vendedor, nome_vendedor,
             pedidos_dia, valor_dia, ticket_medio_dia,
             pedidos_mes, valor_mes, ticket_medio_mes,
             atualizado_em)
        VALUES
            (:data, :id_vendedor, :nome_vendedor,
             :pedidos_dia, :valor_dia, :ticket_medio_dia,
             :pedidos_mes, :valor_mes, :ticket_medio_mes,
             CURRENT_TIMESTAMP)
        ON CONFLICT(data, id_vendedor) DO UPDATE SET
            nome_vendedor   = excluded.nome_vendedor,
            pedidos_dia     = excluded.pedidos_dia,
            valor_dia       = excluded.valor_dia,
            ticket_medio_dia = excluded.ticket_medio_dia,
            pedidos_mes     = excluded.pedidos_mes,
            valor_mes       = excluded.valor_mes,
            ticket_medio_mes = excluded.ticket_medio_mes,
            atualizado_em   = CURRENT_TIMESTAMP
        """,
        row,
    )


# ── Cálculo de totais a partir de lista de pedidos ─────────────────────────

def _calcular(pedidos: list) -> tuple[int, float, float]:
    """Retorna (quantidade, valor_total, ticket_medio)."""
    qtd   = len(pedidos)
    total = sum(float(p.get("valor") or 0) for p in pedidos)
    ticket = round(total / qtd, 2) if qtd else 0.0
    return qtd, round(total, 2), ticket


# ── Busca de vendedores ────────────────────────────────────────────────────

def _listar_vendedores(client: OlistClient) -> list[dict]:
    """Retorna vendedores ativos com id e nome."""
    logger.info("Buscando lista de vendedores no Olist...")
    todos = client.paginar("vendedores")

    ativos = [
        {
            "id":   v["id"],
            "nome": (v.get("contato") or {}).get("nome") or f"Vendedor {v['id']}",
        }
        for v in todos
        if v.get("situacao") in ("A", "B")  # Ativo com/sem acesso
    ]
    logger.info(f"{len(ativos)} vendedores ativos encontrados.")
    return ativos


# ── Busca de pedidos por vendedor ──────────────────────────────────────────

def _buscar_pedidos(client: OlistClient, id_vendedor: int, data_ini: str, data_fim: str) -> list:
    """Busca todos os pedidos de um vendedor em um intervalo de datas."""
    params = {
        "idVendedor":  id_vendedor,
        "dataInicial": data_ini,
        "dataFinal":   data_fim,
    }
    try:
        return client.paginar("pedidos", params=params)
    except requests.RequestException as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        logger.warning(
            f"Erro ao buscar pedidos do vendedor {id_vendedor} "
            f"({data_ini} a {data_fim}): HTTP {status} — {e}"
        )
        return []


# ── Ponto de entrada ───────────────────────────────────────────────────────

def main() -> None:
    if not CLIENT_ID or not CLIENT_SECRET:
        logger.error(
            "CLIENT_ID e CLIENT_SECRET não definidos. "
            "Verifique o arquivo .env na raiz do projeto."
        )
        sys.exit(1)

    hoje       = _hoje()
    ini_mes    = _inicio_mes()
    inicio_run = datetime.now()

    logger.info("=== Início da extração de performance ===")
    logger.info(f"Data de referência: {_fmt_br(hoje)}  |  Mês: {_fmt_br(ini_mes)} a {_fmt_br(hoje)}")

    try:
        auth   = OlistAuth()
        client = OlistClient(auth)
    except OlistAuthError as e:
        logger.error(f"Erro de autenticação: {e}")
        sys.exit(1)

    vendedores = _listar_vendedores(client)
    if not vendedores:
        logger.warning("Nenhum vendedor ativo encontrado. Encerrando.")
        sys.exit(0)

    conn = get_db()
    erros = 0

    try:
        for v in vendedores:
            vid  = v["id"]
            nome = v["nome"]

            try:
                # Pedidos do dia
                pedidos_dia = _buscar_pedidos(client, vid, hoje, hoje)
                time.sleep(API_REQUEST_SLEEP)

                # Pedidos do mês
                pedidos_mes = _buscar_pedidos(client, vid, ini_mes, hoje)
                time.sleep(API_REQUEST_SLEEP)

                qtd_dia, val_dia, tick_dia = _calcular(pedidos_dia)
                qtd_mes, val_mes, tick_mes = _calcular(pedidos_mes)

                _upsert_cache(
                    conn,
                    {
                        "data":            hoje,
                        "id_vendedor":     vid,
                        "nome_vendedor":   nome,
                        "pedidos_dia":     qtd_dia,
                        "valor_dia":       val_dia,
                        "ticket_medio_dia": tick_dia,
                        "pedidos_mes":     qtd_mes,
                        "valor_mes":       val_mes,
                        "ticket_medio_mes": tick_mes,
                    },
                )
                logger.info(
                    f"  {nome}: dia={qtd_dia} pedidos / R$ {val_dia:.2f} | "
                    f"mês={qtd_mes} pedidos / R$ {val_mes:.2f}"
                )

            except Exception as e:
                logger.error(f"Erro ao processar vendedor {nome} (id={vid}): {e}")
                erros += 1
                continue

        conn.commit()

    finally:
        conn.close()

    duracao = (datetime.now() - inicio_run).seconds
    logger.info(
        f"=== Extração concluída em {duracao}s | "
        f"{len(vendedores) - erros}/{len(vendedores)} vendedores OK | "
        f"{erros} erro(s) ==="
    )

    if erros == len(vendedores):
        sys.exit(1)


if __name__ == "__main__":
    main()
