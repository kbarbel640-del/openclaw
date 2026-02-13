"""Tests for transcript repair."""

import pytest

from openclaw_py.agents.transcript_repair import (
    make_missing_tool_result,
    repair_tool_call_inputs,
    repair_tool_use_result_pairing,
)
from openclaw_py.agents.types import AgentMessage


def test_make_missing_tool_result():
    """Test creating synthetic tool result."""
    result = make_missing_tool_result("call_123", "bash")

    assert result.role == "toolResult"
    assert "missing tool result" in result.content.lower()
    assert result.metadata is not None
    assert result.metadata.get("toolCallId") == "call_123"
    assert result.metadata.get("toolName") == "bash"
    assert result.metadata.get("isError") is True


def test_repair_tool_call_inputs_valid_tool_calls():
    """Test that valid tool calls are not dropped."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "text", "text": "Using tool"},
                {"type": "toolUse", "id": "call_1", "name": "bash", "input": {"command": "ls"}},
            ],
        )
    ]

    report = repair_tool_call_inputs(messages)

    assert report.dropped_tool_calls == 0
    assert report.dropped_assistant_messages == 0
    assert len(report.messages) == 1


def test_repair_tool_call_inputs_missing_input():
    """Test dropping tool calls with missing input."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "text", "text": "Text block"},
                {"type": "toolUse", "id": "call_1", "name": "bash"},  # Missing input
            ],
        )
    ]

    report = repair_tool_call_inputs(messages)

    assert report.dropped_tool_calls == 1
    # Assistant message should remain with just text block
    assert len(report.messages) == 1
    assert len(report.messages[0].content) == 1


def test_repair_tool_call_inputs_drops_empty_assistant():
    """Test dropping assistant message when all tool calls invalid."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "toolUse", "id": "call_1", "name": "bash"},  # Missing input
            ],
        )
    ]

    report = repair_tool_call_inputs(messages)

    assert report.dropped_tool_calls == 1
    assert report.dropped_assistant_messages == 1
    assert len(report.messages) == 0


def test_repair_tool_call_inputs_preserves_other_messages():
    """Test that non-assistant messages are preserved."""
    messages = [
        AgentMessage(role="user", content="Hello"),
        AgentMessage(
            role="assistant",
            content=[
                {"type": "toolUse", "id": "call_1", "name": "bash"},  # Missing input
            ],
        ),
        AgentMessage(role="user", content="World"),
    ]

    report = repair_tool_call_inputs(messages)

    # User messages should be preserved
    user_messages = [m for m in report.messages if m.role == "user"]
    assert len(user_messages) == 2


def test_repair_tool_use_result_pairing_correct_order():
    """Test that correct order is maintained."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "toolUse", "id": "call_1", "name": "bash", "input": {"command": "ls"}},
            ],
        ),
        AgentMessage(
            role="toolResult",  # type: ignore
            content="output",
            metadata={"toolCallId": "call_1"},
        ),
    ]

    report = repair_tool_use_result_pairing(messages)

    # Should maintain order and not make changes
    assert not report.moved
    assert len(report.added) == 0
    assert report.dropped_duplicate_count == 0
    assert report.dropped_orphan_count == 0


def test_repair_tool_use_result_pairing_moves_displaced_result():
    """Test moving tool result to correct position."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "toolUse", "id": "call_1", "name": "bash", "input": {"command": "ls"}},
            ],
        ),
        AgentMessage(role="user", content="Intervening message"),
        AgentMessage(
            role="toolResult",  # type: ignore
            content="output",
            metadata={"toolCallId": "call_1"},
        ),
    ]

    report = repair_tool_use_result_pairing(messages)

    # Should move tool result after assistant
    assert report.moved
    assert len(report.messages) == 3

    # Tool result should be right after assistant
    assert report.messages[0].role == "assistant"
    assert report.messages[1].role == "toolResult"
    assert report.messages[2].role == "user"


def test_repair_tool_use_result_pairing_adds_missing_result():
    """Test adding synthetic result for missing tool result."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "toolUse", "id": "call_1", "name": "bash", "input": {"command": "ls"}},
            ],
        ),
        AgentMessage(role="user", content="Next message"),
    ]

    report = repair_tool_use_result_pairing(messages)

    # Should add synthetic tool result
    assert len(report.added) == 1
    assert report.added[0].role == "toolResult"
    assert report.added[0].metadata.get("toolCallId") == "call_1"

    # Messages should include synthetic result
    assert len(report.messages) == 3
    assert report.messages[1].role == "toolResult"


def test_repair_tool_use_result_pairing_drops_duplicate():
    """Test dropping duplicate tool results."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "toolUse", "id": "call_1", "name": "bash", "input": {"command": "ls"}},
            ],
        ),
        AgentMessage(
            role="toolResult",  # type: ignore
            content="output 1",
            metadata={"toolCallId": "call_1"},
        ),
        AgentMessage(
            role="toolResult",  # type: ignore
            content="output 2",
            metadata={"toolCallId": "call_1"},  # Duplicate
        ),
    ]

    report = repair_tool_use_result_pairing(messages)

    # Should drop second result
    assert report.dropped_duplicate_count == 1
    tool_results = [m for m in report.messages if m.role == "toolResult"]
    assert len(tool_results) == 1


def test_repair_tool_use_result_pairing_drops_orphan():
    """Test dropping orphaned tool results."""
    messages = [
        AgentMessage(role="user", content="User message"),
        AgentMessage(
            role="toolResult",  # type: ignore
            content="orphaned result",
            metadata={"toolCallId": "call_999"},
        ),
        AgentMessage(role="user", content="Another message"),
    ]

    report = repair_tool_use_result_pairing(messages)

    # Should drop orphaned result
    assert report.dropped_orphan_count == 1
    tool_results = [m for m in report.messages if m.role == "toolResult"]
    assert len(tool_results) == 0


def test_repair_tool_use_result_pairing_skips_aborted():
    """Test that aborted/errored assistant messages are skipped."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "toolUse", "id": "call_1", "name": "bash", "input": {"command": "ls"}},
            ],
            metadata={"stopReason": "aborted"},
        ),
        AgentMessage(role="user", content="Next message"),
    ]

    report = repair_tool_use_result_pairing(messages)

    # Should not add synthetic result for aborted message
    assert len(report.added) == 0


def test_repair_tool_use_result_pairing_multiple_tool_calls():
    """Test repair with multiple tool calls in one assistant message."""
    messages = [
        AgentMessage(
            role="assistant",
            content=[
                {"type": "toolUse", "id": "call_1", "name": "bash", "input": {}},
                {"type": "toolUse", "id": "call_2", "name": "read", "input": {}},
            ],
        ),
        AgentMessage(
            role="toolResult",  # type: ignore
            content="result 1",
            metadata={"toolCallId": "call_1"},
        ),
        # Missing result for call_2
    ]

    report = repair_tool_use_result_pairing(messages)

    # Should add missing result for call_2
    assert len(report.added) == 1
    assert report.added[0].metadata.get("toolCallId") == "call_2"

    # Should have 3 messages: assistant, result1, result2
    assert len(report.messages) == 3
