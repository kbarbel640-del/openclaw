# Group Manager Skill

Manage iMessage group chat bindings for multi-agent BlueBubbles deployments.

## Overview

When multiple agents share a single BlueBubbles/iCloud account (e.g., karl-brett, karl-kellen, karl-grant all on the `karl` account), group chats need explicit bindings to route to the correct agent. This skill handles:

1. **Auto-binding** — Detect new groups, match members to existing customers, auto-bind unambiguous ones
2. **Manual claim/unclaim** — Let agents claim or release groups
3. **Group listing** — Show which groups are bound to which agents

## How It Works

- Each customer has a **DM peer binding** (e.g., +12035548311 → karl-brett)
- When the iCloud account is added to a group, we check which customers are members
- **Exactly 1 customer** → auto-bind to their agent
- **Multiple customers** → conflict → stay silent until someone claims
- **Zero customers** → ignore (no customer in this group)

## Scripts

All scripts are in `scripts/` relative to this skill directory. They output JSON.

### scan-groups.sh

Scans all BlueBubbles groups and analyzes binding status.

```bash
scripts/scan-groups.sh
```

Output: `{ summary: {...}, groups: [{guid, displayName, status, boundTo, matchingCustomers}] }`

Status values:

- `bound` — already has a binding
- `auto-bindable` — exactly 1 customer member, safe to auto-bind
- `conflict` — multiple customers, needs manual resolution
- `unbound-no-customers` — no known customers in group

### auto-bind.sh

Detects auto-bindable groups and generates a config patch.

```bash
scripts/auto-bind.sh [--dry-run]
```

- `--dry-run` — show what would be bound without generating a live patch
- Without `--dry-run` — generates a `patch` field ready for `gateway config.patch`

Output includes `patch` field — apply it with the gateway tool:

```
gateway(action="config.patch", raw=<patch JSON>, note="Auto-bound N groups")
```

### claim-group.sh

Claim or unclaim a specific group.

```bash
# Claim
scripts/claim-group.sh --claim --agent-id karl-brett --group-identifier <id>

# Unclaim
scripts/claim-group.sh --unclaim --group-identifier <id>
```

The `--group-identifier` accepts:

- Full GUID (e.g., `any;+;abc123...`)
- Chat identifier (e.g., `abc123...` or `chat12345...`)
- Display name (case-insensitive, must be unique match)

Output includes `patch` field for `gateway config.patch`.

### list-groups.sh

List bound groups, optionally filtered by agent.

```bash
# All groups
scripts/list-groups.sh

# Groups for a specific agent
scripts/list-groups.sh --agent-id karl-brett
```

## Environment

Scripts use these defaults (override via args or env vars):

| Variable      | Default                      | Description                           |
| ------------- | ---------------------------- | ------------------------------------- |
| `BB_URL`      | `http://100.120.154.29:1235` | BlueBubbles server URL (karl account) |
| `BB_PASSWORD` | `$BLUEBUBBLES_KARL_PASSWORD` | BlueBubbles password                  |
| `CONFIG_PATH` | `~/.openclaw/openclaw.json`  | OpenClaw config path                  |
| `ACCOUNT_ID`  | `karl`                       | BlueBubbles account ID                |

## Agent Integration

### For karl-default (catch-all agent)

karl-default receives messages from unbound groups. When it gets a group message, it should:

1. Run `scan-groups.sh` to check if there are auto-bindable groups
2. If auto-bindable groups exist, run `auto-bind.sh` (NOT --dry-run)
3. Apply the patch via `gateway config.patch`
4. Notify the customer via their DM that their group was activated
5. Stay silent in the group (don't respond to the triggering message)

For conflicts, notify all matching customers via DM about the conflict and ask them to `/claim` it.

### For customer agents (karl-brett, karl-kellen, etc.)

Handle these commands from their DM user:

- **`/groups`** — Run `list-groups.sh --agent-id <self>` and show results
- **`/claim <group>`** — Run `claim-group.sh --claim --agent-id <self> --group-identifier <group>`, apply the patch
- **`/unclaim <group>`** — Run `claim-group.sh --unclaim --group-identifier <group>`, apply the patch

### Applying Patches

All scripts that modify config output a `patch` field. Apply it like this:

```
gateway(action="config.patch", raw=JSON.stringify(result.patch), note="<description>")
```

**Important:** After applying a patch, the gateway restarts. The group binding takes effect immediately on restart.

## What Gets Modified

When binding a group:

1. **`bindings` array** — new entry routing the group to the customer's agent
2. **`channels.bluebubbles.accounts.karl.groupAllowFrom`** — group members' phone numbers added so their messages pass the allowlist

When unbinding:

1. **`bindings` array** — entry removed (members stay in allowlist for simplicity)

## Examples

### Auto-bind flow (karl-default)

```
1. Message arrives in unbound group
2. karl-default runs: exec("scripts/scan-groups.sh")
3. Sees status: "auto-bindable", matchingCustomers: [{member: "+12035548311", agentId: "karl-brett"}]
4. Runs: exec("scripts/auto-bind.sh")
5. Applies patch via gateway config.patch
6. Sends DM to Brett: "I've joined your group chat with +16468318810. I'm now active there!"
7. Does NOT respond in the group to the triggering message
```

### Manual claim flow (karl-brett)

```
Brett DMs: /claim "Family Chat"
karl-brett runs: exec("scripts/claim-group.sh --claim --agent-id karl-brett --group-identifier 'Family Chat'")
Applies patch
Confirms: "Done! I'm now active in Family Chat (3 members)."
```
