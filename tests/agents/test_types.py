"""Tests for agent types."""

import pytest
from pydantic import ValidationError

from openclaw_py.agents.types import (
    AgentMessage,
    AgentResponse,
    ModelInfo,
    ModelRef,
    ProviderConfig,
    StreamChunk,
    UsageInfo,
)


def test_model_ref_creation():
    """Test ModelRef creation."""
    ref = ModelRef(provider="anthropic", model="claude-opus-4-6")
    assert ref.provider == "anthropic"
    assert ref.model == "claude-opus-4-6"
    assert str(ref) == "anthropic/claude-opus-4-6"


def test_model_ref_validation():
    """Test ModelRef validation."""
    with pytest.raises(ValidationError):
        ModelRef(provider="", model="test")

    with pytest.raises(ValidationError):
        ModelRef(provider="test", model="")


def test_usage_info_creation():
    """Test UsageInfo creation."""
    usage = UsageInfo(
        input_tokens=100,
        output_tokens=50,
        cache_read_tokens=10,
        cache_creation_tokens=5,
        total_tokens=165,
    )
    assert usage.input_tokens == 100
    assert usage.output_tokens == 50
    assert usage.total_tokens == 165
    assert usage.has_usage()


def test_usage_info_empty():
    """Test empty UsageInfo."""
    usage = UsageInfo()
    assert not usage.has_usage()


def test_agent_message_creation():
    """Test AgentMessage creation."""
    msg = AgentMessage(role="user", content="Hello")
    assert msg.role == "user"
    assert msg.content == "Hello"
    assert msg.name is None


def test_agent_message_validation():
    """Test AgentMessage validation."""
    # Invalid role should raise error
    with pytest.raises(ValidationError):
        AgentMessage(role="invalid", content="test")  # type: ignore

    # Content can be string or list (batch 8 enhancement for tool calls)
    msg1 = AgentMessage(role="user", content="test")
    assert msg1.content == "test"

    msg2 = AgentMessage(role="assistant", content=[{"type": "text", "text": "hello"}])
    assert isinstance(msg2.content, list)


def test_agent_response_creation():
    """Test AgentResponse creation."""
    response = AgentResponse(
        content="Hello!",
        usage=UsageInfo(input_tokens=10, output_tokens=5),
        model="claude-opus-4-6",
        finish_reason="end_turn",
    )
    assert response.content == "Hello!"
    assert response.usage.input_tokens == 10
    assert response.model == "claude-opus-4-6"


def test_stream_chunk_creation():
    """Test StreamChunk creation."""
    chunk = StreamChunk(delta="Hello")
    assert chunk.delta == "Hello"
    assert chunk.finish_reason is None

    chunk_final = StreamChunk(delta="", finish_reason="stop")
    assert chunk_final.delta == ""
    assert chunk_final.finish_reason == "stop"


def test_model_info_creation():
    """Test ModelInfo creation."""
    info = ModelInfo(
        id="claude-opus-4-6",
        name="Claude Opus 4.6",
        provider="anthropic",
        context_window=200000,
        api_type="anthropic-messages",
    )
    assert info.id == "claude-opus-4-6"
    assert info.provider == "anthropic"
    assert info.context_window == 200000


def test_provider_config_creation():
    """Test ProviderConfig creation."""
    config = ProviderConfig(
        name="anthropic",
        api_key="sk-test-123",
        timeout=120,
    )
    assert config.name == "anthropic"
    assert config.api_key == "sk-test-123"
    assert config.timeout == 120
