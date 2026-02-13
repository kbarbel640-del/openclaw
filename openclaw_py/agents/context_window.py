"""Context window management and guards.

This module handles context window size resolution and validation.
"""

from typing import Literal, NamedTuple

from openclaw_py.config import OpenClawConfig

from .defaults import DEFAULT_CONTEXT_TOKENS

# Hard minimum context window (will block if below this)
CONTEXT_WINDOW_HARD_MIN_TOKENS = 16_000

# Warning threshold (will warn if below this)
CONTEXT_WINDOW_WARN_BELOW_TOKENS = 32_000

ContextWindowSource = Literal["model", "modelsConfig", "agentContextTokens", "default"]


class ContextWindowInfo(NamedTuple):
    """Context window size information.

    Attributes:
        tokens: Context window size in tokens
        source: Where the value came from
    """

    tokens: int
    source: ContextWindowSource


class ContextWindowGuardResult(NamedTuple):
    """Context window guard evaluation result.

    Attributes:
        tokens: Context window size
        source: Where the value came from
        should_warn: Whether to warn about small context window
        should_block: Whether to block due to too small context window
    """

    tokens: int
    source: ContextWindowSource
    should_warn: bool
    should_block: bool


def _normalize_positive_int(value: int | float | None) -> int | None:
    """Normalize value to positive integer.

    Args:
        value: Value to normalize

    Returns:
        Positive integer or None
    """
    if value is None:
        return None

    if not isinstance(value, (int, float)):
        return None

    if not (isinstance(value, (int, float)) and value > 0):
        return None

    int_value = int(value)
    return int_value if int_value > 0 else None


def resolve_context_window_info(
    cfg: OpenClawConfig | None,
    provider: str,
    model_id: str,
    model_context_window: int | None = None,
    default_tokens: int = DEFAULT_CONTEXT_TOKENS,
) -> ContextWindowInfo:
    """Resolve context window size from multiple sources.

    Priority order:
    1. modelsConfig (from cfg.models.providers[provider].models[model_id].context_window)
    2. model_context_window (passed directly)
    3. default_tokens (fallback)
    4. Apply agentContextTokens cap if configured (cfg.agents.defaults.context_tokens)

    Args:
        cfg: OpenClaw configuration
        provider: Provider name (e.g., "anthropic")
        model_id: Model ID (e.g., "claude-opus-4-6")
        model_context_window: Context window from model metadata
        default_tokens: Default fallback value

    Returns:
        ContextWindowInfo with resolved tokens and source

    Examples:
        >>> info = resolve_context_window_info(config, "anthropic", "claude-opus-4-6")
        >>> info.tokens
        200000
        >>> info.source
        'model'
    """
    # Try to get from modelsConfig
    from_models_config: int | None = None
    if cfg and cfg.models and cfg.models.providers:
        provider_config = cfg.models.providers.get(provider)
        if provider_config and provider_config.models:
            for model_def in provider_config.models:
                if model_def.id == model_id:
                    from_models_config = _normalize_positive_int(model_def.context_window)
                    break

    # Try model_context_window parameter
    from_model = _normalize_positive_int(model_context_window)

    # Determine base info (before cap)
    if from_models_config is not None:
        base_info = ContextWindowInfo(tokens=from_models_config, source="modelsConfig")
    elif from_model is not None:
        base_info = ContextWindowInfo(tokens=from_model, source="model")
    else:
        base_info = ContextWindowInfo(tokens=int(default_tokens), source="default")

    # Apply agentContextTokens cap if configured
    cap_tokens = None
    if cfg and hasattr(cfg, "agents") and cfg.agents and hasattr(cfg.agents, "defaults") and cfg.agents.defaults:
        cap_tokens = _normalize_positive_int(cfg.agents.defaults.context_tokens)

    if cap_tokens is not None and cap_tokens < base_info.tokens:
        return ContextWindowInfo(tokens=cap_tokens, source="agentContextTokens")

    return base_info


def evaluate_context_window_guard(
    info: ContextWindowInfo,
    warn_below_tokens: int | None = None,
    hard_min_tokens: int | None = None,
) -> ContextWindowGuardResult:
    """Evaluate if context window should trigger warnings or blocking.

    Args:
        info: Context window info to evaluate
        warn_below_tokens: Warning threshold (default: 32K)
        hard_min_tokens: Hard minimum threshold (default: 16K)

    Returns:
        ContextWindowGuardResult with evaluation results

    Examples:
        >>> info = ContextWindowInfo(tokens=20000, source="model")
        >>> result = evaluate_context_window_guard(info)
        >>> result.should_warn
        True
        >>> result.should_block
        False
    """
    warn_below = max(1, int(warn_below_tokens or CONTEXT_WINDOW_WARN_BELOW_TOKENS))
    hard_min = max(1, int(hard_min_tokens or CONTEXT_WINDOW_HARD_MIN_TOKENS))
    tokens = max(0, int(info.tokens))

    should_warn = tokens > 0 and tokens < warn_below
    should_block = tokens > 0 and tokens < hard_min

    return ContextWindowGuardResult(
        tokens=tokens,
        source=info.source,
        should_warn=should_warn,
        should_block=should_block,
    )
