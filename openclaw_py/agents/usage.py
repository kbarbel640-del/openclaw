"""Usage tracking and normalization.

This module normalizes token usage across different AI provider formats.
"""

from typing import Any

from .types import UsageInfo


def normalize_usage(raw: dict[str, Any] | Any | None) -> UsageInfo | None:
    """Normalize usage information from various provider formats.

    Supports multiple naming conventions:
    - Anthropic: input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens
    - OpenAI: prompt_tokens, completion_tokens, total_tokens
    - litellm: standardized format

    Args:
        raw: Raw usage data from provider (dict or object with attributes)

    Returns:
        Normalized UsageInfo or None if no valid usage data

    Examples:
        >>> # Anthropic format
        >>> usage = normalize_usage({"input_tokens": 100, "output_tokens": 50})
        >>> usage.input_tokens
        100

        >>> # OpenAI format
        >>> usage = normalize_usage({"prompt_tokens": 100, "completion_tokens": 50})
        >>> usage.input_tokens
        100
    """
    if not raw:
        return None

    # Convert object to dict if needed
    if hasattr(raw, "__dict__"):
        raw = raw.__dict__
    elif hasattr(raw, "model_dump"):
        raw = raw.model_dump()

    if not isinstance(raw, dict):
        return None

    def get_value(*keys: str) -> int | None:
        """Get first non-None numeric value from keys."""
        for key in keys:
            value = raw.get(key)
            if isinstance(value, (int, float)) and value >= 0:
                return int(value)
        return None

    # Extract tokens with fallback names
    input_tokens = get_value(
        "input_tokens",
        "inputTokens",
        "prompt_tokens",
        "promptTokens",
    )

    output_tokens = get_value(
        "output_tokens",
        "outputTokens",
        "completion_tokens",
        "completionTokens",
    )

    cache_read_tokens = get_value(
        "cache_read_input_tokens",
        "cache_read_tokens",
        "cacheReadTokens",
        "cache_read",
    )

    cache_creation_tokens = get_value(
        "cache_creation_input_tokens",
        "cache_creation_tokens",
        "cacheCreationTokens",
        "cache_write",
    )

    total_tokens = get_value(
        "total_tokens",
        "totalTokens",
    )

    # If no values found, return None
    if all(
        x is None
        for x in [
            input_tokens,
            output_tokens,
            cache_read_tokens,
            cache_creation_tokens,
            total_tokens,
        ]
    ):
        return None

    # Calculate total if not provided
    if total_tokens is None and (input_tokens or output_tokens):
        total_tokens = (input_tokens or 0) + (output_tokens or 0)
        if cache_read_tokens:
            total_tokens += cache_read_tokens
        if cache_creation_tokens:
            total_tokens += cache_creation_tokens

    return UsageInfo(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_tokens=cache_read_tokens,
        cache_creation_tokens=cache_creation_tokens,
        total_tokens=total_tokens if total_tokens and total_tokens > 0 else None,
    )


def derive_prompt_tokens(usage: UsageInfo | None) -> int | None:
    """Calculate total prompt tokens (input + cache read + cache creation).

    Args:
        usage: Usage info

    Returns:
        Total prompt tokens or None
    """
    if not usage:
        return None

    total = (usage.input_tokens or 0) + (usage.cache_read_tokens or 0) + (usage.cache_creation_tokens or 0)

    return total if total > 0 else None


def merge_usage(usage1: UsageInfo | None, usage2: UsageInfo | None) -> UsageInfo | None:
    """Merge two usage info objects.

    Args:
        usage1: First usage info
        usage2: Second usage info

    Returns:
        Merged usage info or None
    """
    if not usage1 and not usage2:
        return None

    if not usage1:
        return usage2
    if not usage2:
        return usage1

    return UsageInfo(
        input_tokens=(usage1.input_tokens or 0) + (usage2.input_tokens or 0) or None,
        output_tokens=(usage1.output_tokens or 0) + (usage2.output_tokens or 0) or None,
        cache_read_tokens=(usage1.cache_read_tokens or 0) + (usage2.cache_read_tokens or 0) or None,
        cache_creation_tokens=(usage1.cache_creation_tokens or 0) + (usage2.cache_creation_tokens or 0)
        or None,
        total_tokens=(usage1.total_tokens or 0) + (usage2.total_tokens or 0) or None,
    )


def has_nonzero_usage(usage: UsageInfo | None) -> bool:
    """Check if usage has any non-zero token counts.

    Args:
        usage: Usage info to check

    Returns:
        True if any token count is positive

    Examples:
        >>> usage = UsageInfo(input_tokens=100, output_tokens=50)
        >>> has_nonzero_usage(usage)
        True

        >>> empty_usage = UsageInfo()
        >>> has_nonzero_usage(empty_usage)
        False
    """
    if not usage:
        return False

    return any(
        isinstance(v, int) and v > 0
        for v in [
            usage.input_tokens,
            usage.output_tokens,
            usage.cache_read_tokens,
            usage.cache_creation_tokens,
            usage.total_tokens,
        ]
    )


def derive_session_total_tokens(usage: UsageInfo | None, context_tokens: int | None = None) -> int | None:
    """Calculate session total tokens (input + cache, capped at context window).

    This is used to track how much of the context window is being used.

    Args:
        usage: Usage info
        context_tokens: Context window size (optional cap)

    Returns:
        Total session tokens or None

    Examples:
        >>> usage = UsageInfo(input_tokens=100, cache_read_tokens=20)
        >>> derive_session_total_tokens(usage)
        120

        >>> # With context cap
        >>> large_usage = UsageInfo(input_tokens=300000)
        >>> derive_session_total_tokens(large_usage, context_tokens=200000)
        200000
    """
    if not usage:
        return None

    input_tokens = usage.input_tokens or 0
    prompt_tokens = derive_prompt_tokens(usage)

    # Use prompt_tokens if available, otherwise fall back to input or total
    total = prompt_tokens or usage.total_tokens or input_tokens

    if not total or total <= 0:
        return None

    # Cap at context window if provided
    if context_tokens is not None and isinstance(context_tokens, int) and context_tokens > 0:
        total = min(total, context_tokens)

    return total
