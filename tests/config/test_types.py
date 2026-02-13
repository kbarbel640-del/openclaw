"""Tests for configuration types (Pydantic models)."""

import pytest
from pydantic import ValidationError

from openclaw_py.config import (
    GatewayConfig,
    LoggingConfig,
    ModelDefinitionConfig,
    ModelProviderConfig,
    ModelsConfig,
    OpenClawConfig,
    SessionConfig,
    TelegramConfig,
)


class TestLoggingConfig:
    """Tests for LoggingConfig."""

    def test_default_values(self):
        """Test that default values are applied."""
        config = LoggingConfig()
        assert config.level == "info"
        assert config.file is None
        assert config.console_level is None
        assert config.console_style == "pretty"
        assert config.redact_sensitive == "tools"

    def test_custom_values(self):
        """Test that custom values are accepted."""
        config = LoggingConfig(
            level="debug",
            file="/var/log/openclaw.log",
            console_level="warn",
            console_style="json",
        )
        assert config.level == "debug"
        assert config.file == "/var/log/openclaw.log"
        assert config.console_level == "warn"
        assert config.console_style == "json"

    def test_invalid_level(self):
        """Test that invalid log level is rejected."""
        with pytest.raises(ValidationError):
            LoggingConfig(level="invalid")  # type: ignore

    def test_invalid_console_style(self):
        """Test that invalid console style is rejected."""
        with pytest.raises(ValidationError):
            LoggingConfig(console_style="invalid")  # type: ignore


class TestSessionConfig:
    """Tests for SessionConfig."""

    def test_default_values(self):
        """Test that default values are applied."""
        config = SessionConfig()
        assert config.scope == "per-sender"
        assert config.dm_scope == "main"
        assert config.idle_minutes is None
        assert config.maintenance is None

    def test_custom_values(self):
        """Test that custom values are accepted."""
        config = SessionConfig(
            scope="global",
            dm_scope="per-peer",
            idle_minutes=60,
        )
        assert config.scope == "global"
        assert config.dm_scope == "per-peer"
        assert config.idle_minutes == 60

    def test_invalid_scope(self):
        """Test that invalid scope is rejected."""
        with pytest.raises(ValidationError):
            SessionConfig(scope="invalid")  # type: ignore

    def test_invalid_idle_minutes(self):
        """Test that negative idle_minutes is rejected."""
        with pytest.raises(ValidationError):
            SessionConfig(idle_minutes=-1)


class TestModelDefinitionConfig:
    """Tests for ModelDefinitionConfig."""

    def test_minimal_model(self):
        """Test minimal model definition."""
        config = ModelDefinitionConfig(
            id="anthropic/claude-opus-4-6",
            name="Claude Opus 4.6",
        )
        assert config.id == "anthropic/claude-opus-4-6"
        assert config.name == "Claude Opus 4.6"
        assert config.api is None

    def test_full_model(self):
        """Test full model definition."""
        config = ModelDefinitionConfig(
            id="anthropic/claude-sonnet-4-5",
            name="Claude Sonnet 4.5",
            api="anthropic-messages",
            reasoning=False,
            input=["text", "image"],
            context_window=200000,
            max_tokens=8192,
        )
        assert config.id == "anthropic/claude-sonnet-4-5"
        assert config.api == "anthropic-messages"
        assert config.reasoning is False
        assert config.input == ["text", "image"]
        assert config.context_window == 200000
        assert config.max_tokens == 8192

    def test_empty_id_rejected(self):
        """Test that empty id is rejected."""
        with pytest.raises(ValidationError):
            ModelDefinitionConfig(id="", name="Test")

    def test_empty_name_rejected(self):
        """Test that empty name is rejected."""
        with pytest.raises(ValidationError):
            ModelDefinitionConfig(id="test", name="")


class TestModelProviderConfig:
    """Tests for ModelProviderConfig."""

    def test_minimal_provider(self):
        """Test minimal provider config."""
        config = ModelProviderConfig(
            base_url="https://api.anthropic.com",
            models=[
                ModelDefinitionConfig(
                    id="claude-opus-4-6",
                    name="Claude Opus 4.6",
                ),
            ],
        )
        assert config.base_url == "https://api.anthropic.com"
        assert len(config.models) == 1
        assert config.api_key is None

    def test_full_provider(self):
        """Test full provider config."""
        config = ModelProviderConfig(
            base_url="https://api.openai.com/v1",
            api_key="sk-test",
            auth="api-key",
            models=[
                ModelDefinitionConfig(id="gpt-5", name="GPT-5"),
            ],
        )
        assert config.api_key == "sk-test"
        assert config.auth == "api-key"

    def test_empty_base_url_rejected(self):
        """Test that empty base_url is rejected."""
        with pytest.raises(ValidationError):
            ModelProviderConfig(
                base_url="",
                models=[ModelDefinitionConfig(id="test", name="Test")],
            )


