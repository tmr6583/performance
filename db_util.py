"""Utilitário de acesso ao SQLite compartilhado por todos os scripts Python."""

import os
import sqlite3

from config import SQLITE_DB_PATH


def get_db() -> sqlite3.Connection:
    """Retorna conexão SQLite com WAL mode e timeout de 5 s."""
    if os.path.isabs(SQLITE_DB_PATH):
        path = SQLITE_DB_PATH
    else:
        project_root = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(project_root, SQLITE_DB_PATH)

    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn
