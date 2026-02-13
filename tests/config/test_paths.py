"""Tests for configuration path resolution."""

import os
from pathlib import Path

import pytest

from openclaw_py.config import (
    ensure_state_dir,
    expand_home_prefix,
    resolve_config_path,
    resolve_default_config_candidates,
    resolve_home_dir,
    resolve_state_dir,
)


class TestResolveHomeDir:
    """Tests for resolve_home_dir."""

    def test_default_home_dir(self):
        """Test that default home directory is returned."""
        home = resolve_home_dir()
        assert home == Path.home()

    def test_openclaw_home_override(self, tmp_path):
        """Test that OPENCLAW_HOME overrides home directory."""
        custom_home = tmp_path / "custom_home"
        env = {"OPENCLAW_HOME": str(custom_home)}
        home = resolve_home_dir(env)
        assert home == custom_home

    def test_openclaw_home_tilde_expansion(self):
        """Test that ~ in OPENCLAW_HOME is expanded."""
        env = {"OPENCLAW_HOME": "~/custom"}
        home = resolve_home_dir(env)
        # Should expand ~ to actual home
        assert "~" not in str(home)


class TestExpandHomePrefix:
    """Tests for expand_home_prefix."""

    def test_expand_tilde(self):
        """Test that ~ is expanded to home directory."""
        path = expand_home_prefix("~")
        assert path == Path.home()

    def test_expand_tilde_slash(self):
        """Test that ~/path is expanded."""
        path = expand_home_prefix("~/test/path")
        assert str(path).startswith(str(Path.home()))
        assert path == Path.home() / "test" / "path"

    def test_no_tilde(self):
        """Test that paths without ~ are unchanged."""
        path = expand_home_prefix("/absolute/path")
        assert path == Path("/absolute/path")

    def test_openclaw_home_override(self, tmp_path):
        """Test that OPENCLAW_HOME affects ~ expansion."""
        custom_home = tmp_path / "custom_home"
        env = {"OPENCLAW_HOME": str(custom_home)}
        path = expand_home_prefix("~/test", env)
        assert path == custom_home / "test"


class TestResolveStateDir:
    """Tests for resolve_state_dir."""

    def test_default_state_dir(self):
        """Test that default state dir is ~/.openclaw."""
        state_dir = resolve_state_dir()
        assert state_dir == Path.home() / ".openclaw"

    def test_openclaw_state_dir_override(self, tmp_path):
        """Test that OPENCLAW_STATE_DIR overrides state directory."""
        custom_state = tmp_path / "custom_state"
        env = {"OPENCLAW_STATE_DIR": str(custom_state)}
        state_dir = resolve_state_dir(env)
        assert state_dir == custom_state

    def test_openclaw_state_dir_tilde(self):
        """Test that ~ in OPENCLAW_STATE_DIR is expanded."""
        env = {"OPENCLAW_STATE_DIR": "~/custom/state"}
        state_dir = resolve_state_dir(env)
        assert "~" not in str(state_dir)
        assert state_dir == Path.home() / "custom" / "state"

    def test_openclaw_home_affects_state_dir(self, tmp_path):
        """Test that OPENCLAW_HOME affects default state dir."""
        custom_home = tmp_path / "custom_home"
        env = {"OPENCLAW_HOME": str(custom_home)}
        state_dir = resolve_state_dir(env)
        assert state_dir == custom_home / ".openclaw"


class TestResolveConfigPath:
    """Tests for resolve_config_path."""

    def test_default_config_path(self):
        """Test that default config path is ~/.openclaw/openclaw.yaml."""
        config_path = resolve_config_path()
        assert config_path == Path.home() / ".openclaw" / "openclaw.yaml"

    def test_openclaw_config_override(self, tmp_path):
        """Test that OPENCLAW_CONFIG overrides config path."""
        custom_config = tmp_path / "custom_config.yaml"
        env = {"OPENCLAW_CONFIG": str(custom_config)}
        config_path = resolve_config_path(env)
        assert config_path == custom_config

    def test_openclaw_config_tilde(self):
        """Test that ~ in OPENCLAW_CONFIG is expanded."""
        env = {"OPENCLAW_CONFIG": "~/config/openclaw.yaml"}
        config_path = resolve_config_path(env)
        assert "~" not in str(config_path)
        assert config_path == Path.home() / "config" / "openclaw.yaml"

    def test_openclaw_state_dir_affects_config(self, tmp_path):
        """Test that OPENCLAW_STATE_DIR affects default config path."""
        custom_state = tmp_path / "custom_state"
        env = {"OPENCLAW_STATE_DIR": str(custom_state)}
        config_path = resolve_config_path(env)
        assert config_path == custom_state / "openclaw.yaml"


class TestResolveDefaultConfigCandidates:
    """Tests for resolve_default_config_candidates."""

    def test_default_candidates(self):
        """Test that default candidates are returned in priority order."""
        candidates = resolve_default_config_candidates()
        assert len(candidates) == 2
        assert candidates[0] == Path.home() / ".openclaw" / "openclaw.yaml"
        assert candidates[1] == Path.home() / ".openclaw" / "openclaw.json"

    def test_candidates_with_custom_state_dir(self, tmp_path):
        """Test that custom state dir affects candidates."""
        custom_state = tmp_path / "custom_state"
        env = {"OPENCLAW_STATE_DIR": str(custom_state)}
        candidates = resolve_default_config_candidates(env)
        assert len(candidates) == 2
        assert candidates[0] == custom_state / "openclaw.yaml"
        assert candidates[1] == custom_state / "openclaw.json"


class TestEnsureStateDir:
    """Tests for ensure_state_dir."""

    def test_ensure_state_dir_creates_directory(self, tmp_path):
        """Test that ensure_state_dir creates directory if missing."""
        custom_state = tmp_path / "custom_state"
        env = {"OPENCLAW_STATE_DIR": str(custom_state)}

        assert not custom_state.exists()
        state_dir = ensure_state_dir(env)
        assert state_dir == custom_state
        assert custom_state.exists()
        assert custom_state.is_dir()

    def test_ensure_state_dir_idempotent(self, tmp_path):
        """Test that ensure_state_dir is idempotent."""
        custom_state = tmp_path / "custom_state"
        env = {"OPENCLAW_STATE_DIR": str(custom_state)}

        state_dir1 = ensure_state_dir(env)
        state_dir2 = ensure_state_dir(env)
        assert state_dir1 == state_dir2
        assert custom_state.exists()
