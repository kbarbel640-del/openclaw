#!/usr/bin/env python3
"""
Quick validation script for skills - minimal version
"""

import re
import sys
from pathlib import Path
from typing import Optional

try:
    import yaml
except ModuleNotFoundError:  # pragma: no cover - exercised in CI where PyYAML is absent
    yaml = None

MAX_SKILL_NAME_LENGTH = 64


def _extract_frontmatter(content: str) -> Optional[str]:
    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "\n".join(lines[1:i])
    return None


def _parse_frontmatter(frontmatter_text: str):
    if yaml is not None:
        try:
            parsed = yaml.safe_load(frontmatter_text)
        except yaml.YAMLError as e:
            return None, f"Invalid YAML in frontmatter: {e}"
        if not isinstance(parsed, dict):
            return None, "Frontmatter must be a YAML dictionary"
        return parsed, None

    # Fallback parser for environments without PyYAML. This keeps validation
    # available in minimal CI setups by reading top-level `key: value` pairs.
    parsed = {}
    for raw_line in frontmatter_text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if raw_line[0].isspace():
            # Nested values (lists/maps) are skipped in fallback mode.
            continue
        if ":" not in raw_line:
            return None, "Invalid frontmatter format"
        key, value = raw_line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            return None, "Invalid frontmatter format"
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        parsed[key] = value
    return parsed, None


def validate_skill(skill_path):
    """Basic validation of a skill"""
    skill_path = Path(skill_path)

    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, "SKILL.md not found"

    try:
        content = skill_md.read_text(encoding="utf-8")
    except OSError as e:
        return False, f"Could not read SKILL.md: {e}"

    frontmatter_text = _extract_frontmatter(content)
    if frontmatter_text is None:
        return False, "Invalid frontmatter format"
    frontmatter, parse_error = _parse_frontmatter(frontmatter_text)
    if parse_error is not None:
        return False, parse_error

    allowed_properties = {"name", "description", "license", "allowed-tools", "metadata"}

    unexpected_keys = set(frontmatter.keys()) - allowed_properties
    if unexpected_keys:
        allowed = ", ".join(sorted(allowed_properties))
        unexpected = ", ".join(sorted(unexpected_keys))
        return (
            False,
            f"Unexpected key(s) in SKILL.md frontmatter: {unexpected}. Allowed properties are: {allowed}",
        )

    if "name" not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if "description" not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    name = frontmatter.get("name", "")
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if name:
        if not re.match(r"^[a-z0-9-]+$", name):
            return (
                False,
                f"Name '{name}' should be hyphen-case (lowercase letters, digits, and hyphens only)",
            )
        if name.startswith("-") or name.endswith("-") or "--" in name:
            return (
                False,
                f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens",
            )
        if len(name) > MAX_SKILL_NAME_LENGTH:
            return (
                False,
                f"Name is too long ({len(name)} characters). "
                f"Maximum is {MAX_SKILL_NAME_LENGTH} characters.",
            )

    description = frontmatter.get("description", "")
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if description:
        if "<" in description or ">" in description:
            return False, "Description cannot contain angle brackets (< or >)"
        if len(description) > 1024:
            return (
                False,
                f"Description is too long ({len(description)} characters). Maximum is 1024 characters.",
            )

    return True, "Skill is valid!"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)

    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)