class TestModelsConfig:
    """Tests for ModelsConfig."""

    def test_default_values(self):
        """Test that default values are applied."""
        config = ModelsConfig()
        assert config.mode == "merge"
        assert config.providers is None

    def test_custom_providers(self):
        """Test custom providers."""
        config = ModelsConfig(
            mode="replace",
            providers={
                "anthropic": ModelProviderConfig(
                    base_url="https://api.anthropic.com",
                    models=[
                        ModelDefinitionConfig(id="claude", name="Claude"),
                    ],
                ),
            },
        )
        assert config.mode == "replace"
        assert "anthropic" in config.providers


class TestTelegramConfig:
    """Tests for TelegramConfig."""

    def test_default_values(self):
        """Test that default values are applied."""
        config = TelegramConfig()
        assert config.enabled is True
        assert config.dm_policy == "pairing"
        assert config.group_policy == "open"
        assert config.text_chunk_limit == 4000
        assert config.chunk_mode == "length"
        assert config.stream_mode == "partial"

    def test_custom_values(self):
        """Test custom values."""
        config = TelegramConfig(
            bot_token="123:ABC",
            dm_policy="open",
            group_policy="disabled",
            text_chunk_limit=2000,
        )
        assert config.bot_token == "123:ABC"
        assert config.dm_policy == "open"
        assert config.group_policy == "disabled"
        assert config.text_chunk_limit == 2000

    def test_multi_account(self):
        """Test multi-account configuration."""
        config = TelegramConfig(
            accounts={
                "main": TelegramConfig(bot_token="main-token"),
                "backup": TelegramConfig(bot_token="backup-token"),
            }
        )
        assert "main" in config.accounts
        assert "backup" in config.accounts
        assert config.accounts["main"].bot_token == "main-token"


class TestGatewayConfig:
    """Tests for GatewayConfig."""

    def test_default_values(self):
        """Test that default values are applied."""
        config = GatewayConfig()
        assert config.enabled is True
        assert config.host == "127.0.0.1"
        assert config.port is None
        assert config.password is None

    def test_custom_values(self):
        """Test custom values."""
        config = GatewayConfig(
            enabled=False,
            host="0.0.0.0",
            port=8080,
            password="secret",
        )
        assert config.enabled is False
        assert config.host == "0.0.0.0"
        assert config.port == 8080
        assert config.password == "secret"

    def test_invalid_port(self):
        """Test that invalid port is rejected."""
        with pytest.raises(ValidationError):
            GatewayConfig(port=0)  # Port must be >= 1

        with pytest.raises(ValidationError):
            GatewayConfig(port=70000)  # Port must be <= 65535


class TestOpenClawConfig:
    """Tests for OpenClawConfig (root config)."""

    def test_empty_config(self):
        """Test that empty config is valid."""
        config = OpenClawConfig()
        assert config.logging is None
        assert config.session is None
        assert config.models is None
        assert config.telegram is None

    def test_full_config(self):
        """Test full config."""
        config = OpenClawConfig(
            logging=LoggingConfig(level="debug"),
            session=SessionConfig(scope="global"),
            telegram=TelegramConfig(bot_token="test"),
            gateway=GatewayConfig(port=8080),
        )
        assert config.logging.level == "debug"
        assert config.session.scope == "global"
        assert config.telegram.bot_token == "test"
        assert config.gateway.port == 8080

    def test_nested_validation(self):
        """Test that nested validation works."""
        # Invalid logging level should be caught
        with pytest.raises(ValidationError):
            OpenClawConfig(
                logging=LoggingConfig(level="invalid")  # type: ignore
            )

    def test_extra_fields_allowed(self):
        """Test that extra fields are allowed (for future extensions)."""
        config = OpenClawConfig(
            **{
                "logging": {"level": "info"},
                "unknown_field": "value",
            }
        )
        assert config.logging.level == "info"
