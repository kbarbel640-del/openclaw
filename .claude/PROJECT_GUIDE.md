# Project-Level Settings

Share Claude Code config with team via git.

## Structure

Each project can have its own `.claude/` directory:

```
project/
├── .claude/
│   ├── settings.json    # Project-specific permissions
│   ├── commands/        # Project-specific slash commands
│   └── CLAUDE.md        # Project-specific guidelines
└── ...
```

## Project settings.json Template

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run build:*)",
      "Bash(npm run test:*)",
      "Bash(npm run lint:*)",
      "Bash(gh pr *)",
      "Bash(gh issue *)"
    ]
  }
}
```

## Precedence

Project `.claude/` **overrides** global `~/.claude/` for that project.

## When to Use

| Scenario           | Action                                     |
| ------------------ | ------------------------------------------ |
| Team project       | Add `.claude/` to repo, commit settings    |
| Personal scripts   | Use global `~/.claude/`                    |
| Security-sensitive | Explicit permission patterns, no wildcards |

---

_Updated: 2026-02-07_
