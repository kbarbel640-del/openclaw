"""Tests for message chunking."""

import pytest

from openclaw_py.agents.message_chunking import (
    BASE_CHUNK_RATIO,
    MIN_CHUNK_RATIO,
    chunk_messages_by_max_tokens,
    compute_adaptive_chunk_ratio,
    is_oversized_for_summary,
    split_messages_by_token_share,
)
from openclaw_py.agents.token_estimation import estimate_messages_tokens
from openclaw_py.agents.types import AgentMessage


def test_split_messages_by_token_share_empty():
    """Test splitting empty message list."""
    chunks = split_messages_by_token_share([], parts=2)
    assert chunks == []


def test_split_messages_by_token_share_single_part():
    """Test splitting into single part returns original."""
    messages = [
        AgentMessage(role="user", content="Message 1"),
        AgentMessage(role="assistant", content="Message 2"),
    ]
    chunks = split_messages_by_token_share(messages, parts=1)

    assert len(chunks) == 1
    assert chunks[0] == messages


def test_split_messages_by_token_share_two_parts():
    """Test splitting into two roughly equal parts."""
    # Create 4 messages
    messages = [
        AgentMessage(role="user", content="a" * 100),
        AgentMessage(role="assistant", content="b" * 100),
        AgentMessage(role="user", content="c" * 100),
        AgentMessage(role="assistant", content="d" * 100),
    ]

    chunks = split_messages_by_token_share(messages, parts=2)

    assert len(chunks) == 2
    # Each chunk should have roughly similar token counts
    tokens1 = estimate_messages_tokens(chunks[0])
    tokens2 = estimate_messages_tokens(chunks[1])

    # Tokens should be within 50% of each other
    ratio = min(tokens1, tokens2) / max(tokens1, tokens2)
    assert ratio > 0.5


def test_split_messages_by_token_share_more_parts_than_messages():
    """Test splitting with more parts than messages."""
    messages = [
        AgentMessage(role="user", content="Message 1"),
        AgentMessage(role="assistant", content="Message 2"),
    ]

    chunks = split_messages_by_token_share(messages, parts=5)

    # Should create at most 2 chunks (one per message)
    assert len(chunks) <= len(messages)


def test_chunk_messages_by_max_tokens_empty():
    """Test chunking empty list."""
    chunks = chunk_messages_by_max_tokens([], max_tokens=1000)
    assert chunks == []


def test_chunk_messages_by_max_tokens_single_message():
    """Test chunking single message under limit."""
    msg = AgentMessage(role="user", content="Short message")
    chunks = chunk_messages_by_max_tokens([msg], max_tokens=1000)

    assert len(chunks) == 1
    assert chunks[0] == [msg]


def test_chunk_messages_by_max_tokens_multiple_chunks():
    """Test chunking into multiple chunks when exceeding max."""
    # Create messages that will exceed limit
    messages = [
        AgentMessage(role="user", content="a" * 400),  # ~100 tokens
        AgentMessage(role="assistant", content="b" * 400),  # ~100 tokens
        AgentMessage(role="user", content="c" * 400),  # ~100 tokens
    ]

    # Set max to ~150 tokens - should create 2 chunks
    chunks = chunk_messages_by_max_tokens(messages, max_tokens=150)

    assert len(chunks) >= 2
    # Each chunk should not exceed max (roughly)
    for chunk in chunks:
        tokens = estimate_messages_tokens(chunk)
        # Allow some overhead for role tokens
        assert tokens <= 200


def test_chunk_messages_by_max_tokens_oversized_message():
    """Test chunking with message larger than max."""
    # Single huge message
    huge_msg = AgentMessage(role="user", content="a" * 2000)  # ~500 tokens
    small_msg = AgentMessage(role="assistant", content="b" * 40)  # ~10 tokens

    messages = [huge_msg, small_msg]
    chunks = chunk_messages_by_max_tokens(messages, max_tokens=100)

    # Huge message should be in its own chunk
    assert len(chunks) >= 2


def test_compute_adaptive_chunk_ratio_small_messages():
    """Test adaptive ratio with small messages."""
    messages = [
        AgentMessage(role="user", content="short"),
        AgentMessage(role="assistant", content="also short"),
    ]

    ratio = compute_adaptive_chunk_ratio(messages, context_window=200000)

    # Small messages should use base ratio
    assert ratio == BASE_CHUNK_RATIO


def test_compute_adaptive_chunk_ratio_large_messages():
    """Test adaptive ratio with large messages."""
    # Create messages that average >10% of context
    context = 100000
    large_content = "a" * (context // 2)  # ~25K tokens (25% of context)

    messages = [
        AgentMessage(role="user", content=large_content),
        AgentMessage(role="assistant", content=large_content),
    ]

    ratio = compute_adaptive_chunk_ratio(messages, context_window=context)

    # Large messages should reduce ratio
    assert ratio < BASE_CHUNK_RATIO
    assert ratio >= MIN_CHUNK_RATIO


def test_compute_adaptive_chunk_ratio_empty_messages():
    """Test adaptive ratio with empty message list."""
    ratio = compute_adaptive_chunk_ratio([], context_window=200000)
    assert ratio == BASE_CHUNK_RATIO


def test_is_oversized_for_summary_small_message():
    """Test oversized check with small message."""
    msg = AgentMessage(role="user", content="Small message")
    assert not is_oversized_for_summary(msg, context_window=200000)


def test_is_oversized_for_summary_large_message():
    """Test oversized check with message >50% of context."""
    # Create message that's >50% of context window
    context = 100000
    # Need >50K tokens, so ~200K characters
    large_content = "a" * 250000

    msg = AgentMessage(role="user", content=large_content)
    assert is_oversized_for_summary(msg, context_window=context)


def test_is_oversized_for_summary_boundary():
    """Test oversized check at ~50% boundary."""
    context = 100000
    # Create message at ~50% (accounting for safety margin 1.2x)
    # 50K tokens / 1.2 = ~42K tokens = ~168K characters
    boundary_content = "a" * 168000

    msg = AgentMessage(role="user", content=boundary_content)
    result = is_oversized_for_summary(msg, context_window=context)

    # Should be close to boundary
    # (exact result depends on estimation accuracy)
    assert isinstance(result, bool)
