import logging
import sys

from flask import g, has_request_context


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = (  # type: ignore[attr-defined]
            getattr(g, "request_id", "-") if has_request_context() else "-"
        )
        return True


def _setup_root() -> None:
    root = logging.getLogger("polaris")
    if root.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())
    handler.setFormatter(
        logging.Formatter(
            "[%(asctime)s] [%(levelname)-8s] [%(request_id)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
    )
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    root.propagate = False


def get_logger(name: str) -> logging.Logger:
    """Return a child logger under the 'polaris' namespace.

    All loggers share a single handler on 'polaris' that injects the
    current request ID (from Flask g) into every log record.
    """
    _setup_root()
    return logging.getLogger(f"polaris.{name}")
