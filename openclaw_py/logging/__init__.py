"""OpenClaw logging module.

This module provides logging functionality based on loguru.
"""

from .logger import (
    DEFAULT_LOG_DIR,
    DEFAULT_LOG_FILE,
    get_current_config,
    get_logger,
    is_logger_initialized,
    log_debug,
    log_error,
    log_info,
    log_success,
    log_trace,
    log_warn,
    reset_logger,
    setup_logger,
)

__all__ = [
    # Logger setup
    "setup_logger",
    "get_logger",
    "reset_logger",
    "is_logger_initialized",
    "get_current_config",
    # Convenience functions
    "log_info",
    "log_warn",
    "log_error",
    "log_debug",
    "log_success",
    "log_trace",
    # Constants
    "DEFAULT_LOG_DIR",
    "DEFAULT_LOG_FILE",
]
