"""Configuration types using Pydantic v2.

This module defines all configuration models for OpenClaw.
Simplified to only include essential configs (Telegram only, no other channels).
"""

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from openclaw_py.types import (
    ChatType,
    DmPolicy,
    DmScope,
    GroupPolicy,
    LogLevel,
    MarkdownTableMode,
    ReplyMode,
    ReplyToMode,
    SessionMaintenanceMode,
    SessionResetMode,
    SessionScope,
    SessionSendPolicyAction,
    TypingMode,
)


# ============================================================================
# Logging Configuration
# ============================================================================


class LoggingConfig(BaseModel):
    """Logging configuration."""

    level: LogLevel = "info"
    file: str | None = None
    console_level: LogLevel | None = None
    console_style: Literal["pretty", "compact", "json"] = "pretty"
    redact_sensitive: Literal["off", "tools"] = "tools"
    redact_patterns: list[str] | None = None


# ============================================================================
# Session Configuration
# ============================================================================


class SessionResetConfig(BaseModel):
    """Session reset configuration."""

    mode: SessionResetMode | None = None
    at_hour: int | None = Field(None, ge=0, le=23)
    idle_minutes: int | None = Field(None, gt=0)


class SessionResetByTypeConfig(BaseModel):
    """Per-chat-type session reset config."""

    direct: SessionResetConfig | None = None
    dm: SessionResetConfig | None = None  # Deprecated alias for direct
    group: SessionResetConfig | None = None
    thread: SessionResetConfig | None = None


class SessionSendPolicyMatch(BaseModel):
    """Session send policy match criteria."""

    channel: str | None = None
    chat_type: ChatType | None = None
    key_prefix: str | None = None


class SessionSendPolicyRule(BaseModel):
    """Session send policy rule."""

    action: SessionSendPolicyAction
    match: SessionSendPolicyMatch | None = None


class SessionSendPolicyConfig(BaseModel):
    """Session send policy configuration."""

    default: SessionSendPolicyAction | None = None
    rules: list[SessionSendPolicyRule] | None = None


class SessionMaintenanceConfig(BaseModel):
    """Session maintenance (pruning, rotation) config."""

    mode: SessionMaintenanceMode = "warn"
    prune_after: str | int | None = "30d"
    prune_days: int | None = None  # Deprecated, use prune_after
    max_entries: int | None = Field(500, gt=0)
    rotate_bytes: int | str | None = "10mb"


class SessionAgentToAgentConfig(BaseModel):
    """Agent-to-agent session config."""

    max_ping_pong_turns: int | None = Field(5, ge=0, le=5)


class SessionConfig(BaseModel):
    """Session configuration."""

    scope: SessionScope = "per-sender"
    dm_scope: DmScope = "main"
    identity_links: dict[str, list[str]] | None = None
    reset_triggers: list[str] | None = None
    idle_minutes: int | None = Field(None, gt=0)
    reset: SessionResetConfig | None = None
    reset_by_type: SessionResetByTypeConfig | None = None
    reset_by_channel: dict[str, SessionResetConfig] | None = None
    store: str | None = None
    typing_interval_seconds: int | None = Field(None, gt=0)
    typing_mode: TypingMode | None = None
    main_key: str | None = None
    send_policy: SessionSendPolicyConfig | None = None
    agent_to_agent: SessionAgentToAgentConfig | None = None
    maintenance: SessionMaintenanceConfig | None = None


# ============================================================================
# Model Configuration
# ============================================================================


class ModelCostConfig(BaseModel):
    """Model cost configuration (per million tokens)."""

    input: float = 0
    output: float = 0
    cache_read: float = 0
    cache_write: float = 0


class ModelCompatConfig(BaseModel):
    """Model compatibility flags."""

    supports_store: bool | None = None
    supports_developer_role: bool | None = None
    supports_reasoning_effort: bool | None = None
    max_tokens_field: Literal["max_completion_tokens", "max_tokens"] | None = None


