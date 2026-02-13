"""Default configuration values application.

This module applies default values to configuration objects.
"""

from .types import (
    GatewayConfig,
    LoggingConfig,
    OpenClawConfig,
    SessionConfig,
    SessionMaintenanceConfig,
    TelegramConfig,
)


def apply_logging_defaults(config: LoggingConfig | None) -> LoggingConfig:
    """Apply default logging configuration.

    Args:
        config: Logging config or None

    Returns:
        LoggingConfig with defaults applied
    """
    if config is None:
        return LoggingConfig()
    return config


def apply_session_defaults(config: SessionConfig | None) -> SessionConfig:
    """Apply default session configuration.

    Args:
        config: Session config or None

    Returns:
        SessionConfig with defaults applied
    """
    if config is None:
        return SessionConfig()

    # Apply maintenance defaults if not set
    if config.maintenance is None:
        config.maintenance = SessionMaintenanceConfig()

    return config


def apply_telegram_defaults(config: TelegramConfig | None) -> TelegramConfig:
    """Apply default Telegram configuration.

    Args:
        config: Telegram config or None

    Returns:
        TelegramConfig with defaults applied
    """
    if config is None:
        return TelegramConfig()
    return config


def apply_gateway_defaults(config: GatewayConfig | None) -> GatewayConfig:
    """Apply default gateway configuration.

    Args:
        config: Gateway config or None

    Returns:
        GatewayConfig with defaults applied
    """
    if config is None:
        return GatewayConfig()
    return config


def apply_defaults(config: OpenClawConfig) -> OpenClawConfig:
    """Apply default values to configuration.

    Args:
        config: OpenClaw configuration

    Returns:
        Configuration with defaults applied
    """
    # Apply defaults for each subsection
    if config.logging is None:
        config.logging = apply_logging_defaults(None)

    if config.session is None:
        config.session = apply_session_defaults(None)
    else:
        config.session = apply_session_defaults(config.session)

    if config.telegram is not None:
        config.telegram = apply_telegram_defaults(config.telegram)

    if config.gateway is None:
        config.gateway = apply_gateway_defaults(None)

    return config
