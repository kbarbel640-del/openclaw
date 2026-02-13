"""Agent types and data models.

This module defines core data structures for AI agent operations.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field


class ModelRef(BaseModel):
    """Reference to a specific AI model.

    Examples:
        >>> ref = ModelRef(provider="anthropic", model="claude-opus-4-6")
        >>> str(ref)
        'anthropic/claude-opus-4-6'
    """

    provider: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)

    def __str__(self) -> str:
        """Return provider/model format."""
        return f"{self.provider}/{self.model}"


class UsageInfo(BaseModel):
    """Token usage information.

    Normalized format that works across different AI providers.
    """

    input_tokens: int | None = None
    output_tokens: int | None = None
    cache_read_tokens: int | None = None
    cache_creation_tokens: int | None = None
    total_tokens: int | None = None

    def has_usage(self) -> bool:
        """Check if any usage values are present."""
        return any(
            [
                self.input_tokens,
                self.output_tokens,
                self.cache_read_tokens,
                self.cache_creation_tokens,
                self.total_tokens,
            ]
        )


class AgentMessage(BaseModel):
    """Message in agent conversation.

    Supports both simple string content and structured content (tool calls, etc.).
    """

    role: Literal["system", "user", "assistant", "toolResult"] = Field(...)
    content: str | list[Any] = Field(...)

    # Optional metadata
    name: str | None = None
    metadata: dict[str, Any] | None = None


class AgentResponse(BaseModel):
    """Response from AI model.

    Unified response format across all providers.
    """

    content: str
    usage: UsageInfo | None = None
    model: str | None = None
    finish_reason: str | None = None

    # Provider-specific metadata
    raw_response: Any | None = None


class StreamChunk(BaseModel):
    """Chunk from streaming response."""

    delta: str = ""
    finish_reason: str | None = None
    usage: UsageInfo | None = None


class ModelInfo(BaseModel):
    """Model metadata from catalog."""

    id: str
    name: str
    provider: str
    context_window: int | None = None
    max_tokens: int | None = None
    supports_streaming: bool = True
    supports_vision: bool = False
    api_type: Literal[
        "anthropic-messages",
        "openai-chat",
        "google-generative-ai",
        "bedrock-converse",
    ] | None = None


class ProviderConfig(BaseModel):
    """Configuration for a model provider."""

    name: str
    base_url: str | None = None
    api_key: str | None = None
    timeout: int = 120
    max_retries: int = 2

    # Additional headers
    headers: dict[str, str] | None = None
