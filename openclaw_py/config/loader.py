"""Configuration file loader.

Loads configuration from YAML or JSON files with:
- Environment variable substitution
- Default value application
- Pydantic validation
"""

import hashlib
import json
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import ValidationError

from .defaults import apply_defaults
from .env_substitution import MissingEnvVarError, substitute_env_vars
from .paths import resolve_config_path, resolve_default_config_candidates
from .types import ConfigFileSnapshot, ConfigValidationIssue, OpenClawConfig


class ConfigLoadError(Exception):
    """Base exception for configuration loading errors."""

    pass


class ConfigParseError(ConfigLoadError):
    """Raised when config file cannot be parsed."""

    def __init__(self, path: str, message: str):
        self.path = path
        super().__init__(f"Failed to parse config file {path}: {message}")


class ConfigValidationError(ConfigLoadError):
    """Raised when config validation fails."""

    def __init__(self, path: str, issues: list[ConfigValidationIssue]):
        self.path = path
        self.issues = issues
        issue_msgs = "\n".join(f"  - {issue.path}: {issue.message}" for issue in issues)
        super().__init__(f"Config validation failed for {path}:\n{issue_msgs}")


def _hash_content(content: str | None) -> str:
    """Compute SHA256 hash of content."""
    if content is None:
        content = ""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _detect_format(path: Path) -> Literal["yaml", "json"]:
    """Detect config file format from extension.

    Args:
        path: Config file path

    Returns:
        File format ("yaml" or "json")
    """
    suffix = path.suffix.lower()
    if suffix in (".yaml", ".yml"):
        return "yaml"
    if suffix in (".json", ".json5"):
        return "json"
    # Default to YAML
    return "yaml"


def parse_config_file(content: str, format: Literal["yaml", "json"]) -> dict[str, Any]:
    """Parse configuration file content.

    Args:
        content: File content
        format: File format ("yaml" or "json")

    Returns:
        Parsed configuration dict

    Raises:
        ConfigParseError: If parsing fails
    """
    try:
        if format == "yaml":
            parsed = yaml.safe_load(content)
        else:  # json
            parsed = json.loads(content)

        # Ensure we have a dict
        if not isinstance(parsed, dict):
            if parsed is None:
                return {}
            raise ConfigParseError("", f"Expected dict, got {type(parsed).__name__}")

        return parsed

    except yaml.YAMLError as e:
        raise ConfigParseError("", f"YAML parse error: {e}")
    except json.JSONDecodeError as e:
        raise ConfigParseError("", f"JSON parse error: {e}")


async def load_config_file(
    path: str | Path | None = None,
    env: dict[str, str] | None = None,
) -> OpenClawConfig:
    """Load configuration from file.

    Args:
        path: Config file path (defaults to OPENCLAW_CONFIG or ~/.openclaw/openclaw.yaml)
        env: Environment variables for substitution (defaults to os.environ)

    Returns:
        Loaded and validated OpenClawConfig

    Raises:
        ConfigLoadError: If loading fails
        ConfigParseError: If parsing fails
        ConfigValidationError: If validation fails
        MissingEnvVarError: If required env var is missing
    """
    # Resolve config path
    if path is None:
        config_path = resolve_config_path(env)
    else:
        config_path = Path(path)

    # Check if file exists
    if not config_path.exists():
        # Try to find a config file
        for candidate in resolve_default_config_candidates(env):
            if candidate.exists():
                config_path = candidate
                break
        else:
            # No config file found, return default config
            return apply_defaults(OpenClawConfig())

    # Read file content
    try:
        content = config_path.read_text(encoding="utf-8")
    except Exception as e:
        raise ConfigLoadError(f"Failed to read config file {config_path}: {e}")

    # Detect format and parse
    format = _detect_format(config_path)
    try:
        parsed = parse_config_file(content, format)
    except ConfigParseError as e:
        raise ConfigParseError(str(config_path), str(e))

    # Substitute environment variables
    try:
        substituted = substitute_env_vars(parsed, env)
    except MissingEnvVarError:
        raise  # Re-raise env var errors

    # Validate with Pydantic
    try:
        config = OpenClawConfig(**substituted)
    except ValidationError as e:
        issues = [
            ConfigValidationIssue(
                path=".".join(str(loc) for loc in error["loc"]),
                message=error["msg"],
            )
            for error in e.errors()
        ]
        raise ConfigValidationError(str(config_path), issues)

    # Apply defaults
    config = apply_defaults(config)

    return config


async def read_config_file_snapshot(
    path: str | Path | None = None,
    env: dict[str, str] | None = None,
) -> ConfigFileSnapshot:
    """Read configuration file and return a snapshot.

    Args:
        path: Config file path (defaults to OPENCLAW_CONFIG or ~/.openclaw/openclaw.yaml)
        env: Environment variables for substitution (defaults to os.environ)

    Returns:
        ConfigFileSnapshot with all details
    """
    # Resolve config path
    if path is None:
        config_path = resolve_config_path(env)
    else:
        config_path = Path(path)

    # Check if file exists
    exists = config_path.exists()
    raw = None
    parsed = None
    valid = False
    config = OpenClawConfig()
    issues: list[ConfigValidationIssue] = []
    warnings: list[ConfigValidationIssue] = []

    if exists:
        # Read file content
        try:
            raw = config_path.read_text(encoding="utf-8")
        except Exception as e:
            issues.append(
                ConfigValidationIssue(
                    path="",
                    message=f"Failed to read file: {e}",
                )
            )

        if raw is not None:
            # Detect format and parse
            format = _detect_format(config_path)
            try:
                parsed = parse_config_file(raw, format)
            except ConfigParseError as e:
                issues.append(
                    ConfigValidationIssue(
                        path="",
                        message=str(e),
                    )
                )

            if parsed is not None:
                # Substitute environment variables
                substitution_failed = False
                try:
                    substituted = substitute_env_vars(parsed, env)
                except MissingEnvVarError as e:
                    issues.append(
                        ConfigValidationIssue(
                            path=e.config_path,
                            message=f"Missing env var: {e.var_name}",
                        )
                    )
                    substituted = parsed  # Use unsubstituted
                    substitution_failed = True

                # Validate with Pydantic (only if substitution succeeded)
                if not substitution_failed:
                    try:
                        config = OpenClawConfig(**substituted)
                        config = apply_defaults(config)
                        valid = True
                    except ValidationError as e:
                        for error in e.errors():
                            issues.append(
                                ConfigValidationIssue(
                                    path=".".join(str(loc) for loc in error["loc"]),
                                    message=error["msg"],
                                )
                            )
    else:
        # File doesn't exist, use default config
        config = apply_defaults(OpenClawConfig())
        valid = True

    # Compute hash
    hash_value = _hash_content(raw)

    return ConfigFileSnapshot(
        path=str(config_path),
        exists=exists,
        raw=raw,
        parsed=parsed,
        valid=valid,
        config=config,
        hash=hash_value,
        issues=issues,
        warnings=warnings,
    )


def load_config_sync(
    path: str | Path | None = None,
    env: dict[str, str] | None = None,
) -> OpenClawConfig:
    """Synchronous wrapper for load_config_file.

    Args:
        path: Config file path
        env: Environment variables

    Returns:
        Loaded OpenClawConfig
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(load_config_file(path, env))
