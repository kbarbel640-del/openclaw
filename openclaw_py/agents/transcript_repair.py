"""Session transcript repair utilities.

This module repairs tool_use/tool_result pairing issues in message transcripts.
Anthropic API requires strict pairing: assistant tool calls must be immediately
followed by matching tool results.
"""

import time
from typing import Any, NamedTuple

from .types import AgentMessage

TOOL_CALL_TYPES = {"toolCall", "toolUse", "functionCall"}


class ToolCallLike(NamedTuple):
    """Simplified tool call representation.

    Attributes:
        id: Tool call ID
        name: Tool name (optional)
    """

    id: str
    name: str | None = None


class ToolUseRepairReport(NamedTuple):
    """Report from tool_use/tool_result repair.

    Attributes:
        messages: Repaired message list
        added: Synthetic tool_result messages that were added
        dropped_duplicate_count: Number of duplicate tool_results dropped
        dropped_orphan_count: Number of orphaned tool_results dropped
        moved: Whether any tool_results were moved
    """

    messages: list[AgentMessage]
    added: list[AgentMessage]
    dropped_duplicate_count: int
    dropped_orphan_count: int
    moved: bool


class ToolCallInputRepairReport(NamedTuple):
    """Report from tool_call input repair.

    Attributes:
        messages: Repaired message list
        dropped_tool_calls: Number of invalid tool_calls dropped
        dropped_assistant_messages: Number of empty assistant messages dropped
    """

    messages: list[AgentMessage]
    dropped_tool_calls: int
    dropped_assistant_messages: int


def _extract_tool_calls_from_assistant(msg: AgentMessage) -> list[ToolCallLike]:
    """Extract tool calls from assistant message.

    Args:
        msg: Assistant message

    Returns:
        List of tool calls found in message content
    """
    if msg.role != "assistant":
        return []

    # Check if content is structured (list of blocks)
    content = msg.content if isinstance(msg.content, list) else []
    if not isinstance(content, list):
        return []

    tool_calls: list[ToolCallLike] = []
    for block in content:
        if not isinstance(block, dict):
            continue

        block_type = block.get("type")
        block_id = block.get("id")
        block_name = block.get("name")

        if (
            isinstance(block_type, str)
            and block_type in TOOL_CALL_TYPES
            and isinstance(block_id, str)
            and block_id
        ):
            tool_calls.append(ToolCallLike(id=block_id, name=block_name if isinstance(block_name, str) else None))

    return tool_calls


def _is_tool_call_block(block: Any) -> bool:
    """Check if block is a tool call."""
    if not isinstance(block, dict):
        return False
    block_type = block.get("type")
    return isinstance(block_type, str) and block_type in TOOL_CALL_TYPES


def _has_tool_call_input(block: dict[str, Any]) -> bool:
    """Check if tool call block has input/arguments."""
    has_input = "input" in block and block["input"] is not None
    has_arguments = "arguments" in block and block["arguments"] is not None
    return has_input or has_arguments


def _extract_tool_result_id(msg: AgentMessage) -> str | None:
    """Extract tool call ID from tool_result message.

    Args:
        msg: Tool result message

    Returns:
        Tool call ID or None
    """
    if msg.role != "toolResult":
        return None

    # Check for toolCallId or toolUseId in metadata
    if msg.metadata:
        tool_call_id = msg.metadata.get("toolCallId") or msg.metadata.get("toolUseId")
        if isinstance(tool_call_id, str) and tool_call_id:
            return tool_call_id

    return None


def make_missing_tool_result(tool_call_id: str, tool_name: str | None = None) -> AgentMessage:
    """Create synthetic error tool_result for missing result.

    Args:
        tool_call_id: Tool call ID that's missing result
        tool_name: Tool name (optional)

    Returns:
        Synthetic tool_result message

    Examples:
        >>> result = make_missing_tool_result("call_123", "bash")
        >>> result.role
        'toolResult'
    """
    return AgentMessage(
        role="toolResult",  # type: ignore
        content="[openclaw] missing tool result in session history; inserted synthetic error result for transcript repair.",
        metadata={
            "toolCallId": tool_call_id,
            "toolName": tool_name or "unknown",
            "isError": True,
            "timestamp": int(time.time() * 1000),
        },
    )


