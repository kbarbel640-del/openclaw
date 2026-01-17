# Agent Workflow Guide

**Private fork** (`clawdbot-dev`). PRs flow: `dev` → `fork` → `upstream`

**Agent character** You are my no-fluff advisor. Be direct, objective, and honest. Expose blind spots, challenge assumptions, and clearly call out excuses or wasted effort. Be concise and ruthless, no sugar-coating allowed.

Every claim should come with credible citations (URL, DOI, ISBN). Explicitly flag weak evidence. Provide answers as clear bullet points with source links. Eliminate fluff and passive voice. Maintain personality. No additional commentary.

If you do not know, you should be honest about it. If you need more clarity you should ask for it, one question at a time.

## Quick Start

1. Root `AGENTS.md` → source of truth for coding standards (**never edit, upstream-only**)
2. `/help` → available commands
3. `/dev:gate` → run before every commit

---

**Dev-only** (never push): `.workflow/`, `.claude/`

**Never edit upstream files**: Root `AGENTS.md`, `CHANGELOG.md`, `package.json`, `src/**` (unless contributing via PR)

---

## Commands

Run `/help` for full list.

---

## Upstream Contributions

| Task      | Command              |
| --------- | -------------------- |
| Fix issue | `/dev:fix-issue 123` |
| Review PR | `/dev:pr-review 123` |
| Test PR   | `/dev:pr-test 123`   |

---

## Builds

| Task            | Command                             |
| --------------- | ----------------------------------- |
| Release         | `/build:release [ver]`              |
| Hotfix status   | `./scripts/release-fixes-status.sh` |
| Daily (ARM+x86) | `./.workflow/scripts/daily-all.sh`  |

Hotfix branches: `hotfix/*` → auto-applied. See `automation/infrastructure.md` for details.

---

## Standards

See root `AGENTS.md`. Key: `/dev:gate` before commits, `scripts/committer` for scoped commits.

---

## Shell Scripts (Fork-Only)

**Applies to**:

- Scripts in `.workflow/scripts/`
- fork-specific scripts in `scripts/`, see `scripts/README.md`
- Scripts in `.claude`, e.g. for hooks and skills

### Required Standards

1. **Shebang**: Always use `#!/usr/bin/env bash` (portable, finds bash in PATH)

   ```bash
   #!/usr/bin/env bash
   # NOT: #!/bin/bash (assumes fixed location)
   ```

2. **Error handling**: Always use `set -euo pipefail` at the top

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail  # Exit on error, undefined vars, pipe failures
   ```

3. **Linting**: Always run `shellcheck` before committing

   ```bash
   shellcheck your-script.sh
   ```

   - Fix all errors and warnings
   - Use `# shellcheck disable=SC####` only when necessary, with explanation
   - Fork-specific linter: `.workflow/scripts/lint-fork-scripts.sh`

### Best Practices (from shellcheck)

1. **Quote variables**: Prevent word splitting and globbing

   ```bash
   # Good
   echo "$var"
   cp "$file" "$dest"

   # Bad - unquoted
   echo $var
   cp $file $dest
   ```

2. **Use [[]] for conditionals**: More robust than [ ]

   ```bash
   # Good
   if [[ "$var" == "value" ]]; then

   # Avoid
   if [ "$var" == "value" ]; then
   ```

3. **Use $() for command substitution**: More readable than backticks

   ```bash
   # Good
   result=$(command)

   # Avoid
   result=`command`
   ```

4. **Declare and assign separately**: Avoid masking return values

   ```bash
   # Good
   local result
   result=$(command)

   # Bad - masks command failure
   local result=$(command)
   ```

5. **Check command existence**: Before using external commands

   ```bash
   if ! command -v jq &>/dev/null; then
     echo "Error: jq is required" >&2
     exit 1
   fi
   ```

### Testing

- Test scripts with different shells if portable: `bash`, `dash`
- Test error conditions: missing files, invalid input, etc.
- Use `bash -n script.sh` to check syntax without executing

---

## Workflow

**After upstream sync**: Run `/dev:docs-review` to check for doc drift (e.g., renamed files, broken references).

---

## Troubleshooting

See `automation/infrastructure.md` for logs, environment variables, and troubleshooting commands.

---

## Signals

Drop issues/ideas in `.workflow/signals/` as `YYYY-MM-DD-<topic>.md`.
