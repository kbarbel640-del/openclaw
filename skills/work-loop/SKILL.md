---
name: work-loop
description: Set up automated GitHub issue → PR → merge work loops for any repository. Use when creating a new automated development loop, adding a repo to the work loop system, configuring cron-based sub-agent workflows, or replicating the axiom-trader automation pattern to other projects.
---

# Work Loop Skill

Automate the full development cycle: issues get picked from a kanban board, worked by sub-agents in isolated worktrees, verified by fresh agents, and merged automatically.

## Quick Start

To add a new repo to the work loop:

```bash
# 1. Run the setup script
python3 scripts/setup-work-loop.py <repo-name> <github-repo> <local-path>

# 2. Follow the prompts to configure Discord channel, project board, etc.

# 3. Create the cron job (script outputs the command)
```

## How It Works

1. **Gate script** runs every 2 minutes via cron
2. **Checks GitHub Projects board** for work in priority order:
   - Fix blocked PRs (highest priority)
   - Verify unreviewed PRs  
   - Execute new issues from "Ready" column
3. **Creates isolated worktree** for sub-agent
4. **Sub-agent executes** using Research → Plan → Execute model
5. **Verifier reviews** and merges (or sends back for fixes)

## Prerequisites

Before setting up a work loop:

1. **GitHub repo** with issues enabled
2. **GitHub Projects v2 board** with columns: Backlog, Ready, In progress, In review, Done
3. **Discord channel** for status updates
4. **`gh` CLI** authenticated
5. **`gh-as-ada`** wrapper for bot operations (or use `gh` directly)

## Setup Steps

### 1. Create GitHub Project Board

```bash
# Create project (do this in GitHub UI, then get IDs)
gh project list --owner <username>
```

Get the project field IDs — see [references/get-project-ids.md](references/get-project-ids.md) for the GraphQL queries.

### 2. Create Config File

Copy the template and edit:

```bash
cp assets/config-template.json ~/.config/work-loops/<repo-name>.json
```

Required fields — see [references/config-schema.md](references/config-schema.md) for full schema.

### 3. Install Gate Script

```bash
# Copy gate script to ~/bin/
cp scripts/work-loop-gate.sh ~/bin/
chmod +x ~/bin/work-loop-gate.sh
```

### 4. Create Cron Job

```bash
openclaw cron add \
  --name "<repo-name>-loop" \
  --schedule '{"kind":"every","everyMs":120000}' \
  --payload '{"kind":"script","command":"bash ~/bin/work-loop-gate.sh <job-id> <repo-name> 3","timeout":30,"model":"sonnet","thinking":"low"}' \
  --sessionTarget isolated
```

Replace `<job-id>` with the ID returned by `openclaw cron list`.

### 5. (Optional) Add Coding Standards

Create `CODING-STANDARDS.md` in the repo root. See [assets/coding-standards-template.md](assets/coding-standards-template.md) for a starting point.

## Managing the Loop

### Check Status

```bash
# View cron job status
openclaw cron list

# Check recent runs
openclaw cron runs <job-id>

# View active sub-agents
openclaw sessions --active 5
```

### Manual Operations

```bash
# Run gate script manually
bash ~/bin/work-loop-gate.sh <job-id> <repo-name> 3

# Move issue on board (via GraphQL)
# See references/board-operations.md
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "No Ready items" | Drag issues to Ready column in GitHub Projects |
| PR stuck blocked | Check for "fixed" comment, or manually spawn verifier |
| Sub-agent touched forbidden path | Kill session, revert changes |
| Worktree creation fails | `cd <repo> && git worktree prune` |

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/work-loop-gate.sh` | Main gate script (install to ~/bin/) |
| `scripts/setup-work-loop.py` | Interactive setup helper |
| `assets/config-template.json` | Config file template |
| `assets/coding-standards-template.md` | Optional repo standards template |
| `references/config-schema.md` | Full config documentation |
| `references/get-project-ids.md` | GraphQL queries for project setup |
| `references/board-operations.md` | Manual board manipulation |
