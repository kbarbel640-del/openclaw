"""Tests for logging system."""

import sys
from pathlib import Path

import pytest

from openclaw_py.config import LoggingConfig
from openclaw_py.logging import (
    DEFAULT_LOG_DIR,
    DEFAULT_LOG_FILE,
    get_current_config,
    get_logger,
    is_logger_initialized,
    log_debug,
    log_error,
    log_info,
    log_success,
    log_warn,
    reset_logger,
    setup_logger,
)


class TestLoggerSetup:
    """Tests for logger setup and initialization."""

    def setup_method(self):
        """Reset logger before each test."""
        reset_logger()

    def teardown_method(self):
        """Reset logger after each test."""
        reset_logger()

    def test_default_setup(self, tmp_path):
        """Test that default setup works."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(file=str(log_file))
        setup_logger(config)

        assert is_logger_initialized()
        assert get_current_config() == config

    def test_get_logger_auto_initializes(self):
        """Test that get_logger auto-initializes if not set up."""
        assert not is_logger_initialized()
        logger = get_logger()
        assert logger is not None
        assert is_logger_initialized()

    def test_reset_logger(self, tmp_path):
        """Test that reset_logger clears state."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(file=str(log_file))
        setup_logger(config)

        assert is_logger_initialized()

        reset_logger()

        assert not is_logger_initialized()
        assert get_current_config() is None

    def test_log_levels(self, tmp_path):
        """Test different log levels."""
        log_file = tmp_path / "test.log"

        # Test each log level
        for level in ["silent", "fatal", "error", "warn", "info", "debug", "trace"]:
            reset_logger()
            config = LoggingConfig(level=level, file=str(log_file))  # type: ignore
            setup_logger(config)
            assert is_logger_initialized()

    def test_console_styles(self, tmp_path):
        """Test different console styles."""
        log_file = tmp_path / "test.log"

        for style in ["pretty", "compact", "json"]:
            reset_logger()
            config = LoggingConfig(console_style=style, file=str(log_file))  # type: ignore
            setup_logger(config)
            assert is_logger_initialized()

    def test_file_creation(self, tmp_path):
        """Test that log file is created."""
        log_file = tmp_path / "logs" / "test.log"
        config = LoggingConfig(file=str(log_file))
        setup_logger(config)

        # Write a log message
        log_info("Test message")

        # Check file was created
        assert log_file.exists()
        assert log_file.is_file()

        # Check log content
        content = log_file.read_text()
        assert "Test message" in content

    def test_default_log_file(self):
        """Test that default log file path is valid."""
        assert DEFAULT_LOG_DIR == Path.home() / ".openclaw" / "logs"
        assert DEFAULT_LOG_FILE == DEFAULT_LOG_DIR / "openclaw.log"


class TestConvenienceFunctions:
    """Tests for convenience logging functions."""

    def setup_method(self):
        """Reset logger before each test."""
        reset_logger()

    def teardown_method(self):
        """Reset logger after each test."""
        reset_logger()

    def test_log_info(self, tmp_path):
        """Test log_info function."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(level="info", file=str(log_file))
        setup_logger(config)

        log_info("Info message")

        # Wait for loguru to finish writing (it uses enqueue=True for async writes)
        import time
        time.sleep(0.1)

        content = log_file.read_text()
        assert "Info message" in content
        assert "INFO" in content

    def test_log_warn(self, tmp_path):
        """Test log_warn function."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(level="warn", file=str(log_file))
        setup_logger(config)

        log_warn("Warning message")

        # Wait for loguru to finish writing (it uses enqueue=True for async writes)
        import time
        time.sleep(0.1)

        content = log_file.read_text()
        assert "Warning message" in content
        assert "WARNING" in content

    def test_log_error(self, tmp_path):
        """Test log_error function."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(level="error", file=str(log_file))
        setup_logger(config)

        log_error("Error message")

        # Wait for loguru to finish writing (it uses enqueue=True for async writes)
        import time
        time.sleep(0.1)

        content = log_file.read_text()
        assert "Error message" in content
        assert "ERROR" in content

    def test_log_debug(self, tmp_path):
        """Test log_debug function."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(level="debug", file=str(log_file))
        setup_logger(config)

        log_debug("Debug message")

        # Wait for loguru to finish writing (it uses enqueue=True for async writes)
        import time
        time.sleep(0.1)

        content = log_file.read_text()
        assert "Debug message" in content
        assert "DEBUG" in content

    def test_log_success(self, tmp_path):
        """Test log_success function."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(level="info", file=str(log_file))
        setup_logger(config)

        log_success("Success message")

        # Wait for loguru to finish writing (it uses enqueue=True for async writes)
        import time
        time.sleep(0.1)

        content = log_file.read_text()
        assert "Success message" in content

    def test_log_with_context(self, tmp_path):
        """Test logging with additional context."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(level="info", file=str(log_file))
        setup_logger(config)

        log_info("Message with context", extra_field="value")

        content = log_file.read_text()
        assert "Message with context" in content

    def test_multiple_log_calls(self, tmp_path):
        """Test multiple sequential log calls."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(level="info", file=str(log_file))
        setup_logger(config)

        log_info("First message")
        log_warn("Second message")
        log_error("Third message")

        # Wait for loguru to finish writing (it uses enqueue=True for async writes)
        import time
        time.sleep(0.1)

        content = log_file.read_text()
        assert "First message" in content
        assert "Second message" in content
        assert "Third message" in content


class TestLoggerConfiguration:
    """Tests for logger configuration."""

    def setup_method(self):
        """Reset logger before each test."""
        reset_logger()

    def teardown_method(self):
        """Reset logger after each test."""
        reset_logger()

    def test_none_config_uses_defaults(self, tmp_path):
        """Test that None config uses defaults."""
        setup_logger(None)

        config = get_current_config()
        assert config is not None
        assert config.level == "info"
        assert config.console_style == "pretty"

    def test_custom_console_level(self, tmp_path):
        """Test custom console log level."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(
            level="debug",
            console_level="warn",
            file=str(log_file),
        )
        setup_logger(config)

        assert is_logger_initialized()
        assert get_current_config() == config

    def test_silent_level_disables_logging(self, tmp_path):
        """Test that silent level effectively disables logging."""
        log_file = tmp_path / "test.log"
        config = LoggingConfig(level="silent", file=str(log_file))
        setup_logger(config)

        log_info("This should not appear")
        log_warn("Neither should this")

        # File might exist but should be empty or minimal
        if log_file.exists():
            content = log_file.read_text()
            # Silent mode uses CRITICAL level, so info/warn won't appear
            assert "This should not appear" not in content
            assert "Neither should this" not in content
