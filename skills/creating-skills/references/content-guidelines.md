# Content Guidelines

What to include, exclude, and how to present content.

## Include

### 1. Workflows (Numbered Steps)

Claude needs to know the sequence of actions.

```markdown
## Workflow

1. Check prerequisites: `command --check`
2. Execute main action: `command --do`
3. Verify success: `command --verify`
```

### 2. Quick Reference Tables

Fast lookup for common operations.

```markdown
## Quick Reference

| Task       | Command          | Notes        |
| ---------- | ---------------- | ------------ |
| List items | `tool list`      |              |
| Get item   | `tool get ID`    | ID required  |
| Delete     | `tool delete ID` | Irreversible |
```

### 3. Concrete Examples

Show, don't tell. Minimal examples that demonstrate usage.

````markdown
## Example

```bash
# Download crash group details
curl -H "X-API-Token: $TOKEN" "$BASE/errorGroups/$GROUP_ID"
```
````

Expected output:

```json
{ "id": "abc123", "count": 42 }
```

````

### 4. Validation Steps

Every workflow needs verification.

```markdown
## Verify

```bash
# Confirm file was created
ls -la output.txt

# Check contents are valid
head -5 output.txt
````

Expected: Non-empty file with proper headers.

````

### 5. Gotchas / Troubleshooting

Document things that break and how to fix them.

```markdown
## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Access denied" | Token expired | Run `az login` |
| Empty output | Wrong filter | Check date range |
````

### 6. Integration Points

How this skill connects to others.

```markdown
## Related Skills

| Task               | Skill                   |
| ------------------ | ----------------------- |
| Navigate simulator | `/simulator-navigating` |
| Create PR          | `/using-azure-cli`      |
```

## Exclude

### 1. General Knowledge

Claude knows programming languages, common patterns, and basic concepts.

```markdown
# Don't include

"Swift is a programming language developed by Apple..."
"A function is a reusable block of code..."
"REST APIs use HTTP methods like GET and POST..."
```

### 2. Verbose Explanations

Prefer examples over prose.

```markdown
# Bad

"In order to successfully complete this operation, you must first ensure
that the prerequisites are met. The prerequisites include having valid
authentication credentials and ensuring network connectivity..."

# Good

1. Authenticate: `az login`
2. Verify: `az account show`
```

### 3. Setup/Installation (Unless Non-Obvious)

Skip standard installation unless there are gotchas.

````markdown
# Skip

"To install Node.js, visit nodejs.org and download..."

# Include only if non-obvious

## Setup (Python 3.12 Required)

```bash
# azure-kusto-data requires Python ≤3.12
mise x python@3.12 -- python -m venv .venv
```
````

````

### 4. README-Style Documentation

Skills serve Claude, not human readers.

```markdown
# Skip
"## Contributing
We welcome contributions! Please read our contributing guidelines..."

"## License
MIT License..."

"## Changelog
v1.0.0 - Initial release..."
````

### 5. Exhaustive API Documentation

Only include what's commonly used.

```markdown
# Skip

[400 lines documenting every API endpoint]

# Include

## Common Endpoints

| Endpoint    | Use         |
| ----------- | ----------- |
| GET /items  | List items  |
| POST /items | Create item |

For full API: [references/api-reference.md](references/api-reference.md)
```

## Presentation Guidelines

### Tables Over Lists

```markdown
# Prefer

| Flag   | Purpose             |
| ------ | ------------------- |
| --prod | Production database |
| --test | Test database       |

# Avoid

- `--prod`: Production database
- `--test`: Test database
```

### Code Blocks With Context

````markdown
# Good - shows what command does

```bash
# Get stack trace for crash group
curl -H "X-API-Token: $TOKEN" "$BASE/errorGroups/$ID/stacktrace"
```
````

# Bad - no context

```bash
curl -H "X-API-Token: $TOKEN" "$BASE/errorGroups/$ID/stacktrace"
```

````

### ASCII Diagrams for Complex Flows

```markdown
## Workflow

````

Phase 1: Setup
├── Check VPN
└── Authenticate

Phase 2: Query
├── Build query
├── Execute
└── Validate results

Phase 3: Report
└── Export data

```

```

### Critical Information in Callouts

```markdown
> **IMPORTANT:** Always delete DerivedData before capturing screenshots.

> **Note:** The column is `Http_ResponseCode` (string), not `Http_StatusCode`.
```

### Defaults + Escape Hatches

```markdown
## Database Selection

Default: `--prod` (Teams iOS Production)

| Flag     | Database                                |
| -------- | --------------------------------------- |
| --prod   | Production (default)                    |
| --test   | Test environment                        |
| --custom | Custom: `--cluster URL --database NAME` |
```

## Line Length Guidelines

| Component       | Target        | Max        |
| --------------- | ------------- | ---------- |
| Description     | ~200 chars    | 1024 chars |
| SKILL.md        | 200-400 lines | 500 lines  |
| Reference files | 100-200 lines | 300 lines  |
| Examples        | 3-5 lines     | 10 lines   |
| Tables          | 5-10 rows     | 20 rows    |
