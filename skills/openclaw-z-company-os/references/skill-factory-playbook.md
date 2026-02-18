# OpenClaw Z Skill Factory Playbook

## Goal

Convert business requirements into measurable, reusable OpenClaw skills that can run with minimal supervision.

## Input Contract

Capture these fields before creating a skill:

- Business objective
- Trigger event
- Constraints and approvals
- Expected artifacts
- KPI targets
- Allowed tools

## Build Loop

1. Select a capability from `skill-catalog-1000.csv`.
2. Generate a first-pass skill using `create_skill_from_requirement.py`.
3. Add domain-specific policy and risk controls.
4. Validate with `quick_validate.py`.
5. Run one pilot task and score KPI outcome.
6. Refine triggers, workflow, and output contract.

## Scale Pattern

- Start with one skill per capability.
- Keep responsibilities narrow.
- Prefer composing skills over building giant multipurpose skills.
- Track failure reasons and feed them into weekly improvement.
