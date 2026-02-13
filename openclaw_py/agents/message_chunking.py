"""Message chunking for context management.

This module provides functions to split messages into chunks based on token counts.
"""

from .token_estimation import estimate_messages_tokens, estimate_tokens
from .types import AgentMessage

# Base chunk ratio (40% of context window)
BASE_CHUNK_RATIO = 0.4

# Minimum chunk ratio (15% of context window)
MIN_CHUNK_RATIO = 0.15

# Safety margin for estimation inaccuracy (20% buffer)
SAFETY_MARGIN = 1.2

DEFAULT_PARTS = 2


def _normalize_parts(parts: int, message_count: int) -> int:
    """Normalize parts count to valid range.

    Args:
        parts: Requested number of parts
        message_count: Total message count

    Returns:
        Normalized parts count (1 to message_count)
    """
    if parts <= 1:
        return 1
    return min(max(1, int(parts)), max(1, message_count))


def split_messages_by_token_share(
    messages: list[AgentMessage],
    parts: int = DEFAULT_PARTS,
) -> list[list[AgentMessage]]:
    """Split messages into roughly equal token shares.

    Used for parallel summarization - each chunk will have similar token count.

    Args:
        messages: Messages to split
        parts: Number of parts to split into (default: 2)

    Returns:
        List of message chunks

    Examples:
        >>> messages = [msg1, msg2, msg3, msg4]
        >>> chunks = split_messages_by_token_share(messages, parts=2)
        >>> len(chunks)
        2
    """
    if not messages:
        return []

    normalized_parts = _normalize_parts(parts, len(messages))
    if normalized_parts <= 1:
        return [messages]

    total_tokens = estimate_messages_tokens(messages)
    target_tokens = total_tokens / normalized_parts
    chunks: list[list[AgentMessage]] = []
    current: list[AgentMessage] = []
    current_tokens = 0

    for message in messages:
        message_tokens = estimate_tokens(message)

        # Start new chunk if we're not on the last chunk and would exceed target
        if (
            len(chunks) < normalized_parts - 1
            and len(current) > 0
            and current_tokens + message_tokens > target_tokens
        ):
            chunks.append(current)
            current = []
            current_tokens = 0

        current.append(message)
        current_tokens += message_tokens

    # Add remaining messages
    if current:
        chunks.append(current)

    return chunks


def chunk_messages_by_max_tokens(
    messages: list[AgentMessage],
    max_tokens: int,
) -> list[list[AgentMessage]]:
    """Split messages into chunks not exceeding max_tokens.

    Args:
        messages: Messages to split
        max_tokens: Maximum tokens per chunk

    Returns:
        List of message chunks

    Examples:
        >>> messages = [msg1, msg2, msg3]
        >>> chunks = chunk_messages_by_max_tokens(messages, max_tokens=5000)
        >>> all(estimate_messages_tokens(chunk) <= 5000 for chunk in chunks)
        True
    """
    if not messages:
        return []

    chunks: list[list[AgentMessage]] = []
    current_chunk: list[AgentMessage] = []
    current_tokens = 0

    for message in messages:
        message_tokens = estimate_tokens(message)

        # Start new chunk if adding this message would exceed max
        if current_chunk and current_tokens + message_tokens > max_tokens:
            chunks.append(current_chunk)
            current_chunk = []
            current_tokens = 0

        current_chunk.append(message)
        current_tokens += message_tokens

        # If single message exceeds max_tokens, put it in its own chunk
        if message_tokens > max_tokens:
            chunks.append(current_chunk)
            current_chunk = []
            current_tokens = 0

    # Add remaining messages
    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def compute_adaptive_chunk_ratio(messages: list[AgentMessage], context_window: int) -> float:
    """Compute adaptive chunk ratio based on average message size.

    When messages are large, use smaller chunks to avoid exceeding model limits.

    Args:
        messages: Messages to analyze
        context_window: Context window size in tokens

    Returns:
        Chunk ratio (between MIN_CHUNK_RATIO and BASE_CHUNK_RATIO)

    Examples:
        >>> messages = [AgentMessage(role="user", content="short")]
        >>> ratio = compute_adaptive_chunk_ratio(messages, 200000)
        >>> ratio
        0.4
    """
    if not messages or context_window <= 0:
        return BASE_CHUNK_RATIO

    total_tokens = estimate_messages_tokens(messages)
    avg_tokens = total_tokens / len(messages)

    # Apply safety margin for estimation inaccuracy
    safe_avg_tokens = avg_tokens * SAFETY_MARGIN
    avg_ratio = safe_avg_tokens / context_window

    # If average message is > 10% of context, reduce chunk ratio
    if avg_ratio > 0.1:
        reduction = min(avg_ratio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO)
        return max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction)

    return BASE_CHUNK_RATIO


def is_oversized_for_summary(message: AgentMessage, context_window: int) -> bool:
    """Check if a single message is too large to summarize safely.

    If message > 50% of context window, it can't be summarized.

    Args:
        message: Message to check
        context_window: Context window size in tokens

    Returns:
        True if message is too large for summarization

    Examples:
        >>> msg = AgentMessage(role="user", content="short text")
        >>> is_oversized_for_summary(msg, 200000)
        False
    """
    if context_window <= 0:
        return False

    tokens = estimate_tokens(message) * SAFETY_MARGIN
    return tokens > context_window * 0.5
