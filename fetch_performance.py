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
import os
import json
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

def _ensure_meta_settings_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS meta_settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _get_setting(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM meta_settings WHERE key = ?", (key,)).fetchone()
    if not row:
        return None
    return str(row[0])


def _set_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        """
        INSERT INTO meta_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
        """,
        (key, value),
    )

def _ensure_metas_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS metas_vendedores (
          id_olist     INTEGER PRIMARY KEY,
          meta_mensal  REAL    NOT NULL DEFAULT 0,
          vigencia_ini TEXT,
          vigencia_fim TEXT,
          updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _bulk_upsert_metas(conn: sqlite3.Connection, metas: dict[int, float]) -> None:
    if not metas:
        return
    conn.executemany(
        """
        INSERT INTO metas_vendedores (id_olist, meta_mensal, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id_olist) DO UPDATE SET
          meta_mensal = excluded.meta_mensal,
          updated_at = CURRENT_TIMESTAMP
        """,
        [(vid, float(meta or 0)) for vid, meta in metas.items()],
    )


def _infer_meta_fields(sample: dict) -> tuple[str | None, str | None]:
    id_key_candidates = ["idVendedor", "id_vendedor", "id", "vendedor.id"]
    meta_key_candidates = ["metaMensal", "meta_mensal", "meta", "valorMeta", "valor"]

    id_key = next((k for k in id_key_candidates if k in sample), None)
    meta_key = next((k for k in meta_key_candidates if k in sample), None)
    return id_key, meta_key


def _parse_meta_row(it: dict, id_key: str | None, meta_key: str | None) -> tuple[int | None, float | None]:
    raw_id = None
    raw_meta = None

    if id_key == "vendedor.id":
        raw_id = (it.get("vendedor") or {}).get("id")
    elif id_key:
        raw_id = it.get(id_key)
    else:
        raw_id = (
            it.get("idVendedor")
            or it.get("id_vendedor")
            or it.get("id")
            or (it.get("vendedor") or {}).get("id")
        )

    if meta_key:
        raw_meta = it.get(meta_key)
    else:
        raw_meta = (
            it.get("metaMensal")
            or it.get("meta_mensal")
            or it.get("meta")
            or it.get("valorMeta")
            or it.get("valor")
        )

    try:
        vid = int(raw_id)
        meta = float(raw_meta or 0)
    except (TypeError, ValueError):
        return None, None

    if vid <= 0:
        return None, None

    return vid, round(meta, 2)


def _discover_meta_source(conn: sqlite3.Connection, client: OlistClient) -> dict | None:
    endpoints_env = os.getenv(
        "OLIST_METAS_ENDPOINTS",
        "metas-vendedores,metas_vendedores,metasVendedores,metas,objetivos,objetivos-vendedores,objetivos_vendedores",
    )
    endpoints = [e.strip() for e in endpoints_env.split(",") if e.strip()]
    if not endpoints:
        return None

    now = time.time()
    try:
        last_discovery = float(_get_setting(conn, "meta_last_discovery") or "0")
    except ValueError:
        last_discovery = 0

    discovery_ttl = float(os.getenv("OLIST_METAS_DISCOVERY_TTL_SECONDS", str(24 * 3600)))
    if now - last_discovery < discovery_ttl:
        cached = _get_setting(conn, "meta_source")
        if cached:
            try:
                return json.loads(cached)
            except Exception:
                return None
        return None

    _set_setting(conn, "meta_last_discovery", str(int(now)))

    for endpoint in endpoints:
        try:
            data = client.api_get(endpoint, params={"limit": 1, "offset": 0})
        except Exception:
            continue

        itens = data.get("itens") if isinstance(data, dict) else None
        if itens is None:
            continue

        sample = itens[0] if isinstance(itens, list) and itens else {}
        if not isinstance(sample, dict):
            sample = {}

        id_key, meta_key = _infer_meta_fields(sample)
        source = {"endpoint": endpoint, "id_key": id_key, "meta_key": meta_key}
        _set_setting(conn, "meta_source", json.dumps(source))
        return source

    return None


def _refresh_metas_mensais(conn: sqlite3.Connection, client: OlistClient) -> None:
    _ensure_meta_settings_table(conn)
    _ensure_metas_table(conn)

    metas_count = int(conn.execute("SELECT count(*) FROM metas_vendedores").fetchone()[0])
    now = time.time()
    try:
        last_sync = float(_get_setting(conn, "meta_last_sync") or "0")
    except ValueError:
        last_sync = 0

    refresh_ttl = float(os.getenv("OLIST_METAS_REFRESH_TTL_SECONDS", str(12 * 3600)))
    if metas_count > 0 and now - last_sync < refresh_ttl:
        return

    source = None
    cached = _get_setting(conn, "meta_source")
    if cached:
        try:
            source = json.loads(cached)
        except Exception:
            source = None

    if not source:
        source = _discover_meta_source(conn, client)

    endpoint = (source or {}).get("endpoint") or os.getenv("OLIST_METAS_ENDPOINT", "")
    id_key = (source or {}).get("id_key")
    meta_key = (source or {}).get("meta_key")

    if not endpoint:
        return

    try:
        itens = client.paginar(endpoint)
    except requests.RequestException as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        logger.warning(f"Não foi possível buscar metas no Olist via '{endpoint}': HTTP {status} — {e}")
        return
    except Exception as e:
        logger.warning(f"Não foi possível buscar metas no Olist via '{endpoint}': {e}")
        return

    metas: dict[int, float] = {}
    for it in itens:
        if not isinstance(it, dict):
            continue
        vid, meta = _parse_meta_row(it, id_key, meta_key)
        if vid is None or meta is None:
            continue
        metas[vid] = meta

    _set_setting(conn, "meta_last_sync", str(int(now)))
    if metas:
        _bulk_upsert_metas(conn, metas)
        logger.info(f"Metas mensais atualizadas via Olist: {len(metas)} vendedor(es).")
    else:
        logger.info(f"Nenhuma meta retornada pelo endpoint '{endpoint}'.")


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
        _refresh_metas_mensais(conn, client)

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
