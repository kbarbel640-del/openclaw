"""Tests for common utility functions."""

import json
from pathlib import Path

import pytest

from openclaw_py.utils import (
    clamp,
    clamp_int,
    clamp_number,
    ensure_dir,
    escape_regexp,
    is_plain_object,
    is_record,
    normalize_path,
    path_exists,
    safe_parse_json,
)


class TestFileSystemUtils:
    """Tests for file system utility functions."""

    @pytest.mark.asyncio
    async def test_ensure_dir_creates_directory(self, tmp_path):
        """Test that ensure_dir creates directory."""
        new_dir = tmp_path / "new" / "nested" / "dir"
        assert not new_dir.exists()

        await ensure_dir(new_dir)

        assert new_dir.exists()
        assert new_dir.is_dir()

    @pytest.mark.asyncio
    async def test_ensure_dir_idempotent(self, tmp_path):
        """Test that ensure_dir is idempotent."""
        new_dir = tmp_path / "test_dir"
        await ensure_dir(new_dir)
        await ensure_dir(new_dir)  # Should not raise

        assert new_dir.exists()

    @pytest.mark.asyncio
    async def test_ensure_dir_with_string(self, tmp_path):
        """Test ensure_dir with string path."""
        new_dir = tmp_path / "string_path"
        await ensure_dir(str(new_dir))

        assert new_dir.exists()

    @pytest.mark.asyncio
    async def test_path_exists_true(self, tmp_path):
        """Test path_exists returns True for existing path."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("test")

        assert await path_exists(test_file)

    @pytest.mark.asyncio
    async def test_path_exists_false(self, tmp_path):
        """Test path_exists returns False for non-existing path."""
        non_existing = tmp_path / "does_not_exist.txt"

        assert not await path_exists(non_existing)

    @pytest.mark.asyncio
    async def test_path_exists_directory(self, tmp_path):
        """Test path_exists works for directories."""
        test_dir = tmp_path / "test_dir"
        test_dir.mkdir()

        assert await path_exists(test_dir)

    @pytest.mark.asyncio
    async def test_path_exists_with_string(self, tmp_path):
        """Test path_exists with string path."""
        test_file = tmp_path / "test.txt"
        test_file.write_text("test")

        assert await path_exists(str(test_file))


class TestNumberUtils:
    """Tests for number utility functions."""

    def test_clamp_within_range(self):
        """Test clamp with value within range."""
        assert clamp(5, 0, 10) == 5
        assert clamp(0, -10, 10) == 0
        assert clamp(-5, -10, 0) == -5

    def test_clamp_below_min(self):
        """Test clamp with value below minimum."""
        assert clamp(-5, 0, 10) == 0
        assert clamp(-100, -10, 10) == -10

    def test_clamp_above_max(self):
        """Test clamp with value above maximum."""
        assert clamp(15, 0, 10) == 10
        assert clamp(100, -10, 10) == 10

    def test_clamp_floats(self):
        """Test clamp with float values."""
        assert clamp(5.5, 0.0, 10.0) == 5.5
        assert clamp(-1.5, 0.0, 10.0) == 0.0
        assert clamp(12.5, 0.0, 10.0) == 10.0

    def test_clamp_int_within_range(self):
        """Test clamp_int with value within range."""
        assert clamp_int(5, 0, 10) == 5
        assert clamp_int(0, -10, 10) == 0

    def test_clamp_int_floors_float(self):
        """Test clamp_int floors float values."""
        assert clamp_int(5.7, 0, 10) == 5
        assert clamp_int(9.9, 0, 10) == 9
        assert clamp_int(5.1, 0, 10) == 5

    def test_clamp_int_below_min(self):
        """Test clamp_int with value below minimum."""
        assert clamp_int(-5, 0, 10) == 0
        assert clamp_int(-100, -10, 10) == -10

    def test_clamp_int_above_max(self):
        """Test clamp_int with value above maximum."""
        assert clamp_int(15, 0, 10) == 10
        assert clamp_int(100, -10, 10) == 10

    def test_clamp_number_alias(self):
        """Test clamp_number is an alias for clamp."""
        assert clamp_number(5, 0, 10) == clamp(5, 0, 10)
        assert clamp_number(-5, 0, 10) == clamp(-5, 0, 10)
        assert clamp_number(15, 0, 10) == clamp(15, 0, 10)


class TestStringUtils:
    """Tests for string utility functions."""

    def test_escape_regexp_simple(self):
        """Test escape_regexp with simple strings."""
        assert escape_regexp("hello") == "hello"
        assert escape_regexp("hello world") == "hello\\ world"

    def test_escape_regexp_special_chars(self):
        """Test escape_regexp with special regex characters."""
        assert escape_regexp("hello.world") == "hello\\.world"
        assert escape_regexp("a*b+c?") == "a\\*b\\+c\\?"
        assert escape_regexp("(test)") == "\\(test\\)"
        assert escape_regexp("[abc]") == "\\[abc\\]"
        assert escape_regexp("{1,3}") == "\\{1,3\\}"

    def test_escape_regexp_all_special(self):
        """Test escape_regexp with all regex special characters."""
        special = r".*+?^${}()|[]\\"
        escaped = escape_regexp(special)
        # All special chars should be escaped
        assert "\\" in escaped
        for char in special:
            if char != "\\":
                assert char not in escaped or f"\\{char}" in escaped

    def test_normalize_path_without_slash(self):
        """Test normalize_path adds leading slash."""
        assert normalize_path("api/endpoint") == "/api/endpoint"
        assert normalize_path("test") == "/test"
        assert normalize_path("a/b/c") == "/a/b/c"

    def test_normalize_path_with_slash(self):
        """Test normalize_path preserves existing slash."""
        assert normalize_path("/api/endpoint") == "/api/endpoint"
        assert normalize_path("/test") == "/test"

    def test_normalize_path_empty(self):
        """Test normalize_path with empty string."""
        assert normalize_path("") == "/"


class TestJsonUtils:
    """Tests for JSON utility functions."""

    def test_safe_parse_json_valid_dict(self):
        """Test safe_parse_json with valid dict."""
        result = safe_parse_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_safe_parse_json_valid_list(self):
        """Test safe_parse_json with valid list."""
        result = safe_parse_json('[1, 2, 3]')
        assert result == [1, 2, 3]

    def test_safe_parse_json_valid_nested(self):
        """Test safe_parse_json with nested structure."""
        result = safe_parse_json('{"a": [1, 2], "b": {"c": 3}}')
        assert result == {"a": [1, 2], "b": {"c": 3}}

    def test_safe_parse_json_invalid(self):
        """Test safe_parse_json with invalid JSON."""
        assert safe_parse_json("invalid json") is None
        assert safe_parse_json("{invalid}") is None
        assert safe_parse_json("") is None

    def test_safe_parse_json_primitives(self):
        """Test safe_parse_json with JSON primitives."""
        assert safe_parse_json("123") == 123
        assert safe_parse_json("true") is True
        assert safe_parse_json("false") is False
        assert safe_parse_json("null") is None
        assert safe_parse_json('"string"') == "string"

    def test_safe_parse_json_empty_objects(self):
        """Test safe_parse_json with empty objects."""
        assert safe_parse_json("{}") == {}
        assert safe_parse_json("[]") == []


class TestTypeGuards:
    """Tests for type guard functions."""

    def test_is_plain_object_with_dict(self):
        """Test is_plain_object returns True for dict."""
        assert is_plain_object({}) is True
        assert is_plain_object({"a": 1}) is True
        assert is_plain_object({"nested": {"dict": True}}) is True

    def test_is_plain_object_with_non_dict(self):
        """Test is_plain_object returns False for non-dict."""
        assert is_plain_object([]) is False
        assert is_plain_object([1, 2, 3]) is False
        assert is_plain_object(None) is False
        assert is_plain_object("string") is False
        assert is_plain_object(123) is False
        assert is_plain_object(True) is False

    def test_is_plain_object_with_class(self):
        """Test is_plain_object returns False for class."""
        class TestClass:
            pass

        assert is_plain_object(TestClass) is False

    def test_is_record_with_dict(self):
        """Test is_record returns True for dict."""
        assert is_record({}) is True
        assert is_record({"a": 1}) is True

    def test_is_record_with_non_dict(self):
        """Test is_record returns False for non-dict."""
        assert is_record([]) is False
        assert is_record(None) is False
        assert is_record("string") is False
        assert is_record(123) is False

    def test_is_record_less_strict(self):
        """Test is_record is less strict than is_plain_object."""
        # Both should accept plain dicts
        test_dict = {"a": 1}
        assert is_record(test_dict) is True
        assert is_plain_object(test_dict) is True
