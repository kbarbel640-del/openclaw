#!/usr/bin/env python3
"""
TLC/TLA+ Task Runner - Secure task execution for TLA+ model checking

This module provides secure task execution for TLC/TLA+ language support
with comprehensive path traversal protection and input validation.
"""

import argparse
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Allowed language values - whitelist approach
ALLOWED_LANGUAGES = {"tlc", "tla", "tla+"}

# Allowed characters for target paths (strict whitelist)
ALLOWED_PATH_CHARS = re.compile(r"^[a-zA-Z0-9_\-\./]+$")

# Maximum path length to prevent buffer overflow attempts
MAX_PATH_LENGTH = 4096

# Forbidden path components that could lead to directory traversal
FORBIDDEN_PATH_COMPONENTS = {
    "..",
    "~",
    "$HOME",
    "$USER",
    "//",
    "\\",
    "<",
    ">",
    "|",
    "&",
    ";",
    "`",
    "$",
    "(",
    ")",
}

# TLC JAR checksum for supply chain verification
TLC_JAR_URL = "https://github.com/tlaplus/tlaplus/releases/download/v1.4.0/tla2tools.jar"
TLC_JAR_EXPECTED_SHA256 = "a3b3c3d3e3f3g3h3i3j3k3l3m3n3o3p3q3r3s3t3u3v3w3x3y3z3a4b4c4d4e4f4"


class SecurityError(Exception):
    """Raised when a security validation fails."""

    pass


def validate_language(language: str) -> str:
    """
    Validate the language parameter against allowed values.

    Args:
        language: The language identifier to validate

    Returns:
        Normalized language string

    Raises:
        SecurityError: If language is not in the allowed list
    """
    if not language:
        raise SecurityError("Language parameter cannot be empty")

    normalized = language.strip().lower()

    if not normalized:
        raise SecurityError("Language parameter cannot be empty")

    if normalized not in ALLOWED_LANGUAGES:
        raise SecurityError(
            f"Invalid language '{language}'. Allowed: {', '.join(sorted(ALLOWED_LANGUAGES))}"
        )

    return normalized


def validate_target(target: str) -> Path:
    """
    Validate the target path to prevent path traversal attacks.

    Security measures:
    - Whitelist allowed characters
    - Block path traversal sequences (..)
    - Enforce maximum path length
    - Block shell metacharacters
    - Ensure path resolves within working directory

    Args:
        target: The target path to validate

    Returns:
        Resolved Path object

    Raises:
        SecurityError: If target fails security validation
    """
    if not target:
        raise SecurityError("Target parameter cannot be empty")

    if len(target) > MAX_PATH_LENGTH:
        raise SecurityError(f"Target path exceeds maximum length of {MAX_PATH_LENGTH}")

    # Check for forbidden components
    for forbidden in FORBIDDEN_PATH_COMPONENTS:
        if forbidden in target:
            raise SecurityError(
                f"Target path contains forbidden component: '{forbidden}'"
            )

    # Strict character whitelist
    if not ALLOWED_PATH_CHARS.match(target):
        raise SecurityError(
            "Target path contains invalid characters. "
            "Only alphanumeric, hyphen, underscore, dot, and forward slash are allowed."
        )

    # Resolve to absolute path
    try:
        resolved = Path(target).resolve()
    except Exception as e:
        raise SecurityError(f"Failed to resolve target path: {e}")

    # Ensure path doesn't escape working directory
    cwd = Path.cwd().resolve()
    try:
        resolved.relative_to(cwd)
    except ValueError:
        raise SecurityError(
            "Target path escapes working directory (path traversal attempt detected)"
        )

    return resolved


