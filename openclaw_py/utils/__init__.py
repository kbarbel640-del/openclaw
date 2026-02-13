"""OpenClaw utilities module.

This module provides common utility functions.
"""

from .common import (
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

__all__ = [
    # File system
    "ensure_dir",
    "path_exists",
    # Number utilities
    "clamp",
    "clamp_int",
    "clamp_number",
    # String utilities
    "escape_regexp",
    "normalize_path",
    # JSON utilities
    "safe_parse_json",
    # Type guards
    "is_plain_object",
    "is_record",
]
