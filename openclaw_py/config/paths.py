"""Configuration file and state directory path resolution.

Supports:
- OPENCLAW_CONFIG: Override config file path
- OPENCLAW_STATE_DIR: Override state directory
- OPENCLAW_HOME: Override home directory
- ~ expansion
"""

import os
from pathlib import Path


# Directory and file names
STATE_DIRNAME = ".openclaw"
CONFIG_FILENAME = "openclaw.yaml"
LEGACY_CONFIG_FILENAME = "openclaw.json"


def resolve_home_dir(env: dict[str, str] | None = None) -> Path:
    """Resolve home directory.

    Args:
        env: Environment variables (defaults to os.environ)

    Returns:
        Home directory path

    Environment variables:
        - OPENCLAW_HOME: Override home directory
    """
    if env is None:
        env = dict(os.environ)

    # Check OPENCLAW_HOME override
    openclaw_home = env.get("OPENCLAW_HOME")
    if openclaw_home:
        return Path(openclaw_home).expanduser().resolve()

    # Default to user's home directory
    return Path.home()


def expand_home_prefix(path: str, env: dict[str, str] | None = None) -> Path:
    """Expand ~ prefix in path to home directory.

    Args:
        path: Path potentially starting with ~
        env: Environment variables (defaults to os.environ)

    Returns:
        Absolute path with ~ expanded
    """
    if path.startswith("~"):
        home = resolve_home_dir(env)
        # Replace ~ with home directory
        if path == "~" or path.startswith("~/") or path.startswith("~\\"):
            return home / path[2:] if len(path) > 2 else home
    return Path(path)


def resolve_state_dir(env: dict[str, str] | None = None) -> Path:
    """Resolve state directory for mutable data (sessions, logs, caches).

    Args:
        env: Environment variables (defaults to os.environ)

    Returns:
        State directory path (default: ~/.openclaw)

    Environment variables:
        - OPENCLAW_STATE_DIR: Override state directory
        - OPENCLAW_HOME: Override home directory
    """
    if env is None:
        env = dict(os.environ)

    # Check OPENCLAW_STATE_DIR override
    state_dir = env.get("OPENCLAW_STATE_DIR")
    if state_dir:
        return expand_home_prefix(state_dir, env).resolve()

    # Default: ~/.openclaw
    home = resolve_home_dir(env)
    return home / STATE_DIRNAME


def resolve_config_path(env: dict[str, str] | None = None) -> Path:
    """Resolve configuration file path.

    Args:
        env: Environment variables (defaults to os.environ)

    Returns:
        Config file path (default: ~/.openclaw/openclaw.yaml)

    Environment variables:
        - OPENCLAW_CONFIG: Override config file path
        - OPENCLAW_STATE_DIR: Override state directory
        - OPENCLAW_HOME: Override home directory
    """
    if env is None:
        env = dict(os.environ)

    # Check OPENCLAW_CONFIG override
    config_path = env.get("OPENCLAW_CONFIG")
    if config_path:
        return expand_home_prefix(config_path, env).resolve()

    # Default: {state_dir}/openclaw.yaml
    state_dir = resolve_state_dir(env)
    return state_dir / CONFIG_FILENAME


def resolve_default_config_candidates(env: dict[str, str] | None = None) -> list[Path]:
    """Resolve candidate config file paths to try.

    Args:
        env: Environment variables (defaults to os.environ)

    Returns:
        List of candidate config paths (in priority order)
    """
    if env is None:
        env = dict(os.environ)

    state_dir = resolve_state_dir(env)

    candidates = [
        state_dir / CONFIG_FILENAME,  # openclaw.yaml (preferred)
        state_dir / LEGACY_CONFIG_FILENAME,  # openclaw.json (legacy)
    ]

    return candidates


def ensure_state_dir(env: dict[str, str] | None = None) -> Path:
    """Ensure state directory exists.

    Args:
        env: Environment variables (defaults to os.environ)

    Returns:
        State directory path (created if needed)
    """
    state_dir = resolve_state_dir(env)
    state_dir.mkdir(parents=True, exist_ok=True)
    return state_dir