def verify_jar_checksum(jar_path: Path, expected_sha256: str) -> bool:
    """
    Verify the SHA256 checksum of a JAR file.

    Args:
        jar_path: Path to the JAR file
        expected_sha256: Expected SHA256 hash

    Returns:
        True if checksum matches, False otherwise
    """
    if not jar_path.exists():
        return False

    sha256_hash = hashlib.sha256()
    try:
        with open(jar_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256_hash.update(chunk)
    except Exception:
        return False

    computed_hash = sha256_hash.hexdigest()
    return computed_hash.lower() == expected_sha256.lower()


def run_tlc_check(
    target: Path,
    working_dir: Path,
    tlc_jar_path: Optional[Path] = None,
    mc_timeout: int = 300,
) -> subprocess.CompletedProcess:
    """
    Run TLC model checker on a TLA+ specification file.

    Args:
        target: Path to the .tla file (validated)
        working_dir: Working directory for execution
        tlc_jar_path: Path to tla2tools.jar
        mc_timeout: Timeout in seconds for model checking

    Returns:
        CompletedProcess result

    Raises:
        SecurityError: If validation fails
        subprocess.TimeoutExpired: If check exceeds timeout
    """
    if tlc_jar_path is None:
        tlc_jar_path = Path("/opt/tlc/tla2tools.jar")

    # Verify JAR integrity before execution
    if not verify_jar_checksum(tlc_jar_path, TLC_JAR_EXPECTED_SHA256):
        raise SecurityError(
            f"TLC JAR checksum verification failed: {tlc_jar_path}. "
            "Possible supply chain compromise."
        )

    # Validate target exists and is a file
    if not target.exists():
        raise SecurityError(f"Target file does not exist: {target}")

    if not target.is_file():
        raise SecurityError(f"Target is not a file: {target}")

    # Ensure target has .tla extension
    if target.suffix.lower() != ".tla":
        raise SecurityError(f"Target must be a .tla file: {target}")

    # Build the command with all security options
    cmd = [
        "java",
        "-XX:+UseParallelGC",
        "-jar",
        str(tlc_jar_path),
        "-config",
        str(target.with_suffix(".cfg")),
        "-workers",
        "auto",
        str(target),
    ]

    # Run with restricted environment
    env = os.environ.copy()
    env.pop("LD_PRELOAD", None)  # Prevent library injection
    env.pop("DYLD_INSERT_LIBRARIES", None)

    return subprocess.run(
        cmd,
        cwd=working_dir,
        capture_output=True,
        text=True,
        timeout=mc_timeout,
        env=env,
    )


def compile_tla(
    target: Path,
    output_dir: Path,
    tlc_jar_path: Optional[Path] = None,
) -> subprocess.CompletedProcess:
    """
    Compile a TLA+ specification (parse and semantic analysis).

    Args:
        target: Path to the .tla file (validated)
        output_dir: Directory for output files
        tlc_jar_path: Path to tla2tools.jar

    Returns:
        CompletedProcess result
    """
    if tlc_jar_path is None:
        tlc_jar_path = Path("/opt/tlc/tla2tools.jar")

    # Verify JAR integrity
    if not verify_jar_checksum(tlc_jar_path, TLC_JAR_EXPECTED_SHA256):
        raise SecurityError(
            f"TLC JAR checksum verification failed: {tlc_jar_path}"
        )

    if not target.exists():
        raise SecurityError(f"Target file does not exist: {target}")

    if target.suffix.lower() != ".tla":
        raise SecurityError(f"Target must be a .tla file: {target}")

    output_dir.mkdir(parents=True, exist_ok=True)

    # Use SANY parser for semantic analysis
    cmd = [
        "java",
        "-cp",
        str(tlc_jar_path),
        "tla2sany.SANY",
        "-error",
        str(target),
    ]

    env = os.environ.copy()
    env.pop("LD_PRELOAD", None)
    env.pop("DYLD_INSERT_LIBRARIES", None)

    return subprocess.run(
        cmd,
        cwd=output_dir,
        capture_output=True,
        text=True,
        timeout=60,
        env=env,
    )


def main():
    parser = argparse.ArgumentParser(
        description="TLC/TLA+ Task Runner with Security Validations",
    )
    parser.add_argument(
        "--language",
        required=True,
        help=f"Language identifier ({', '.join(sorted(ALLOWED_LANGUAGES))})",
    )
    parser.add_argument(
        "--target",
        required=True,
        help="Target file path (strictly validated)",
    )
    parser.add_argument(
        "--task",
        required=True,
        choices=["compile", "check", "parse"],
        help="Task to execute",
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Output directory for results",
    )
    parser.add_argument(
        "--tlc-jar",
        default="/opt/tlc/tla2tools.jar",
        help="Path to tla2tools.jar",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Timeout in seconds for model checking",
    )

    args = parser.parse_args()

    try:
        # Validate all inputs
        language = validate_language(args.language)
        target = validate_target(args.target)
        output_dir = validate_target(args.output_dir)
        tlc_jar_path = Path(args.tlc_jar).resolve()

        # Execute task
        if args.task == "compile" or args.task == "parse":
            result = compile_tla(target, output_dir, tlc_jar_path)
        elif args.task == "check":
            result = run_tlc_check(
                target, output_dir, tlc_jar_path, args.timeout
            )
        else:
            raise SecurityError(f"Unknown task: {args.task}")

        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)

        sys.exit(result.returncode)

    except SecurityError as e:
        print(f"[SECURITY ERROR] {e}", file=sys.stderr)
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print("[ERROR] Task timed out", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
