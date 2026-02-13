"""Tests for usage normalization and tracking."""

from openclaw_py.agents.types import UsageInfo
from openclaw_py.agents.usage import (
    derive_prompt_tokens,
    derive_session_total_tokens,
    has_nonzero_usage,
    merge_usage,
    normalize_usage,
)


def test_normalize_usage_anthropic_format():
    """Test normalization of Anthropic usage format."""
    raw = {
        "input_tokens": 100,
        "output_tokens": 50,
        "cache_read_input_tokens": 10,
        "cache_creation_input_tokens": 5,
    }

    usage = normalize_usage(raw)
    assert usage is not None
    assert usage.input_tokens == 100
    assert usage.output_tokens == 50
    assert usage.cache_read_tokens == 10
    assert usage.cache_creation_tokens == 5
    assert usage.total_tokens == 165  # Auto-calculated


def test_normalize_usage_openai_format():
    """Test normalization of OpenAI usage format."""
    raw = {
        "prompt_tokens": 100,
        "completion_tokens": 50,
        "total_tokens": 150,
    }

    usage = normalize_usage(raw)
    assert usage is not None
    assert usage.input_tokens == 100
    assert usage.output_tokens == 50
    assert usage.total_tokens == 150


def test_normalize_usage_empty():
    """Test normalization of empty/None usage."""
    assert normalize_usage(None) is None
    assert normalize_usage({}) is None
    assert normalize_usage({"invalid": 123}) is None


def test_normalize_usage_mixed_formats():
    """Test normalization with mixed naming."""
    raw = {
        "inputTokens": 100,  # Camel case
        "output_tokens": 50,  # Snake case
    }

    usage = normalize_usage(raw)
    assert usage is not None
    assert usage.input_tokens == 100
    assert usage.output_tokens == 50


def test_derive_prompt_tokens():
    """Test deriving prompt tokens."""
    usage = UsageInfo(
        input_tokens=100,
        cache_read_tokens=10,
        cache_creation_tokens=5,
    )

    prompt_tokens = derive_prompt_tokens(usage)
    assert prompt_tokens == 115


def test_derive_prompt_tokens_none():
    """Test deriving prompt tokens from None."""
    assert derive_prompt_tokens(None) is None


def test_merge_usage():
    """Test merging usage info."""
    usage1 = UsageInfo(
        input_tokens=100,
        output_tokens=50,
    )

    usage2 = UsageInfo(
        input_tokens=200,
        output_tokens=100,
        cache_read_tokens=10,
    )

    merged = merge_usage(usage1, usage2)
    assert merged is not None
    assert merged.input_tokens == 300
    assert merged.output_tokens == 150
    assert merged.cache_read_tokens == 10


def test_merge_usage_with_none():
    """Test merging with None."""
    usage = UsageInfo(input_tokens=100)

    assert merge_usage(None, None) is None
    assert merge_usage(usage, None) == usage
    assert merge_usage(None, usage) == usage


# Batch 8 enhancements


def test_has_nonzero_usage_with_input():
    """Test has_nonzero_usage with input tokens."""
    usage = UsageInfo(input_tokens=100)
    assert has_nonzero_usage(usage)


def test_has_nonzero_usage_with_output():
    """Test has_nonzero_usage with output tokens."""
    usage = UsageInfo(output_tokens=50)
    assert has_nonzero_usage(usage)


def test_has_nonzero_usage_with_cache():
    """Test has_nonzero_usage with cache tokens."""
    usage = UsageInfo(cache_read_tokens=20)
    assert has_nonzero_usage(usage)


def test_has_nonzero_usage_with_total():
    """Test has_nonzero_usage with only total."""
    usage = UsageInfo(total_tokens=150)
    assert has_nonzero_usage(usage)


def test_has_nonzero_usage_empty():
    """Test has_nonzero_usage with empty usage."""
    usage = UsageInfo()
    assert not has_nonzero_usage(usage)


def test_has_nonzero_usage_none():
    """Test has_nonzero_usage with None."""
    assert not has_nonzero_usage(None)


def test_has_nonzero_usage_all_zero():
    """Test has_nonzero_usage with all zeros."""
    usage = UsageInfo(
        input_tokens=0,
        output_tokens=0,
        cache_read_tokens=0,
    )
    assert not has_nonzero_usage(usage)


def test_derive_session_total_tokens_basic():
    """Test deriving session total tokens."""
    usage = UsageInfo(input_tokens=100, output_tokens=50)
    total = derive_session_total_tokens(usage)

    # Should use input + cache (no cache here, so just input)
    assert total == 100


def test_derive_session_total_tokens_with_cache():
    """Test deriving session total with cache tokens."""
    usage = UsageInfo(
        input_tokens=100,
        cache_read_tokens=20,
        cache_creation_tokens=10,
    )
    total = derive_session_total_tokens(usage)

    # Should be input + cache_read + cache_creation
    assert total == 130


def test_derive_session_total_tokens_with_context_cap():
    """Test deriving session total with context cap."""
    usage = UsageInfo(input_tokens=300000)
    total = derive_session_total_tokens(usage, context_tokens=200000)

    # Should be capped at context_tokens
    assert total == 200000


def test_derive_session_total_tokens_none():
    """Test deriving session total with None usage."""
    assert derive_session_total_tokens(None) is None


def test_derive_session_total_tokens_no_tokens():
    """Test deriving session total with no tokens."""
    usage = UsageInfo()
    assert derive_session_total_tokens(usage) is None


def test_derive_session_total_tokens_uses_total_fallback():
    """Test that it falls back to total_tokens if no input."""
    usage = UsageInfo(total_tokens=150)
    total = derive_session_total_tokens(usage)

    assert total == 150


def test_derive_session_total_tokens_prefers_prompt():
    """Test that it prefers prompt tokens over total."""
    usage = UsageInfo(
        input_tokens=100,
        cache_read_tokens=20,
        total_tokens=200,  # Higher than prompt
    )
    total = derive_session_total_tokens(usage)

    # Should use prompt (120) not total (200)
    assert total == 120


def test_derive_session_total_tokens_cap_not_applied_when_below():
    """Test that cap is not applied when usage is below."""
    usage = UsageInfo(input_tokens=50000)
    total = derive_session_total_tokens(usage, context_tokens=200000)

    # Should not be capped
    assert total == 50000
