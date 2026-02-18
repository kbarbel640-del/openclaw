#!/usr/bin/env python3
"""
Create a production-oriented OpenClaw skill from a business requirement.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


def normalize_skill_name(raw: str) -> str:
    value = raw.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    if not value:
        raise ValueError("Skill name is empty after normalization")
    if len(value) > 64:
        raise ValueError("Skill name must be 64 characters or less")
    return value


def title_case(skill_name: str) -> str:
    return " ".join(part.capitalize() for part in skill_name.split("-"))


def parse_csv_field(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [chunk.strip() for chunk in raw.split(",") if chunk.strip()]


def build_markdown(
    *,
    skill_name: str,
    description: str,
    business_requirement: str,
    triggers: list[str],
    outputs: list[str],
    kpis: list[str],
    tools: list[str],
) -> str:
    trigger_lines = "\n".join(f"- {item}" for item in triggers) or "- Requirement enters active queue."
    output_lines = "\n".join(f"- {item}" for item in outputs) or "- Decision-ready summary with next actions."
    kpi_lines = "\n".join(f"- {item}" for item in kpis) or "- Task completion SLA met."
    tool_lines = "\n".join(f"- `{item}`" for item in tools) or "- Use only tools needed for deterministic execution."

    return f"""---
name: {skill_name}
description: {description}
---

# {title_case(skill_name)}

## Mission

{business_requirement}

## Trigger Signals

{trigger_lines}

## Operating Workflow

1. Clarify objective, constraints, and success criteria.
2. Gather required context and dependencies before execution.
3. Execute the minimum set of actions needed to satisfy the requirement.
4. Validate output quality and policy compliance.
5. Return deliverables in the required output contract format.
6. Log follow-up opportunities for automation improvement.

## Output Contract

{output_lines}

## KPI Contract

{kpi_lines}

## Tooling

{tool_lines}

## Guardrails

- Ask for approval before destructive actions, external outreach, or spend.
- Fail closed when credentials, context, or policy boundaries are missing.
- Keep responses concise, actionable, and traceable to the business requirement.
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create an OpenClaw skill from requirements")
    parser.add_argument("--name", required=True, help="Skill name (raw or hyphen-case)")
    parser.add_argument("--description", default="", help="Frontmatter description")
    parser.add_argument("--business-requirement", required=True, help="Primary business requirement")
    parser.add_argument("--trigger", default="", help="Comma-separated trigger list")
    parser.add_argument("--output", default="", help="Comma-separated output artifact list")
    parser.add_argument("--kpi", default="", help="Comma-separated KPI list")
    parser.add_argument("--tool", default="", help="Comma-separated tooling list")
    parser.add_argument(
        "--target-dir",
        default="skills",
        help="Directory where the skill folder should be created",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite existing SKILL.md if it exists")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    skill_name = normalize_skill_name(args.name)
    description = args.description.strip() or (
        "Automate a business workflow from requirement to validated output. "
        "Use when this capability is requested by stakeholders."
    )

    skill_dir = Path(args.target_dir).resolve() / skill_name
    skill_md = skill_dir / "SKILL.md"

    if skill_md.exists() and not args.force:
        raise SystemExit(
            f"Refusing to overwrite existing file: {skill_md}. Use --force to overwrite."
        )

    skill_dir.mkdir(parents=True, exist_ok=True)

    markdown = build_markdown(
        skill_name=skill_name,
        description=description,
        business_requirement=args.business_requirement.strip(),
        triggers=parse_csv_field(args.trigger),
        outputs=parse_csv_field(args.output),
        kpis=parse_csv_field(args.kpi),
        tools=parse_csv_field(args.tool),
    )

    skill_md.write_text(markdown, encoding="utf-8")

    print(f"Created skill: {skill_name}")
    print(f"Path: {skill_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
