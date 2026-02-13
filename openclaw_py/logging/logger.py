"""Logging system based on loguru.

This module provides a simplified logging system for OpenClaw using loguru.
"""

import sys
from pathlib import Path
from typing import Any

from loguru import logger

from openclaw_py.config import LoggingConfig

# Default log directory and file
DEFAULT_LOG_DIR = Path.home() / ".openclaw" / "logs"
DEFAULT_LOG_FILE = DEFAULT_LOG_DIR / "openclaw.log"

# Global logger state
_logger_initialized = False
_current_config: LoggingConfig | None = None


def setup_logger(config: LoggingConfig | None = None) -> None:
    """Setup loguru logger with configuration.

    Args:
        config: Logging configuration (defaults to LoggingConfig())

    This function:
    - Removes default loguru handlers
    - Configures file logging
    - Configures console logging (with style: pretty/compact/json)
    - Sets log levels
    """
    global _logger_initialized, _current_config

    if config is None:
        config = LoggingConfig()

    # Remove all existing handlers
    logger.remove()

    # File logging
    log_file = Path(config.file) if config.file else DEFAULT_LOG_FILE
    log_file.parent.mkdir(parents=True, exist_ok=True)

    # Map LogLevel to loguru level
    level_map = {
        "silent": "CRITICAL",  # Effectively disable
        "fatal": "CRITICAL",
        "error": "ERROR",
        "warn": "WARNING",
        "info": "INFO",
        "debug": "DEBUG",
        "trace": "TRACE",
    }

    file_level = level_map.get(config.level, "INFO")

    # Add file handler with rotation
    logger.add(
        log_file,
        level=file_level,
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
        rotation="10 MB",
        retention="7 days",
        compression="zip",
        enqueue=True,  # Thread-safe
    )

    # Console logging
    console_level_str = config.console_level or config.level
    console_level = level_map.get(console_level_str, "INFO")

    if config.console_style == "json":
        # JSON format for machine parsing
        logger.add(
            sys.stderr,
            level=console_level,
            format="{message}",
            serialize=True,  # JSON output
            enqueue=True,
        )
    elif config.console_style == "compact":
        # Compact format
        logger.add(
            sys.stderr,
            level=console_level,
            format="<level>{level: <8}</level> | {message}",
            colorize=True,
            enqueue=True,
        )
    else:  # pretty (default)
        # Pretty format with colors
        logger.add(
            sys.stderr,
            level=console_level,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
            colorize=True,
            enqueue=True,
        )

    _logger_initialized = True
    _current_config = config


def get_logger():
    """Get the global logger instance.

    Returns:
        loguru.logger instance

    If logger is not initialized, it will be initialized with default config.
    """
    global _logger_initialized

    if not _logger_initialized:
        setup_logger()

    return logger


def reset_logger() -> None:
    """Reset logger to uninitialized state.

    Useful for testing.
    """
    global _logger_initialized, _current_config

    logger.remove()
    _logger_initialized = False
    _current_config = None


def is_logger_initialized() -> bool:
    """Check if logger has been initialized.

    Returns:
        True if logger is initialized, False otherwise
    """
    return _logger_initialized


def get_current_config() -> LoggingConfig | None:
    """Get current logging configuration.

    Returns:
        Current LoggingConfig or None if not initialized
    """
    return _current_config


# Convenience logging functions
def log_info(message: str, **kwargs: Any) -> None:
    """Log info message.

    Args:
        message: Log message
        **kwargs: Additional context
    """
    get_logger().info(message, **kwargs)


def log_warn(message: str, **kwargs: Any) -> None:
    """Log warning message.

    Args:
        message: Log message
        **kwargs: Additional context
    """
    get_logger().warning(message, **kwargs)


def log_error(message: str, **kwargs: Any) -> None:
    """Log error message.

    Args:
        message: Log message
        **kwargs: Additional context
    """
    get_logger().error(message, **kwargs)


def log_debug(message: str, **kwargs: Any) -> None:
    """Log debug message.

    Args:
        message: Log message
        **kwargs: Additional context
    """
    get_logger().debug(message, **kwargs)


def log_success(message: str, **kwargs: Any) -> None:
    """Log success message (using info level with success formatting).

    Args:
        message: Log message
        **kwargs: Additional context
    """
    get_logger().success(message, **kwargs)


def log_trace(message: str, **kwargs: Any) -> None:
    """Log trace message (most verbose).

    Args:
        message: Log message
        **kwargs: Additional context
    """
    get_logger().trace(message, **kwargs)
