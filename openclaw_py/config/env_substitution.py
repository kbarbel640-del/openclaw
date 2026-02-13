"""Environment variable substitution for configuration values.

Supports ${VAR_NAME} syntax in string values, substituted at config load time.
- Only uppercase env vars are matched: [A-Z_][A-Z0-9_]*
- Escape with $${} to output literal ${}
- Missing env vars throw MissingEnvVarError with context

Example:
    ```yaml
    telegram:
      bot_token: "${TELEGRAM_BOT_TOKEN}"
    ```
"""

import os
import re
from typing import Any


# Pattern for valid uppercase env var names
ENV_VAR_NAME_PATTERN = re.compile(r"^[A-Z_][A-Z0-9_]*$")


class MissingEnvVarError(Exception):
    """Raised when a required environment variable is missing."""

    def __init__(self, var_name: str, config_path: str):
        self.var_name = var_name
        self.config_path = config_path
        super().__init__(
            f'Missing env var "{var_name}" referenced at config path: {config_path}'
        )


def _substitute_string(value: str, env: dict[str, str], config_path: str) -> str:
    """Substitute environment variables in a single string.

    Args:
        value: String potentially containing ${VAR} references
        env: Environment variables dict
        config_path: Configuration path for error messages

    Returns:
        String with ${VAR} replaced by env values

    Raises:
        MissingEnvVarError: If a referenced env var is not found
    """
    if "$" not in value:
        return value

    chunks: list[str] = []
    i = 0

    while i < len(value):
        char = value[i]

        if char != "$":
            chunks.append(char)
            i += 1
            continue

        # Check what comes after $
        if i + 1 >= len(value):
            chunks.append(char)
            i += 1
            continue

        next_char = value[i + 1]

        # Escaped: $${VAR} -> ${VAR}
        if next_char == "$" and i + 2 < len(value) and value[i + 2] == "{":
            start = i + 3
            end = value.find("}", start)
            if end != -1:
                # Output literal ${...}
                chunks.append("${")
                chunks.append(value[start:end])
                chunks.append("}")
                i = end + 1
                continue

        # Variable reference: ${VAR}
        if next_char == "{":
            start = i + 2
            end = value.find("}", start)

            if end == -1:
                # No closing brace, treat as literal
                chunks.append(char)
                i += 1
                continue

            var_name = value[start:end]

            # Validate var name (must be uppercase)
            if not ENV_VAR_NAME_PATTERN.match(var_name):
                # Invalid var name, treat as literal
                chunks.append(value[i : end + 1])
                i = end + 1
                continue

            # Look up env var
            if var_name not in env:
                raise MissingEnvVarError(var_name, config_path)

            chunks.append(env[var_name])
            i = end + 1
            continue

        # Just a $ followed by something else
        chunks.append(char)
        i += 1

    return "".join(chunks)


def substitute_env_vars(
    obj: Any,
    env: dict[str, str] | None = None,
    config_path: str = "",
) -> Any:
    """Recursively substitute environment variables in a configuration object.

    Args:
        obj: Configuration object (dict, list, or primitive)
        env: Environment variables dict (defaults to os.environ)
        config_path: Current path in config for error messages

    Returns:
        Configuration object with ${VAR} references replaced

    Raises:
        MissingEnvVarError: If a referenced env var is not found
    """
    if env is None:
        env = dict(os.environ)

    if isinstance(obj, str):
        return _substitute_string(obj, env, config_path)

    if isinstance(obj, dict):
        return {
            key: substitute_env_vars(
                value,
                env,
                f"{config_path}.{key}" if config_path else key,
            )
            for key, value in obj.items()
        }

    if isinstance(obj, list):
        return [
            substitute_env_vars(
                item,
                env,
                f"{config_path}[{i}]",
            )
            for i, item in enumerate(obj)
        ]

    # Primitives (int, float, bool, None) pass through unchanged
    return obj


def is_plain_object(obj: Any) -> bool:
    """Check if object is a plain dict (not a special object)."""
    return isinstance(obj, dict) and type(obj) is dict
