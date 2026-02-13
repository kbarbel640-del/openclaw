"""Context compaction and history pruning.

This module handles pruning message history to fit within context window budgets.
"""

from typing import NamedTuple

from .message_chunking import DEFAULT_PARTS, _normalize_parts, split_messages_by_token_share
from .token_estimation import estimate_messages_tokens
from .transcript_repair import repair_tool_use_result_pairing
from .types import AgentMessage


class PruneHistoryResult(NamedTuple):
    """Result from pruning message history.

    Attributes:
        messages: Remaining messages after pruning
        dropped_messages_list: Messages that were dropped
        dropped_chunks: Number of chunks dropped
        dropped_messages: Total number of messages dropped
        dropped_tokens: Total tokens dropped
        kept_tokens: Total tokens kept
        budget_tokens: Token budget that was enforced
    """

    messages: list[AgentMessage]
    dropped_messages_list: list[AgentMessage]
    dropped_chunks: int
    dropped_messages: int
    dropped_tokens: int
    kept_tokens: int
    budget_tokens: int


def prune_history_for_context_share(
    messages: list[AgentMessage],
    max_context_tokens: int,
    max_history_share: float = 0.5,
    parts: int = DEFAULT_PARTS,
) -> PruneHistoryResult:
    """Prune message history to fit within context window budget.

    Removes oldest message chunks until history fits within max_history_share
    of max_context_tokens. After each chunk drop, repairs tool_use/tool_result
    pairing to handle orphaned tool_results.

    Args:
        messages: Messages to prune
        max_context_tokens: Maximum context window size
        max_history_share: Maximum fraction of context for history (default: 0.5)
        parts: Number of parts to split into for pruning (default: 2)

    Returns:
        PruneHistoryResult with pruned messages and statistics

    Examples:
        >>> messages = [msg1, msg2, msg3, msg4]
        >>> result = prune_history_for_context_share(messages, 100000)
        >>> result.kept_tokens <= result.budget_tokens
        True
    """
    budget_tokens = max(1, int(max_context_tokens * max_history_share))
    kept_messages = messages.copy()
    all_dropped_messages: list[AgentMessage] = []
    dropped_chunks = 0
    dropped_messages = 0
    dropped_tokens = 0

    normalized_parts = _normalize_parts(parts, len(kept_messages))

    # Keep dropping oldest chunks until we fit in budget
    while kept_messages and estimate_messages_tokens(kept_messages) > budget_tokens:
        chunks = split_messages_by_token_share(kept_messages, normalized_parts)

        # Can't split further
        if len(chunks) <= 1:
            break

        # Drop first (oldest) chunk
        dropped, *rest = chunks
        flat_rest = [msg for chunk in rest for msg in chunk]

        # Repair tool_use/tool_result pairing after dropping chunk
        # This handles orphaned tool_results whose tool_use was dropped
        repair_report = repair_tool_use_result_pairing(flat_rest)
        repaired_kept = repair_report.messages

        # Track orphaned tool_results as dropped
        orphaned_count = repair_report.dropped_orphan_count

        dropped_chunks += 1
        dropped_messages += len(dropped) + orphaned_count
        dropped_tokens += estimate_messages_tokens(dropped)
        all_dropped_messages.extend(dropped)

        kept_messages = repaired_kept

    return PruneHistoryResult(
        messages=kept_messages,
        dropped_messages_list=all_dropped_messages,
        dropped_chunks=dropped_chunks,
        dropped_messages=dropped_messages,
        dropped_tokens=dropped_tokens,
        kept_tokens=estimate_messages_tokens(kept_messages),
        budget_tokens=budget_tokens,
    )
