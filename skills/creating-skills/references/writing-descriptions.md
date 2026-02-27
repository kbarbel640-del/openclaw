# Writing Effective Descriptions

Descriptions are critical—they determine whether Claude selects the skill.

## The Formula

```
<Capability verb phrase>. <Secondary capability>. Use when <trigger1>, <trigger2>, or <trigger3>.
```

## Rules

### 1. Always Third Person

```yaml
# Correct
description: Processes crash data from App Center. Use when investigating crashes.

# Wrong
description: I can help you process crash data...
description: Help with crash processing...
```

### 2. Capability + Triggers

The description must answer:

1. **What does it do?** (capability)
2. **When should Claude use it?** (triggers)

```yaml
# Good - clear capability + triggers
description: Run KQL queries against Azure Data Explorer for telemetry analysis. Use when user mentions Kusto, KQL, ADX, or wants to query Azure logs.

# Bad - missing triggers
description: Run KQL queries.

# Bad - vague capability
description: Helps with data analysis. Use for queries.
```

### 3. Include Synonyms

Users say things differently. Include variations:

```yaml
description: Creates isolated git worktrees for parallel development. Use when starting feature work, need branch isolation, or want to work on multiple branches simultaneously.
```

The triggers cover: "worktree", "feature work", "branch isolation", "multiple branches"

### 4. Length Limit

**≤1024 characters**. If longer, you're including too much detail.

## Trigger Patterns by Skill Type

### CLI Reference Skills

```yaml
description: Execute Azure CLI commands for resources and DevOps. Use for az commands, ADO scripting, PR management, or pipeline automation.
```

Triggers: tool name, command patterns, task types

### Methodology Skills

```yaml
description: Systematic workflow for fixing bugs with evidence capture. Use when working from bug plans, need before/after screenshots, or fixing grouped issues.
```

Triggers: workflow name, key artifacts, problem types

### Domain Expertise Skills

```yaml
description: Expert guidance on Swift Concurrency patterns. Use when developers mention async/await, actors, data races, @MainActor, or Swift 6 migration.
```

Triggers: domain terms, common problems, version references

### Automation Skills

```yaml
description: Automate iOS Simulator interactions using AXe. Use when navigating simulator screens, automating UI tests, or verifying screen state.
```

Triggers: tool name, action types, verification needs

## Testing Triggers

Mental test: "Would Claude select this skill if user said X?"

```
User says: "help me query Kusto"
Skill description: "Run KQL queries... Use when user mentions Kusto, KQL, ADX..."
Result: ✓ Triggers on "Kusto"

User says: "analyze some data"
Skill description: "Run KQL queries... Use when user mentions Kusto, KQL, ADX..."
Result: ✗ Doesn't trigger - too vague
```

## Common Mistakes

| Mistake      | Example                     | Fix                         |
| ------------ | --------------------------- | --------------------------- |
| First person | "I help with..."            | "Processes..."              |
| No triggers  | "Handles database queries." | Add "Use when..."           |
| Too vague    | "Helps with data"           | Be specific about what/how  |
| Too long     | 2000 character essay        | Trim to essentials          |
| Jargon-only  | "Implements CQRS patterns"  | Add plain-language triggers |
