#!/usr/bin/env python3
"""
Generate the next N skills from catalog order, skipping existing skill folders.

Default:
- count: 200
- target: skills/
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


def normalize_skill_name(raw: str) -> str:
    value = raw.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    if not value:
        raise ValueError("Skill name is empty after normalization")
    if len(value) > 64:
        raise ValueError(f"Skill name too long ({len(value)}): {value}")
    return value


def title_case(skill_name: str) -> str:
    return " ".join(part.capitalize() for part in skill_name.split("-"))


def build_skill_markdown(row: dict[str, str], skill_name: str) -> str:
    description = (
        f"{row['description']} Use when operators need dependable execution for "
        f"{row['domain_label']} work with measurable KPI outcomes."
    )
    return f"""---
name: {skill_name}
description: {description}
---

# {title_case(skill_name)}

## Mission

{row['business_requirement']}

## Trigger Signals

- {row['trigger_signal']}
- Stakeholder asks for reliable ownership in this capability.
- KPI trend indicates risk to target outcomes.

## Operating Workflow

1. Confirm objective, owner, constraints, and required timeline.
2. Collect dependencies and context before execution.
3. Execute in deterministic steps with clear checkpoints.
4. Validate quality against KPI and output contract.
5. Return concise, decision-ready outputs.
6. Capture improvement opportunities for next run.

## Output Contract

- {row['primary_output']}
- Status summary with owner, due date, and risk flags.
- Prioritized next actions with expected impact.

## KPI Contract

- {row['success_metric']}
- SLA adherence for completion.
- Rework rate below agreed threshold.

## Operating Notes

- Domain: {row['domain_label']}
- Capability: {row['capability']}
- Priority tier: {row['priority_tier']}
- Automation level target: {row['automation_level']}
- Prompt seed: {row['prompt_seed']}

## Guardrails

- Ask for approval before irreversible actions, spend, or external outreach.
- Fail closed when required data, access, or policy boundaries are missing.
- Keep execution traceable and auditable.
"""


def parse_args() -> argparse.Namespace:
    base_dir = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Generate next N catalog skills")
    parser.add_argument(
        "--catalog",
        type=Path,
        default=base_dir / "references" / "skill-catalog-1000.csv",
        help="Path to catalog CSV",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=200,
        help="Number of new skills to generate",
    )
    parser.add_argument(
        "--target-dir",
        type=Path,
        default=base_dir.parents[1] / "skills",
        help="Target skills directory",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=base_dir / "references" / "last-generated-skills.txt",
        help="Path to write generated skill names",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing SKILL.md files",
    )
    return parser.parse_args()


def load_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    rows.sort(key=lambda row: row["skill_id"])
    return rows


def main() -> int:
    args = parse_args()
    if args.count <= 0:
        raise SystemExit("--count must be > 0")

    target_dir = args.target_dir.resolve()
    target_dir.mkdir(parents=True, exist_ok=True)

    rows = load_rows(args.catalog.resolve())

    created_names: list[str] = []
    skipped_existing = 0

    for row in rows:
        skill_name = normalize_skill_name(row["skill_name"])
        skill_dir = target_dir / skill_name
        skill_md = skill_dir / "SKILL.md"

        if skill_md.exists() and not args.force:
            skipped_existing += 1
            continue

        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_md.write_text(build_skill_markdown(row, skill_name), encoding="utf-8")
        created_names.append(skill_name)

        if len(created_names) >= args.count:
            break

    if len(created_names) < args.count:
        raise SystemExit(
            f"Only created {len(created_names)} new skills (requested {args.count}). "
            "Catalog exhausted or existing skills occupy most entries."
        )

    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text("\n".join(created_names) + "\n", encoding="utf-8")

    print(f"Created: {len(created_names)}")
    print(f"Skipped existing: {skipped_existing}")
    print(f"Manifest: {args.manifest.resolve()}")
    print(f"First: {created_names[0]}")
    print(f"Last: {created_names[-1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
