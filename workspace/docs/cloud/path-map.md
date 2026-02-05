# Path Map Design (Draft v0.1)

## Problem
Stored memory and tool outputs contain absolute paths (e.g. /Users/sulaxd/...).
These paths break when moving to another machine.

## Solution
Store logical paths in persistent state, resolve to physical paths on each node.

## Logical Roots
- @workspace/clawd
- @workspace/moltbot-fix
- @state/openclaw
- @output

## Example
Stored: @workspace/clawd/docs/plan.md
Resolved on node A: /Users/sulaxd/clawd/docs/plan.md
Resolved on node B: /Users/cruz/clawd/docs/plan.md

## Mapping Rules
- On write: physical -> logical (if under mapped roots)
- On read: logical -> physical
- If no mapping exists: return as-is + warning

## Config
Node provides path map at startup:
```
{
  "@workspace/clawd": "/Users/<name>/clawd",
  "@workspace/moltbot-fix": "/Users/<name>/moltbot-fix",
  "@state/openclaw": "/Users/<name>/.openclaw",
  "@output": "/Users/<name>/clawd/output"
}
```

## Migration Strategy
- Parse session/memory records
- Replace absolute paths with logical paths
- Keep original in audit log for traceability

