"""Tests for context window management."""

import pytest

from openclaw_py.agents.context_window import (
    CONTEXT_WINDOW_HARD_MIN_TOKENS,
    CONTEXT_WINDOW_WARN_BELOW_TOKENS,
    evaluate_context_window_guard,
    resolve_context_window_info,
)
from openclaw_py.config import (
    ModelDefinitionConfig,
    ModelProviderConfig,
    ModelsConfig,
    OpenClawConfig,
)


def test_resolve_context_window_from_model_param():
    """Test resolving context window from model parameter."""
    info = resolve_context_window_info(
        cfg=None,
        provider="anthropic",
        model_id="claude-opus-4-6",
        model_context_window=500000,
    )

    assert info.tokens == 500000
    assert info.source == "model"


def test_resolve_context_window_from_models_config():
    """Test resolving context window from config."""
    config = OpenClawConfig(
        models=ModelsConfig(
            providers={
                "anthropic": ModelProviderConfig(
                    api="anthropic-messages",
                    base_url="https://api.anthropic.com",
                    models=[
                        ModelDefinitionConfig(
                            id="claude-opus-4-6",
                            name="Claude Opus 4.6",
                            context_window=500000,
                        )
                    ],
                )
            }
        )
    )

    info = resolve_context_window_info(
        cfg=config,
        provider="anthropic",
        model_id="claude-opus-4-6",
    )

    assert info.tokens == 500000
    assert info.source == "modelsConfig"


def test_resolve_context_window_default_fallback():
    """Test fallback to default when no info available."""
    info = resolve_context_window_info(
        cfg=None,
        provider="anthropic",
        model_id="unknown-model",
        default_tokens=100000,
    )

    assert info.tokens == 100000
    assert info.source == "default"


def test_resolve_context_window_priority_order():
    """Test that modelsConfig takes priority over model parameter."""
    config = OpenClawConfig(
        models=ModelsConfig(
            providers={
                "anthropic": ModelProviderConfig(
                    api="anthropic-messages",
                    base_url="https://api.anthropic.com",
                    models=[
                        ModelDefinitionConfig(
                            id="test-model",
                            name="Test Model",
                            context_window=300000,
                        )
                    ],
                )
            }
        )
    )

    info = resolve_context_window_info(
        cfg=config,
        provider="anthropic",
        model_id="test-model",
        model_context_window=500000,  # This should be overridden
    )

    assert info.tokens == 300000
    assert info.source == "modelsConfig"


def test_resolve_context_window_agent_cap():
    """Test that agentContextTokens cap is applied (when agents config exists)."""
    # Note: OpenClawConfig doesn't have agents field in batch 2-7
    # This test documents the feature but may not work until agents config is added
    # For now, test that model parameter works without cap
    info = resolve_context_window_info(
        cfg=None,
        provider="anthropic",
        model_id="test-model",
        model_context_window=200000,
    )

    # Without cap, should use model value
    assert info.tokens == 200000
    assert info.source == "model"


def test_evaluate_context_window_guard_no_warning():
    """Test guard evaluation with large context window."""
    from openclaw_py.agents.context_window import ContextWindowInfo

    info = ContextWindowInfo(tokens=200000, source="model")
    result = evaluate_context_window_guard(info)

    assert result.tokens == 200000
    assert result.source == "model"
    assert not result.should_warn
    assert not result.should_block


def test_evaluate_context_window_guard_should_warn():
    """Test guard evaluation triggers warning."""
    from openclaw_py.agents.context_window import ContextWindowInfo

    # Between hard min (16K) and warn threshold (32K)
    info = ContextWindowInfo(tokens=20000, source="model")
    result = evaluate_context_window_guard(info)

    assert result.should_warn
    assert not result.should_block


def test_evaluate_context_window_guard_should_block():
    """Test guard evaluation triggers blocking."""
    from openclaw_py.agents.context_window import ContextWindowInfo

    # Below hard min (16K)
    info = ContextWindowInfo(tokens=10000, source="model")
    result = evaluate_context_window_guard(info)

    assert result.should_warn
    assert result.should_block


def test_evaluate_context_window_guard_custom_thresholds():
    """Test guard evaluation with custom thresholds."""
    from openclaw_py.agents.context_window import ContextWindowInfo

    info = ContextWindowInfo(tokens=50000, source="model")
    result = evaluate_context_window_guard(
        info,
        warn_below_tokens=100000,
        hard_min_tokens=30000,
    )

    assert result.should_warn  # Below 100K
    assert not result.should_block  # Above 30K


def test_evaluate_context_window_guard_at_boundaries():
    """Test guard evaluation at exact boundary values."""
    from openclaw_py.agents.context_window import ContextWindowInfo

    # Exactly at warning threshold
    info = ContextWindowInfo(tokens=CONTEXT_WINDOW_WARN_BELOW_TOKENS, source="model")
    result = evaluate_context_window_guard(info)
    assert not result.should_warn  # Not below threshold

    # Exactly at hard min
    info = ContextWindowInfo(tokens=CONTEXT_WINDOW_HARD_MIN_TOKENS, source="model")
    result = evaluate_context_window_guard(info)
    assert not result.should_block  # Not below threshold
