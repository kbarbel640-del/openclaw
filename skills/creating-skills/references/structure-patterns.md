# Structure Patterns

Organize skills by complexity level.

## Simple Skills (Single Task)

**When:** One main workflow, few variations.

```
skill-name/
├── SKILL.md    # Everything in one file, <200 lines
```

**Example:** A skill for a single CLI tool with 5-10 commands.

**SKILL.md structure:**

```markdown
---
name: tool-name
description: Does X. Use when Y.
---

# Tool Name

One sentence overview.

## Quick Reference

| Task | Command |
| ---- | ------- |

## Workflow

1. Step one
2. Step two
3. Verify

## Troubleshooting

| Error | Fix |
| ----- | --- |
```

## Medium Skills (Multiple Features)

**When:** Multiple related features, each needing detail.

```
skill-name/
├── SKILL.md              # Overview + quick reference
└── references/
    ├── feature-a.md      # Detailed feature docs
    └── feature-b.md
```

**Example:** A skill covering an API with multiple endpoints.

**SKILL.md structure:**

```markdown
---
name: api-name
description: Interacts with X API. Use when Y or Z.
---

# API Name

Overview of capabilities.

## Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Reference Files](#reference-files)

## Quick Start

[Minimal example to get started]

## Authentication

[How to authenticate]

## Common Operations

| Task        | Endpoint    | Reference                                  |
| ----------- | ----------- | ------------------------------------------ |
| List items  | GET /items  | [references/items.md](references/items.md) |
| Create item | POST /items | [references/items.md](references/items.md) |

## Reference Files

- [references/items.md](references/items.md) - CRUD operations for items
- [references/webhooks.md](references/webhooks.md) - Webhook configuration
```

## Complex Skills (Multi-Domain)

**When:** Covers multiple domains, phases, or user journeys.

```
skill-name/
├── SKILL.md              # Overview + workflow outline
├── references/
│   ├── domain-a.md
│   ├── domain-b.md
│   └── domain-c.md
├── scripts/              # Executable helpers
│   └── helper.sh
└── assets/               # Templates, configs
    └── template.json
```

**Example:** A comprehensive workflow skill with setup, execution, and cleanup phases.

**SKILL.md structure:**

```markdown
---
name: workflow-name
description: End-to-end workflow for X. Use when Y, need Z, or doing W.
---

# Workflow Name

Systematic process for accomplishing X.

## Contents

- [Critical Rules](#critical-rules)
- [Workflow Overview](#workflow-overview)
- [Phase Details](#phase-details)
- [Reference Files](#reference-files)

## Critical Rules

> Key constraints that must not be violated.

## Workflow Overview
```

Phase 1: Setup
├── Task A
└── Task B

Phase 2: Execution
├── Task C
└── Task D

Phase 3: Cleanup
└── Task E

```

## Phase Details

### Phase 1: Setup → [references/setup.md](references/setup.md)
[Brief summary + link to details]

### Phase 2: Execution → [references/execution.md](references/execution.md)
[Brief summary + link to details]

## Quick Checklists
- [ ] Pre-work checklist
- [ ] Post-work checklist

## Reference Files
- [references/setup.md](references/setup.md) - Setup procedures
- [references/execution.md](references/execution.md) - Execution details
- [scripts/helper.sh](scripts/helper.sh) - Automation script
```

## Workflow Pattern Skills

**For skills that guide multi-step processes:**

```markdown
## Workflow
```

Step 1: Preparation
├── [x] Check prerequisites
└── [x] Gather inputs

Step 2: Execution
├── [ ] Do thing A
├── [ ] Do thing B
└── [ ] Verify B

Step 3: Completion
├── [ ] Cleanup
└── [ ] Report

```

### Step 1: Preparation

[Details with validation]

### Step 2: Execution

[Details with validation]
```

## Checklist Pattern Skills

**For skills with many items to track:**

```markdown
## Pre-Flight Checklist

- [ ] Verified X: `command --check`
- [ ] Confirmed Y exists: `ls -la path`
- [ ] Tested Z works: `test-command`

## Post-Flight Checklist

- [ ] Output generated: `ls output/`
- [ ] No errors: `grep ERROR log.txt`
- [ ] Cleanup done: `rm -rf temp/`
```

## Reference File Guidelines

**Size:** 100-300 lines each

**Structure:**

```markdown
# Feature Name

## Overview

[1-2 sentences]

## API / Commands

[Reference tables]

## Examples

[2-3 examples with expected output]

## Edge Cases

[Known gotchas]
```

**Naming:**

- Use lowercase-with-hyphens
- Be descriptive: `authentication-reference.md` not `auth.md`
- Group by feature: `phases/setup.md` for phase-based organization