class ModelDefinitionConfig(BaseModel):
    """Model definition."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    api: Literal[
        "openai-completions",
        "openai-responses",
        "anthropic-messages",
        "google-generative-ai",
        "github-copilot",
        "bedrock-converse-stream",
    ] | None = None
    reasoning: bool | None = None
    input: list[Literal["text", "image"]] | None = None
    cost: ModelCostConfig | None = None
    context_window: int | None = Field(None, gt=0)
    max_tokens: int | None = Field(None, gt=0)
    headers: dict[str, str] | None = None
    compat: ModelCompatConfig | None = None


class ModelProviderConfig(BaseModel):
    """Model provider configuration."""

    base_url: str = Field(..., min_length=1)
    api_key: str | None = None
    auth: Literal["api-key", "aws-sdk", "oauth", "token"] | None = None
    api: Literal[
        "openai-completions",
        "openai-responses",
        "anthropic-messages",
        "google-generative-ai",
        "github-copilot",
        "bedrock-converse-stream",
    ] | None = None
    headers: dict[str, str] | None = None
    auth_header: bool | None = None
    models: list[ModelDefinitionConfig]


class ModelsConfig(BaseModel):
    """Models configuration."""

    mode: Literal["merge", "replace"] = "merge"
    providers: dict[str, ModelProviderConfig] | None = None


# ============================================================================
# Telegram Configuration
# ============================================================================


class MarkdownConfig(BaseModel):
    """Markdown rendering configuration."""

    tables: MarkdownTableMode = "off"


class OutboundRetryConfig(BaseModel):
    """Outbound retry policy."""

    attempts: int | None = Field(3, ge=0)
    min_delay_ms: int | None = Field(None, ge=0)
    max_delay_ms: int | None = Field(30000, ge=0)
    jitter: float | None = Field(0.1, ge=0, le=1)


class BlockStreamingChunkConfig(BaseModel):
    """Block streaming chunk config."""

    min_chars: int | None = Field(None, gt=0)
    max_chars: int | None = Field(None, gt=0)
    break_preference: Literal["paragraph", "newline", "sentence"] | None = None


class BlockStreamingCoalesceConfig(BaseModel):
    """Block streaming coalesce config."""

    min_chars: int | None = Field(None, gt=0)
    max_chars: int | None = Field(None, gt=0)
    idle_ms: int | None = Field(None, gt=0)


class TelegramActionConfig(BaseModel):
    """Telegram action permissions."""

    reactions: bool = True
    send_message: bool = True
    delete_message: bool = True
    edit_message: bool = True
    sticker: bool = True


class TelegramNetworkConfig(BaseModel):
    """Telegram network config."""

    auto_select_family: bool | None = None


class TelegramCustomCommand(BaseModel):
    """Custom Telegram bot command."""

    command: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)


class TelegramTopicConfig(BaseModel):
    """Telegram topic (forum) configuration."""

    require_mention: bool | None = None
    group_policy: GroupPolicy | None = None
    skills: list[str] | None = None
    enabled: bool = True
    allow_from: list[str | int] | None = None
    system_prompt: str | None = None


class TelegramGroupConfig(BaseModel):
    """Telegram group configuration."""

    require_mention: bool | None = None
    group_policy: GroupPolicy | None = None
    skills: list[str] | None = None
    topics: dict[str, TelegramTopicConfig] | None = None
    enabled: bool = True
    allow_from: list[str | int] | None = None
    system_prompt: str | None = None


class TelegramAccountConfig(BaseModel):
    """Telegram account configuration."""

    name: str | None = None
    enabled: bool = True
    bot_token: str | None = None
    token_file: str | None = None
    dm_policy: DmPolicy = "pairing"
    group_policy: GroupPolicy = "open"
    allow_from: list[str | int] | None = None
    group_allow_from: list[str | int] | None = None
    groups: dict[str, TelegramGroupConfig] | None = None
    history_limit: int | None = Field(None, ge=0)
    dm_history_limit: int | None = Field(None, ge=0)
    text_chunk_limit: int = 4000
    chunk_mode: Literal["length", "newline"] = "length"
    block_streaming: bool | None = None
    draft_chunk: BlockStreamingChunkConfig | None = None
    block_streaming_coalesce: BlockStreamingCoalesceConfig | None = None
    stream_mode: Literal["off", "partial", "block"] = "partial"
    media_max_mb: int | None = Field(None, gt=0)
    timeout_seconds: int | None = Field(None, gt=0)
    retry: OutboundRetryConfig | None = None
    network: TelegramNetworkConfig | None = None
    proxy: str | None = None
    webhook_url: str | None = None
    webhook_secret: str | None = None
    webhook_path: str | None = None
    actions: TelegramActionConfig | None = None
    reaction_notifications: Literal["off", "own", "all"] = "off"
    reaction_level: Literal["off", "ack", "minimal", "extensive"] = "ack"
    link_preview: bool = True
    response_prefix: str | None = None
    reply_to_mode: ReplyToMode = "off"
    markdown: MarkdownConfig | None = None
    custom_commands: list[TelegramCustomCommand] | None = None
    config_writes: bool = True


class TelegramConfig(TelegramAccountConfig):
    """Telegram configuration (supports multi-account)."""

    accounts: dict[str, TelegramAccountConfig] | None = None


# ============================================================================
# Gateway Configuration
# ============================================================================


class GatewayConfig(BaseModel):
    """Gateway server configuration."""

    enabled: bool = True
    host: str = "127.0.0.1"
    port: int | None = Field(None, ge=1, le=65535)
    password: str | None = None
    token: str | None = None


# ============================================================================
# Identity Configuration
# ============================================================================


class IdentityConfig(BaseModel):
    """Bot identity configuration."""

    name: str | None = None
    theme: str | None = None
    emoji: str | None = None
    avatar: str | None = None


# ============================================================================
# Root Configuration
# ============================================================================


class MetaConfig(BaseModel):
    """Configuration metadata."""

    last_touched_version: str | None = None
    last_touched_at: str | None = None


class EnvShellConfig(BaseModel):
    """Shell env import configuration."""

    enabled: bool = False
    timeout_ms: int = 15000


class EnvConfig(BaseModel):
    """Environment configuration."""

    shell_env: EnvShellConfig | None = None
    vars: dict[str, str] | None = None

    # Allow additional string fields for inline env vars
    model_config = {"extra": "allow"}


class OpenClawConfig(BaseModel):
    """Root OpenClaw configuration.

    This is the main configuration model for OpenClaw.
    Simplified to only include essential configs (Telegram only).
    """

    meta: MetaConfig | None = None
    env: EnvConfig | None = None
    logging: LoggingConfig | None = None
    session: SessionConfig | None = None
    models: ModelsConfig | None = None
    telegram: TelegramConfig | None = None
    gateway: GatewayConfig | None = None
    identity: IdentityConfig | None = None

    # Allow extra fields for future extensions
    model_config = {"extra": "allow"}


# ============================================================================
# Validation and Snapshot Types
# ============================================================================


class ConfigValidationIssue(BaseModel):
    """Configuration validation issue."""

    path: str
    message: str


class ConfigFileSnapshot(BaseModel):
    """Configuration file snapshot."""

    path: str
    exists: bool
    raw: str | None
    parsed: Any
    valid: bool
    config: OpenClawConfig
    hash: str | None = None
    issues: list[ConfigValidationIssue] = Field(default_factory=list)
    warnings: list[ConfigValidationIssue] = Field(default_factory=list)
