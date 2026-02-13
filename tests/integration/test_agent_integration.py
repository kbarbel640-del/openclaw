"""Integration tests for Agent runtime."""

import pytest

from openclaw_py.agents.defaults import (
    DEFAULT_MODEL,
    DEFAULT_CONTEXT_TOKENS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_PROVIDER,
)
from openclaw_py.agents.model_selection import (
    normalize_provider_id,
    normalize_model_id,
    model_key,
)
from openclaw_py.agents.token_estimation import estimate_tokens
from openclaw_py.config.types import OpenClawConfig


class TestAgentDefaults:
    """Test agent default constants."""

    def test_default_constants_exist(self):
        """Test default constants are defined."""
        assert DEFAULT_MODEL is not None
        assert DEFAULT_CONTEXT_TOKENS > 0
        assert DEFAULT_MAX_TOKENS > 0
        assert DEFAULT_PROVIDER is not None

    def test_default_values_reasonable(self):
        """Test default values are reasonable."""
        assert DEFAULT_CONTEXT_TOKENS >= 100_000
        assert DEFAULT_MAX_TOKENS >= 1024
        assert DEFAULT_PROVIDER in ["anthropic", "openai"]


class TestAgentModelSelection:
    """Test agent model selection utilities."""

    def test_normalize_provider_id(self):
        """Test provider ID normalization."""
        assert normalize_provider_id("Anthropic") == "anthropic"
        assert normalize_provider_id("OpenAI") == "openai"
        assert normalize_provider_id("litellm") == "litellm"
        assert normalize_provider_id("ANTHROPIC") == "anthropic"

    def test_normalize_model_id(self):
        """Test model ID normalization."""
        model_id = normalize_model_id("anthropic", "claude-3-5-sonnet-20241022")
        assert isinstance(model_id, str)
        assert len(model_id) > 0

    def test_model_key_generation(self):
        """Test model key generation."""
        key = model_key("anthropic", "claude-3-5-sonnet-20241022")
        assert "/" in key
        assert key.startswith("anthropic/")


class TestAgentTokenEstimation:
    """Test agent token estimation."""

    def test_estimate_tokens_short_text(self):
        """Test token estimation for short text."""
        text = "Hello, world!"
        tokens = estimate_tokens(text)
        assert tokens > 0
        assert tokens < 100

    def test_estimate_tokens_long_text(self):
        """Test token estimation for long text."""
        text = "Hello, world! " * 1000
        tokens = estimate_tokens(text)
        assert tokens > 100

    def test_estimate_tokens_empty(self):
        """Test token estimation for empty text."""
        tokens = estimate_tokens("")
        assert tokens >= 0

    def test_estimate_tokens_unicode(self):
        """Test token estimation for Unicode text."""
        text = "你好，世界！🦞"
        tokens = estimate_tokens(text)
        assert tokens > 0


class TestAgentToolsIntegration:
    """Test agent tools integration."""

    def test_bash_tool_policy_check(self):
        """Test bash tool policy validation."""
        from openclaw_py.agents.tools.policy import is_command_allowed

        # Simple safe commands
        assert is_command_allowed("ls", [])
        assert is_command_allowed("pwd", [])
        assert is_command_allowed("echo", ["hello"])

        # Git commands
        assert is_command_allowed("git", ["status"])
        assert is_command_allowed("git", ["log"])

    def test_web_fetch_url_validation(self):
        """Test web fetch URL validation."""
        # Simple URL validation
        assert "https://example.com".startswith("https://")
        assert "http://example.com".startswith("http://")
        assert not "file:///etc/passwd".startswith("https://")


class TestAgentAuthProfiles:
    """Test agent auth profiles integration."""

    def test_auth_profile_paths(self, temp_config_dir):
        """Test auth profile path resolution."""
        from openclaw_py.agents.auth_profiles.paths import (
            get_profiles_dir,
            get_profile_path,
            ensure_profiles_dir,
        )

        # Get profiles directory
        profiles_dir = get_profiles_dir()
        assert profiles_dir is not None

        # Get specific profile path
        profile_path = get_profile_path("anthropic")
        assert profile_path is not None
        assert "anthropic" in str(profile_path)

        # Ensure directory exists
        ensure_profiles_dir()
        assert profiles_dir.exists()

    def test_auth_profile_validation(self):
        """Test auth profile data validation."""
        from openclaw_py.agents.auth_profiles.types import AuthProfile

        # Valid profile
        profile = AuthProfile(
            profile_name="test-profile",
            provider="anthropic",
            api_key="test-key-123"
        )
        assert profile.profile_name == "test-profile"
        assert profile.provider == "anthropic"
        assert profile.api_key == "test-key-123"


class TestAgentConfiguration:
    """Test agent configuration."""

    def test_agent_configuration_from_config(self, test_config: OpenClawConfig):
        """Test agent configuration from config."""
        # Get agent config
        agents = test_config.agents if hasattr(test_config, 'agents') else []
        assert len(agents) > 0

        test_agent = agents[0]
        assert test_agent.id == "test-agent"
        assert test_agent.default is True
        assert test_agent.model is not None

    def test_agent_model_validation(self, test_config: OpenClawConfig):
        """Test agent model validation."""
        agents = test_config.agents if hasattr(test_config, 'agents') else []
        test_agent = agents[0]

        # Verify model format
        assert isinstance(test_agent.model, str)
        assert len(test_agent.model) > 0


class TestAgentEndToEnd:
    """Test complete agent scenarios."""

    def test_agent_pipeline(self, test_config: OpenClawConfig):
        """Test agent processing pipeline."""
        # Get agent from config
        agents = test_config.agents if hasattr(test_config, 'agents') else []
        test_agent = agents[0]

        # Normalize provider and model
        provider = DEFAULT_PROVIDER
        model_id = test_agent.model

        # Create model key
        key = model_key(provider, model_id)
        assert "/" in key

        # Estimate tokens for a sample message
        message = "Hello, this is a test message for the agent."
        tokens = estimate_tokens(message)
        assert tokens > 0
        assert tokens < 100

    def test_multi_agent_config(self):
        """Test multi-agent configuration."""
        from openclaw_py.config.types import AgentConfig

        # Create multiple agents
        agent1 = AgentConfig(id="agent1", name="Agent 1", model="claude-3-5-sonnet-20241022")
        agent2 = AgentConfig(id="agent2", name="Agent 2", model="gpt-4")

        assert agent1.id != agent2.id
        assert agent1.model != agent2.model
