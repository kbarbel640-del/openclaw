"""Tests for configuration loader."""

import pytest

from openclaw_py.config import (
    ConfigParseError,
    ConfigValidationError,
    MissingEnvVarError,
    load_config_file,
    load_config_sync,
    parse_config_file,
    read_config_file_snapshot,
)


class TestParseConfigFile:
    """Tests for parse_config_file."""

    def test_parse_yaml(self):
        """Test parsing YAML config."""
        content = """
logging:
  level: debug
session:
  scope: global
"""
        result = parse_config_file(content, "yaml")
        assert result["logging"]["level"] == "debug"
        assert result["session"]["scope"] == "global"

    def test_parse_json(self):
        """Test parsing JSON config."""
        content = '{"logging": {"level": "debug"}, "session": {"scope": "global"}}'
        result = parse_config_file(content, "json")
        assert result["logging"]["level"] == "debug"
        assert result["session"]["scope"] == "global"

    def test_parse_empty_yaml(self):
        """Test parsing empty YAML returns empty dict."""
        content = ""
        result = parse_config_file(content, "yaml")
        assert result == {}

    def test_parse_invalid_yaml(self):
        """Test that invalid YAML raises ConfigParseError."""
        content = "invalid: yaml: content:"
        with pytest.raises(ConfigParseError):
            parse_config_file(content, "yaml")

    def test_parse_invalid_json(self):
        """Test that invalid JSON raises ConfigParseError."""
        content = '{"invalid": json}'
        with pytest.raises(ConfigParseError):
            parse_config_file(content, "json")

    def test_parse_non_dict_yaml(self):
        """Test that non-dict YAML raises error."""
        content = "- item1\n- item2"
        with pytest.raises(ConfigParseError):
            parse_config_file(content, "yaml")


@pytest.mark.asyncio
class TestLoadConfigFile:
    """Tests for load_config_file."""

    async def test_load_nonexistent_file_returns_default(self, tmp_path):
        """Test that loading nonexistent file returns default config."""
        config_path = tmp_path / "nonexistent.yaml"
        env = {"OPENCLAW_CONFIG": str(config_path)}
        config = await load_config_file(env=env)
        # Should return default config
        assert config.logging.level == "info"
        assert config.session.scope == "per-sender"

    async def test_load_yaml_file(self, tmp_path):
        """Test loading YAML config file."""
        config_path = tmp_path / "openclaw.yaml"
        config_path.write_text(
            """
logging:
  level: debug
session:
  scope: global
"""
        )
        env = {"OPENCLAW_CONFIG": str(config_path)}
        config = await load_config_file(env=env)
        assert config.logging.level == "debug"
        assert config.session.scope == "global"

    async def test_load_json_file(self, tmp_path):
        """Test loading JSON config file."""
        config_path = tmp_path / "openclaw.json"
        config_path.write_text('{"logging": {"level": "warn"}}')
        env = {"OPENCLAW_CONFIG": str(config_path)}
        config = await load_config_file(env=env)
        assert config.logging.level == "warn"

    async def test_env_var_substitution(self, tmp_path):
        """Test that environment variables are substituted."""
        config_path = tmp_path / "openclaw.yaml"
        config_path.write_text(
            """
telegram:
  bot_token: "${TELEGRAM_BOT_TOKEN}"
"""
        )
        env = {
            "OPENCLAW_CONFIG": str(config_path),
            "TELEGRAM_BOT_TOKEN": "secret123",
        }
        config = await load_config_file(env=env)
        assert config.telegram.bot_token == "secret123"

    async def test_missing_env_var_raises_error(self, tmp_path):
        """Test that missing env var raises MissingEnvVarError."""
        config_path = tmp_path / "openclaw.yaml"
        config_path.write_text(
            """
telegram:
  bot_token: "${MISSING_TOKEN}"
"""
        )
        env = {"OPENCLAW_CONFIG": str(config_path)}
        with pytest.raises(MissingEnvVarError) as exc_info:
            await load_config_file(env=env)
        assert exc_info.value.var_name == "MISSING_TOKEN"

    async def test_invalid_config_raises_validation_error(self, tmp_path):
        """Test that invalid config raises ConfigValidationError."""
        config_path = tmp_path / "openclaw.yaml"
        config_path.write_text(
            """
logging:
  level: invalid_level
"""
        )
        env = {"OPENCLAW_CONFIG": str(config_path)}
        with pytest.raises(ConfigValidationError) as exc_info:
            await load_config_file(env=env)
        assert len(exc_info.value.issues) > 0

    async def test_defaults_applied(self, tmp_path):
        """Test that defaults are applied to config."""
        config_path = tmp_path / "openclaw.yaml"
        config_path.write_text(
            """
telegram:
  bot_token: "test"
"""
        )
        env = {"OPENCLAW_CONFIG": str(config_path)}
        config = await load_config_file(env=env)
        # Defaults should be applied
        assert config.logging is not None
        assert config.logging.level == "info"
        assert config.session is not None
        assert config.gateway is not None


