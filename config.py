"""Configurações compartilhadas do projeto Performance."""

import os
from dotenv import load_dotenv

load_dotenv()

# ── OAuth / API Olist ──────────────────────────────────────────────────────
CLIENT_ID     = os.getenv("CLIENT_ID", "")
CLIENT_SECRET = os.getenv("CLIENT_SECRET", "")
REDIRECT_URI  = os.getenv("OLIST_REDIRECT_URI", "http://localhost:8000/callback")

AUTH_URL_BASE = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth"
TOKEN_URL     = "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token"
API_URL_BASE  = "https://api.tiny.com.br/public-api/v3"

TOKEN_FILE    = os.getenv("TOKEN_FILE", ".tiny_tokens.json")

# ── SMTP ───────────────────────────────────────────────────────────────────
SMTP_HOST      = os.getenv("SMTP_HOST",      "email-ssl.com.br")
SMTP_PORT      = int(os.getenv("SMTP_PORT",  "465"))
SMTP_USER      = os.getenv("SMTP_USER",      "contato@betinalimpeza.com.br")
SMTP_PASSWORD  = os.getenv("SMTP_PASSWORD",  "")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Betina Limpeza")
EMAIL_FROM     = f"{EMAIL_FROM_NAME} <{SMTP_USER}>"

# ── Paginação / Rate limit ──────────────────────────────────────────────────
API_LIMIT          = 100
API_REQUEST_SLEEP  = 0.25   # segundos entre chamadas
API_MAX_RETRIES    = int(os.getenv("OLIST_API_MAX_RETRIES", "5"))
API_RETRY_BASE_DELAY = float(os.getenv("OLIST_API_RETRY_BASE_DELAY", "1.0"))
API_RETRY_MAX_DELAY  = float(os.getenv("OLIST_API_RETRY_MAX_DELAY", "20.0"))
API_RETRY_JITTER     = float(os.getenv("OLIST_API_RETRY_JITTER", "0.3"))

# ── Arquivos ────────────────────────────────────────────────────────────────
LOG_FILE        = "performance.log"
SQLITE_DB_PATH  = os.getenv("SQLITE_DB_PATH", "database.db")
