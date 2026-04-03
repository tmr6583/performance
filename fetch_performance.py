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



def _ensure_performance_columns(conn: sqlite3.Connection) -> None:
    try: conn.execute("ALTER TABLE performance_cache ADD COLUMN clientes_atendidos_mes INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError: pass
    try: conn.execute("ALTER TABLE performance_cache ADD COLUMN clientes_vendas_mes INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError: pass
    try: conn.execute("ALTER TABLE performance_cache ADD COLUMN faturamento_mes REAL NOT NULL DEFAULT 0")
    except sqlite3.OperationalError: pass

def _upsert_cache(conn: sqlite3.Connection, row: dict) -> None:
    _ensure_performance_columns(conn)
    conn.execute(
        """
        INSERT INTO performance_cache
            (data, id_vendedor, nome_vendedor,
             pedidos_dia, valor_dia, ticket_medio_dia,
             pedidos_mes, valor_mes, ticket_medio_mes,
             clientes_atendidos_mes, clientes_vendas_mes, faturamento_mes,
             atualizado_em)
        VALUES
            (:data, :id_vendedor, :nome_vendedor,
             :pedidos_dia, :valor_dia, :ticket_medio_dia,
             :pedidos_mes, :valor_mes, :ticket_medio_mes,
             :clientes_atendidos_mes, :clientes_vendas_mes, :faturamento_mes,
             CURRENT_TIMESTAMP)
        ON CONFLICT(data, id_vendedor) DO UPDATE SET
            nome_vendedor   = excluded.nome_vendedor,
            pedidos_dia     = excluded.pedidos_dia,
            valor_dia       = excluded.valor_dia,
            ticket_medio_dia = excluded.ticket_medio_dia,
            pedidos_mes     = excluded.pedidos_mes,
            valor_mes       = excluded.valor_mes,
            ticket_medio_mes = excluded.ticket_medio_mes,
            clientes_atendidos_mes = excluded.clientes_atendidos_mes,
            clientes_vendas_mes = excluded.clientes_vendas_mes,
            faturamento_mes = excluded.faturamento_mes,
            atualizado_em   = CURRENT_TIMESTAMP
        """,
        row,
    )


def _ensure_pedidos_cache_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pedidos_cache (
          id_pedido        INTEGER PRIMARY KEY,
          data_faturamento TEXT,
          situacao         TEXT,
          valor            REAL,
          id_vendedor      INTEGER,
          atualizado_em    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

def _get_pedido_faturamento(conn: sqlite3.Connection, client: OlistClient, pedido_id: int) -> str | None:
    """Busca a dataFaturamento no cache; se não tiver, busca na API e salva."""
    row = conn.execute("SELECT data_faturamento FROM pedidos_cache WHERE id_pedido = ?", (pedido_id,)).fetchone()
    if row:
        return row[0]
        
    try:
        # Respeita estritamente o limite da API (Too Many Requests)
        time.sleep(API_REQUEST_SLEEP)
        data = client.api_get(f"pedidos/{pedido_id}")
        data_fat = data.get("dataFaturamento") or ""
        situacao = str(data.get("situacao") or "")
        valor = float(data.get("valorTotalPedido") or 0)
        id_vend = (data.get("vendedor") or {}).get("id")
        
        conn.execute(
            """
            INSERT INTO pedidos_cache (id_pedido, data_faturamento, situacao, valor, id_vendedor)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id_pedido) DO UPDATE SET
                data_faturamento = excluded.data_faturamento,
                situacao = excluded.situacao,
                valor = excluded.valor,
                id_vendedor = excluded.id_vendedor,
                atualizado_em = CURRENT_TIMESTAMP
            """,
            (pedido_id, data_fat, situacao, valor, id_vend)
        )
        conn.commit()
        return data_fat
    except requests.RequestException as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status == 429:
            logger.warning(f"Rate limit ao buscar detalhes do pedido {pedido_id}. Aguardando 2 segundos...")
            time.sleep(2.0)
        else:
            logger.warning(f"Erro ao buscar detalhes do pedido {pedido_id}: HTTP {status} - {e}")
        return None
    except Exception as e:
        logger.warning(f"Erro ao buscar detalhes do pedido {pedido_id}: {e}")
        return None

# ── Cálculo de totais a partir de lista de pedidos ─────────────────────────

def _calcular(conn: sqlite3.Connection, client: OlistClient, pedidos: list, mes_alvo: str) -> tuple[int, float, float, int, float]:
    """Retorna (quantidade, valor_total, ticket_medio, clientes_unicos, faturamento).
    mes_alvo: string no formato YYYY-MM para filtrar o faturamento.
    """
    total = 0.0
    faturamento = 0.0
    clientes = set()
    qtd_valida = 0

    for p in pedidos:
        val = float(p.get("valor") or 0)
        situacao = str(p.get("situacao") or "").lower()
        data_criacao = str(p.get("dataCriacao") or p.get("data") or "")

        # O usuário identificou que na configuração do Tiny deles, a situação '2' (e possivelmente '7') 
        # representam pedidos cancelados/não faturáveis.
        if situacao in ("cancelado", "7", "2"):
            continue
            
        # Vendas no mês e tickets consideram apenas pedidos CRIADOS no mês alvo
        criado_no_mes = data_criacao.startswith(mes_alvo)

        if criado_no_mes:
            qtd_valida += 1
            total += val

            cliente = p.get("cliente") or {}
            cliente_id = cliente.get("id") or cliente.get("nome") or cliente.get("cpf_cnpj")
            if cliente_id:
                clientes.add(cliente_id)

        # Faturamento inclui apenas pedidos aprovados/faturados (situacao 1, e outros equivalentes faturados se houver)
        if situacao in ("faturado", "pronto_envio", "enviado", "entregue", "1", "3", "4", "5", "6"):
            # Precisamos checar a data de faturamento real
            pedido_id = p.get("id")
            if pedido_id:
                data_fat = _get_pedido_faturamento(conn, client, pedido_id)
                # Se faturou no mês alvo, entra no faturamento
                if data_fat and data_fat.startswith(mes_alvo):
                    faturamento += val

    ticket = round(total / qtd_valida, 2) if qtd_valida else 0.0
    return qtd_valida, round(total, 2), ticket, len(clientes), round(faturamento, 2)


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
    mes_alvo   = hoje[:7] # '2026-04'
    
    # Para buscar pedidos atrasados, recuamos a busca para o dia 20 do mês passado
    import datetime as dt
    dt_ini_mes = datetime.strptime(ini_mes, "%Y-%m-%d").date()
    # Pega o último dia do mês passado, depois subtrai mais dias para chegar ao dia 20
    dt_fim_mes_passado = dt_ini_mes - dt.timedelta(days=1)
    dt_dia_20_mes_passado = dt_fim_mes_passado.replace(day=20)
    data_busca_retroativa = dt_dia_20_mes_passado.strftime("%Y-%m-%d")

    inicio_run = datetime.now()

    logger.info("=== Início da extração de performance ===")
    logger.info(f"Data de referência: {_fmt_br(hoje)}  |  Mês alvo: {mes_alvo} | Busca a partir de: {_fmt_br(data_busca_retroativa)}")

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
    _ensure_pedidos_cache_table(conn)
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
                pedidos_mes = _buscar_pedidos(client, vid, data_busca_retroativa, hoje)
                time.sleep(API_REQUEST_SLEEP)

                qtd_dia, val_dia, tick_dia, cli_dia, fat_dia = _calcular(conn, client, pedidos_dia, mes_alvo)
                qtd_mes, val_mes, tick_mes, cli_mes, fat_mes = _calcular(conn, client, pedidos_mes, mes_alvo)

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
                        "clientes_atendidos_mes": 0, # Placeholder, não temos rota certa no Tiny ainda
                        "clientes_vendas_mes": cli_mes,
                        "faturamento_mes": fat_mes,
                    },
                )
                logger.info(
                    f"  {nome}: dia={qtd_dia} pedidos / R$ {val_dia:.2f} | "
                    f"mês={qtd_mes} pedidos / R$ {val_mes:.2f} (Fat: R$ {fat_mes:.2f})"
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