class TestLoadConfigSync:
    """Tests for load_config_sync (synchronous wrapper)."""

    def test_load_config_sync(self, tmp_path):
        """Test synchronous config loading."""
        config_path = tmp_path / "openclaw.yaml"
        config_path.write_text(
            """
logging:
  level: trace
"""
        )
        env = {"OPENCLAW_CONFIG": str(config_path)}
        config = load_config_sync(env=env)
        assert config.logging.level == "trace"


@pytest.mark.asyncio
class TestReadConfigFileSnapshot:
    """Tests for read_config_file_snapshot."""

    async def test_snapshot_existing_file(self, tmp_path):
        """Test reading snapshot of existing file."""
        config_path = tmp_path / "openclaw.yaml"
        content = """
logging:
  level: debug
"""
        config_path.write_text(content)
        env = {"OPENCLAW_CONFIG": str(config_path)}

        snapshot = await read_config_file_snapshot(env=env)
        assert snapshot.path == str(config_path)
        assert snapshot.exists is True
        assert snapshot.raw == content
        assert snapshot.valid is True
        assert snapshot.config.logging.level == "debug"
        assert snapshot.hash is not None
        assert len(snapshot.issues) == 0

    async def test_snapshot_nonexistent_file(self, tmp_path):
        """Test reading snapshot of nonexistent file."""
        config_path = tmp_path / "nonexistent.yaml"
        env = {"OPENCLAW_CONFIG": str(config_path)}

        snapshot = await read_config_file_snapshot(env=env)
        assert snapshot.path == str(config_path)
        assert snapshot.exists is False
        assert snapshot.raw is None
        assert snapshot.valid is True  # Default config is valid
        assert snapshot.config.logging.level == "info"  # Default

    async def test_snapshot_invalid_file(self, tmp_path):
        """Test reading snapshot of invalid file."""
        config_path = tmp_path / "openclaw.yaml"
        config_path.write_text(
            """
logging:
  level: invalid_level
"""
        )
        env = {"OPENCLAW_CONFIG": str(config_path)}

        snapshot = await read_config_file_snapshot(env=env)
        assert snapshot.exists is True
        assert snapshot.valid is False
        assert len(snapshot.issues) > 0

    async def test_snapshot_missing_env_var(self, tmp_path):
        """Test snapshot with missing env var."""
        config_path = tmp_path / "openclaw.yaml"
        config_path.write_text(
            """
telegram:
  bot_token: "${MISSING_VAR}"
"""
        )
        env = {"OPENCLAW_CONFIG": str(config_path)}

        snapshot = await read_config_file_snapshot(env=env)
        assert snapshot.exists is True
        assert snapshot.valid is False
        assert len(snapshot.issues) > 0
        # Should have an issue about missing env var
        assert any("MISSING_VAR" in issue.message for issue in snapshot.issues)
