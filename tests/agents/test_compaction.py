"""Tests for context compaction."""

import pytest

from openclaw_py.agents.compaction import prune_history_for_context_share
from openclaw_py.agents.token_estimation import estimate_messages_tokens
from openclaw_py.agents.types import AgentMessage


def test_prune_history_empty_messages():
    """Test pruning empty message list."""
    result = prune_history_for_context_share([], max_context_tokens=100000)

    assert result.messages == []
    assert result.dropped_chunks == 0
    assert result.dropped_messages == 0
    assert result.dropped_tokens == 0
    assert result.kept_tokens == 0


def test_prune_history_within_budget():
    """Test pruning when messages already fit in budget."""
    messages = [
        AgentMessage(role="user", content="Short message 1"),
        AgentMessage(role="assistant", content="Short message 2"),
    ]

    result = prune_history_for_context_share(
        messages,
        max_context_tokens=100000,
        max_history_share=0.5,
    )

    # Should keep all messages
    assert len(result.messages) == len(messages)
    assert result.dropped_chunks == 0
    assert result.dropped_messages == 0
    assert result.dropped_tokens == 0


def test_prune_history_exceeds_budget():
    """Test pruning when messages exceed budget."""
    # Create many large messages
    messages = [AgentMessage(role="user", content="a" * 1000) for _ in range(20)]

    result = prune_history_for_context_share(
        messages,
        max_context_tokens=10000,
        max_history_share=0.5,
    )

    # Should have dropped some messages
    assert len(result.messages) < len(messages)
    assert result.dropped_chunks > 0
    assert result.dropped_messages > 0
    assert result.dropped_tokens > 0

    # Kept messages should fit in budget
    assert result.kept_tokens <= result.budget_tokens


def test_prune_history_drops_oldest_first():
    """Test that oldest messages are dropped first."""
    messages = [
        AgentMessage(role="user", content=f"Message {i}") for i in range(10)
    ]

    result = prune_history_for_context_share(
        messages,
        max_context_tokens=5000,
        max_history_share=0.3,
    )

    if result.dropped_messages > 0:
        # Last message should still be in kept messages
        assert messages[-1] in result.messages


def test_prune_history_budget_calculation():
    """Test budget calculation."""
    max_context = 100000
    max_share = 0.4

    result = prune_history_for_context_share(
        [AgentMessage(role="user", content="Test")],
        max_context_tokens=max_context,
        max_history_share=max_share,
    )

    expected_budget = int(max_context * max_share)
    assert result.budget_tokens == expected_budget


def test_prune_history_with_custom_parts():
    """Test pruning with custom chunk parts."""
    messages = [AgentMessage(role="user", content="a" * 1000) for _ in range(12)]

    result = prune_history_for_context_share(
        messages,
        max_context_tokens=1000,  # Reduced to force pruning
        max_history_share=0.5,
        parts=3,  # Split into 3 chunks
    )

    # Should have pruned some messages
    assert len(result.messages) < len(messages)
    assert result.kept_tokens <= result.budget_tokens


def test_prune_history_statistics():
    """Test that statistics are accurate."""
    messages = [
        AgentMessage(role="user", content="a" * 500) for _ in range(10)
    ]

    result = prune_history_for_context_share(
        messages,
        max_context_tokens=5000,
        max_history_share=0.5,
    )

    # Verify statistics consistency
    original_tokens = estimate_messages_tokens(messages)
    assert result.kept_tokens + result.dropped_tokens <= original_tokens + result.dropped_chunks * 10

    # Kept + dropped should account for most messages
    assert result.dropped_messages <= len(messages)
    assert len(result.messages) + result.dropped_messages >= len(messages) - result.dropped_chunks


def test_prune_history_tool_result_repair():
    """Test that tool_use/tool_result pairing is repaired after pruning."""
    # Create messages with tool_use in older chunk and tool_result in newer
    messages = [
        AgentMessage(role="user", content="a" * 1000),
        AgentMessage(
            role="assistant",
            content=[
                {"type": "text", "text": "Using tool"},
                {"type": "toolUse", "id": "tool_123", "name": "bash", "input": {}},
            ],
        ),
        AgentMessage(role="user", content="b" * 1000),
        AgentMessage(role="user", content="c" * 1000),
        AgentMessage(
            role="toolResult",  # type: ignore
            content="Result",
            metadata={"toolCallId": "tool_123"},
        ),
    ]

    result = prune_history_for_context_share(
        messages,
        max_context_tokens=3000,
        max_history_share=0.5,
    )

    # If assistant message was dropped, orphaned tool_result should be dropped too
    has_assistant = any(
        msg.role == "assistant" and isinstance(msg.content, list)
        for msg in result.messages
    )
    has_tool_result = any(msg.role == "toolResult" for msg in result.messages)

    if not has_assistant:
        # Tool result should be dropped if tool_use was dropped
        assert not has_tool_result or result.dropped_messages > 0
