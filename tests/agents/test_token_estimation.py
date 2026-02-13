"""Tests for token estimation."""

import pytest

from openclaw_py.agents.token_estimation import estimate_messages_tokens, estimate_tokens
from openclaw_py.agents.types import AgentMessage


def test_estimate_tokens_basic():
    """Test basic token estimation."""
    msg = AgentMessage(role="user", content="Hello world")
    tokens = estimate_tokens(msg)
    assert tokens > 0
    assert isinstance(tokens, int)


def test_estimate_tokens_long_content():
    """Test token estimation with long content."""
    # ~400 characters should be ~100 tokens (4 chars per token)
    content = "a" * 400
    msg = AgentMessage(role="user", content=content)
    tokens = estimate_tokens(msg)
    # Should be around 100 + overhead (4 for role)
    assert 90 < tokens < 120


def test_estimate_tokens_with_name():
    """Test token estimation includes name overhead."""
    msg_without_name = AgentMessage(role="user", content="Hello")
    msg_with_name = AgentMessage(role="user", content="Hello", name="TestUser")

    tokens_without = estimate_tokens(msg_without_name)
    tokens_with = estimate_tokens(msg_with_name)

    # Message with name should have more tokens
    assert tokens_with > tokens_without


def test_estimate_tokens_very_short_content():
    """Test token estimation with very short content."""
    msg = AgentMessage(role="user", content="a")
    tokens = estimate_tokens(msg)
    # Should have at least 1 token (plus overhead)
    assert tokens >= 1


def test_estimate_messages_tokens_empty_list():
    """Test estimating tokens for empty message list."""
    tokens = estimate_messages_tokens([])
    assert tokens == 0


def test_estimate_messages_tokens_single_message():
    """Test estimating tokens for single message."""
    msg = AgentMessage(role="user", content="Hello world")
    tokens = estimate_messages_tokens([msg])
    assert tokens > 0
    assert tokens == estimate_tokens(msg)


def test_estimate_messages_tokens_multiple_messages():
    """Test estimating tokens for multiple messages."""
    messages = [
        AgentMessage(role="user", content="Hello"),
        AgentMessage(role="assistant", content="Hi there"),
        AgentMessage(role="user", content="How are you?"),
    ]
    total = estimate_messages_tokens(messages)

    # Total should equal sum of individual estimates
    expected = sum(estimate_tokens(msg) for msg in messages)
    assert total == expected


def test_estimate_messages_tokens_consistency():
    """Test that estimation is consistent."""
    messages = [
        AgentMessage(role="user", content="Test message"),
        AgentMessage(role="assistant", content="Response"),
    ]

    tokens1 = estimate_messages_tokens(messages)
    tokens2 = estimate_messages_tokens(messages)

    assert tokens1 == tokens2
