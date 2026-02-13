"""Token estimation for agent messages.

This module provides simple heuristic-based token estimation.
Uses character count / 4 as a rough approximation.
"""

from .types import AgentMessage


def estimate_tokens(message: AgentMessage) -> int:
    """Estimate token count for a single message.

    Uses a simple heuristic: character count / 4.
    This is a rough approximation that works across different tokenizers.

    Args:
        message: Agent message to estimate

    Returns:
        Estimated token count (minimum 1)

    Examples:
        >>> msg = AgentMessage(role="user", content="Hello world")
        >>> estimate_tokens(msg)
        3
    """
    if not message or not message.content:
        return 1

    # Handle both string and structured content
    if isinstance(message.content, str):
        char_count = len(message.content)
    elif isinstance(message.content, list):
        # Estimate tokens for structured content (e.g., tool_use blocks)
        import json

        # Convert to JSON string for estimation
        json_str = json.dumps(message.content)
        char_count = len(json_str)
    else:
        char_count = 1

    # Simple heuristic: 4 characters per token on average
    token_count = max(1, char_count // 4)

    # Add overhead for role and metadata
    token_count += 4  # Role overhead

    if message.name:
        token_count += len(message.name) // 4

    return token_count


def estimate_messages_tokens(messages: list[AgentMessage]) -> int:
    """Estimate total token count for a list of messages.

    Args:
        messages: List of agent messages

    Returns:
        Total estimated token count

    Examples:
        >>> messages = [
        ...     AgentMessage(role="user", content="Hello"),
        ...     AgentMessage(role="assistant", content="Hi there"),
        ... ]
        >>> estimate_messages_tokens(messages)
        12
    """
    if not messages:
        return 0

    return sum(estimate_tokens(msg) for msg in messages)
