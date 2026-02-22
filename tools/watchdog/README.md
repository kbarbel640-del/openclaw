# CLAUDE.md - watchdog

## What is this?

Automated code guardian. Combines bug fixing (test runner + auto-fixer) with security scanning (vigil). Runs hourly via OpenClaw cron. Zero dependencies.

## Architecture

- `vigil.js` -- security scanner (~300 lines, regex-based heuristic detection)
- Cron prompt -- agent instructions for the hourly bug fix + scan loop
- `.vigilignore` -- exclude files from security scanning

## Rules

- Fixes must be minimal and surgical
- Never refactor -- only fix what's broken
- Skip repos with no test suite
- Always run tests after fixing to verify
- Sync lockfiles after dependency changes
- False positives are acceptable. False negatives are not.
- Keep vigil.js under 500 lines. Split into modules if it grows.
- No external dependencies. Ever.

## Adding new security patterns

1. Add regex + metadata to the patterns array in vigil.js
2. Include: name, severity (CRITICAL/HIGH/MEDIUM/LOW), description, fix
3. Specify which file extensions it applies to
4. Test on at least 3 repos

## Commands

```bash
# Security scan
node vigil.js <repo-path>
node vigil.js <repo-path> --fix
node vigil.js <repo-path> --json

# Cron management
openclaw cron edit c3ed910d-a510-4025-9f38-b0fe3dad40d2 --message "new prompt"
openclaw cron runs --id c3ed910d-a510-4025-9f38-b0fe3dad40d2 --limit 5
```

## Future

- AST-based analysis for fewer false positives
- SARIF output for CI integration
- GitHub Action wrapper
- Auto-fix mode (apply suggestions via codemod)
- Taint tracking for data flow analysis
