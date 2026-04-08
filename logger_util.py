"""Módulo utilitário de logging para o projeto Performance."""

import logging
import os
from logging.handlers import TimedRotatingFileHandler


def setup_logger(name: str) -> logging.Logger:
    """Configura e retorna um logger nomeado com handlers de console e arquivo.

    O arquivo de log é sempre criado na raiz do projeto, independentemente
    do diretório de trabalho atual.

    Args:
        name: Nome do logger, usado como prefixo nas mensagens.

    Returns:
        Instância de ``logging.Logger`` configurada com nível INFO.
    """
    project_root = os.path.dirname(os.path.abspath(__file__))
    log_file = os.path.join(project_root, "performance.log")

    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%d/%m/%Y %H:%M:%S",
        )

        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)

        file_handler = TimedRotatingFileHandler(
            log_file,
            when="midnight",
            interval=1,
            backupCount=30,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)

        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

    return logger
