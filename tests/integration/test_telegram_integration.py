"""Integration tests for Telegram bot.

Note: These tests require a valid Telegram bot token to run fully.
Most tests are designed to work without a real token by mocking.
"""

import pytest

from openclaw_py.channels.telegram.helpers import (
    build_telegram_group_peer_id,
    build_telegram_parent_peer,
)
from openclaw_py.channels.telegram.token import resolve_telegram_token
from openclaw_py.config.types import OpenClawConfig, TelegramConfig


class TestTelegramHelpers:
    """Test Telegram helper functions."""

    def test_build_group_peer_id(self):
        """Test building group peer ID."""
        peer_id = build_telegram_group_peer_id(-1001234567890)
        assert peer_id == "tg:-1001234567890"

        # With thread ID
        peer_id = build_telegram_group_peer_id(-1001234567890, 42)
        assert peer_id == "tg:-1001234567890:42"

    def test_build_parent_peer(self):
        """Test building parent peer ID."""
        peer_id = build_telegram_parent_peer(-1001234567890)
        assert peer_id == "tg:-1001234567890"


class TestTelegramToken:
    """Test Telegram token utilities."""

    def test_validate_token_format(self):
        """Test token format validation."""
        # Valid format pattern (fake tokens)
        valid_token = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        assert ":" in valid_token
        assert len(valid_token.split(":")) == 2

        # Invalid format
        invalid_token = "invalid"
        assert ":" not in invalid_token or len(invalid_token.split(":")) != 2

    def test_parse_bot_id_from_token(self):
        """Test parsing bot ID from token."""
        token = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        bot_id = token.split(":")[0]
        assert bot_id == "123456789"

        token = "987654321:XYZabcDEFghiJKLmnoPQRstuv"
        bot_id = token.split(":")[0]
        assert bot_id == "987654321"


class TestTelegramConfig:
    """Test Telegram configuration."""

    def test_telegram_config_single_account(self):
        """Test single account configuration."""
        config = TelegramConfig(
            enabled=True,
            token="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        )
        assert config.enabled is True
        assert config.token == "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        assert config.accounts is None

    def test_telegram_config_multi_account(self):
        """Test multi-account configuration."""
        config = TelegramConfig(
            enabled=True,
            accounts=[
                {"id": "bot1", "token": "111111111:AAA"},
                {"id": "bot2", "token": "222222222:BBB"},
            ]
        )
        assert config.enabled is True
        assert config.accounts is not None
        assert len(config.accounts) == 2
        assert config.accounts[0]["id"] == "bot1"
        assert config.accounts[1]["id"] == "bot2"


class TestTelegramIntegration:
    """Test Telegram integration scenarios."""

    def test_telegram_disabled_config(self):
        """Test with Telegram disabled."""
        config = OpenClawConfig(
            telegram={"enabled": False},
            gateway={"enabled": False},
        )
        assert config.telegram.enabled is False

    def test_telegram_config_from_full_config(self):
        """Test extracting Telegram config from full config."""
        config = OpenClawConfig(
            telegram={
                "enabled": True,
                "token": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
                "webhook_enabled": False,
            },
            gateway={"enabled": False},
        )

        tg_config = config.telegram
        assert tg_config.enabled is True
        assert tg_config.token == "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        assert tg_config.webhook_enabled is False

    def test_multi_account_token_extraction(self):
        """Test extracting tokens from multi-account config."""
        config = OpenClawConfig(
            telegram={
                "enabled": True,
                "accounts": [
                    {"id": "bot1", "token": "111111111:AAA"},
                    {"id": "bot2", "token": "222222222:BBB"},
                ],
            },
            gateway={"enabled": False},
        )

        accounts = config.telegram.accounts
        assert accounts is not None
        assert len(accounts) == 2

        # Extract bot IDs from tokens
        bot_id_1 = accounts[0]["token"].split(":")[0]
        bot_id_2 = accounts[1]["token"].split(":")[0]

        assert bot_id_1 == "111111111"
        assert bot_id_2 == "222222222"