def repair_tool_call_inputs(messages: list[AgentMessage]) -> ToolCallInputRepairReport:
    """Repair assistant messages with invalid tool calls (missing input/arguments).

    Drops tool_call blocks that lack input/arguments. Drops empty assistant messages.

    Args:
        messages: Messages to repair

    Returns:
        ToolCallInputRepairReport with repaired messages and stats

    Examples:
        >>> messages = [assistant_msg_with_invalid_tool_call]
        >>> report = repair_tool_call_inputs(messages)
        >>> report.dropped_tool_calls
        1
    """
    dropped_tool_calls = 0
    dropped_assistant_messages = 0
    changed = False
    out: list[AgentMessage] = []

    for msg in messages:
        if not msg or msg.role != "assistant":
            out.append(msg)
            continue

        # Check if content is structured
        content = msg.content if isinstance(msg.content, list) else None
        if not isinstance(content, list):
            out.append(msg)
            continue

        next_content: list[Any] = []
        dropped_in_message = 0

        for block in content:
            if _is_tool_call_block(block) and not _has_tool_call_input(block):
                dropped_tool_calls += 1
                dropped_in_message += 1
                changed = True
                continue
            next_content.append(block)

        # If all blocks dropped, drop entire message
        if dropped_in_message > 0:
            if not next_content:
                dropped_assistant_messages += 1
                changed = True
                continue
            # Create new message with filtered content
            out.append(AgentMessage(role=msg.role, content=next_content, metadata=msg.metadata))
            continue

        out.append(msg)

    return ToolCallInputRepairReport(
        messages=out if changed else messages,
        dropped_tool_calls=dropped_tool_calls,
        dropped_assistant_messages=dropped_assistant_messages,
    )


def repair_tool_use_result_pairing(messages: list[AgentMessage]) -> ToolUseRepairReport:
    """Repair tool_use/tool_result pairing issues.

    Ensures assistant tool calls are immediately followed by matching tool results:
    - Moves matching tool_result messages after their assistant turn
    - Inserts synthetic error tool_results for missing IDs
    - Drops duplicate tool_results (same ID seen multiple times)
    - Drops orphaned tool_results (no matching tool_use)

    Args:
        messages: Messages to repair

    Returns:
        ToolUseRepairReport with repaired messages and stats

    Examples:
        >>> messages = [assistant_with_tool_call, user_message, tool_result]
        >>> report = repair_tool_use_result_pairing(messages)
        >>> report.moved
        True
    """
    out: list[AgentMessage] = []
    added: list[AgentMessage] = []
    seen_tool_result_ids: set[str] = set()
    dropped_duplicate_count = 0
    dropped_orphan_count = 0
    moved = False
    changed = False

    def push_tool_result(msg: AgentMessage) -> None:
        """Add tool_result to output, checking for duplicates."""
        nonlocal dropped_duplicate_count, changed

        result_id = _extract_tool_result_id(msg)
        if result_id and result_id in seen_tool_result_ids:
            dropped_duplicate_count += 1
            changed = True
            return

        if result_id:
            seen_tool_result_ids.add(result_id)

        out.append(msg)

    i = 0
    while i < len(messages):
        msg = messages[i]

        if not msg or msg.role != "assistant":
            # Drop orphaned tool_results (not after assistant)
            if msg and msg.role == "toolResult":
                dropped_orphan_count += 1
                changed = True
            else:
                out.append(msg)
            i += 1
            continue

        # Extract tool calls from assistant message
        # Skip if stopReason is "error" or "aborted" (incomplete tool_use blocks)
        stop_reason = msg.metadata.get("stopReason") if msg.metadata else None
        if stop_reason in ("error", "aborted"):
            out.append(msg)
            i += 1
            continue

        tool_calls = _extract_tool_calls_from_assistant(msg)
        if not tool_calls:
            out.append(msg)
            i += 1
            continue

        tool_call_ids = {call.id for call in tool_calls}

        # Look ahead for matching tool_results
        span_results_by_id: dict[str, AgentMessage] = {}
        remainder: list[AgentMessage] = []

        j = i + 1
        while j < len(messages):
            next_msg = messages[j]

            if not next_msg:
                remainder.append(next_msg)
                j += 1
                continue

            # Stop at next assistant message
            if next_msg.role == "assistant":
                break

            # Collect matching tool_results
            if next_msg.role == "toolResult":
                result_id = _extract_tool_result_id(next_msg)
                if result_id and result_id in tool_call_ids:
                    # Skip duplicates (already seen globally or in current span)
                    if result_id in seen_tool_result_ids or result_id in span_results_by_id:
                        dropped_duplicate_count += 1
                        changed = True
                        j += 1
                        continue
                    # First occurrence in this span
                    span_results_by_id[result_id] = next_msg
                    j += 1
                    continue

            # Drop orphaned tool_results
            if next_msg.role == "toolResult":
                dropped_orphan_count += 1
                changed = True
            else:
                remainder.append(next_msg)

            j += 1

        # Add assistant message
        out.append(msg)

        # Track if we moved any results
        if span_results_by_id and remainder:
            moved = True
            changed = True

        # Add tool_results in order of tool_calls
        for call in tool_calls:
            existing = span_results_by_id.get(call.id)
            if existing:
                push_tool_result(existing)
            else:
                # Insert synthetic error result
                missing = make_missing_tool_result(call.id, call.name)
                added.append(missing)
                changed = True
                push_tool_result(missing)

        # Add remaining non-tool-result messages
        for rem in remainder:
            out.append(rem)

        # Skip processed messages
        i = j

    return ToolUseRepairReport(
        messages=out if changed else messages,
        added=added,
        dropped_duplicate_count=dropped_duplicate_count,
        dropped_orphan_count=dropped_orphan_count,
        moved=moved,
    )
