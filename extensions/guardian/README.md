# @openclaw/guardian

> **The missing safety layer for AI agents.**

## Why This Exists

OpenClaw is powerful — it gives AI agents direct access to shell commands, file operations, email, browser automation, and more. That power is exactly what makes it useful, but it's also what makes people nervous.

**openclaw-guardian** fills that gap. It sits between the AI's decision and the actual execution, using a two-tier blacklist to catch dangerous operations and LLM-based intent verification to confirm the user actually asked for them.

The key insight: **99% of what an AI agent does is harmless** (reading files, fetching URLs, writing notes). Only ~1% is potentially dangerous. Guardian only intervenes on that 1%, so you get safety without sacrificing speed.

## How It Works

```
AI Agent wants to run a tool
            ↓
  ┌─────────────────────┐
  │  Blacklist Matcher   │  ← Regex rules, 0ms, no model call
  │  critical / warning  │
  └─────────┬───────────┘
            ↓
  ┌─────────┼───────────┐
  ↓         ↓           ↓
No match  Warning    Critical
 (pass)  (1 vote)   (3 votes)
  ↓         ↓           ↓
Execute  confirmed?  ALL 3 confirmed?
 0ms     yes→exec    yes→exec
         no→block    no→block
```

### Two-Tier Blacklist

| Tier | LLM Votes | Latency | When |
|------|-----------|---------|------|
| No match | 0 | 0ms | Reading files, fetching URLs, normal operations |
| Warning | 1 (1/1) | ~1-2s | `sudo`, `rm -r`, `chmod 777`, `eval` |
| Critical | 3 (3/3) | ~2-4s | `rm -rf /`, `mkfs`, `dd of=/dev/`, reverse shells |

### What Gets Checked

Guardian inspects three categories:

1. **`exec`** — command string matched against exec blacklist rules
2. **`write`** / **`edit`** — file path matched against path blacklist rules
3. **All other tools** — action-like param fields (`action`, `method`, `command`, `operation`) matched against tool-level blacklist rules

### Critical Rules (exec)

- `rm -rf` on system paths (excludes `/tmp/` and `/home/clawdbot/`)
- `mkfs`, `dd` to block devices, redirects to `/dev/sd*`
- Writes to `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`
- `shutdown`, `reboot`, `init 0/6`
- Disabling SSH (`systemctl stop sshd`)
- Bypass attempts: absolute-path `rm`, interpreter-based destruction
- Interpreter inline code: `node -e` with child_process/network, `python -c` with os.system/subprocess/socket, `perl -e`/`ruby -e` with system calls
- Reverse shells: `bash -i >& /dev/tcp/`, `nc -e`, `ncat --exec`, `socat exec`
- Process injection: `gdb -p`, `strace -p`, `ptrace`
- Kernel modules: `insmod`, `modprobe`, `rmmod`
- Pipe attacks: `curl | sh`, `wget | bash`, `base64 -d | sh`
- Chain attacks: download + `chmod +x`, download + shell execute
- Crontab injection: `echo ... | crontab -`

### Warning Rules (exec)

- `rm -rf` on safe paths, `sudo`, `eval`
- `chmod 777`, `chmod -R`, `chown -R`, setuid/setgid bits
- `kill -9`, `killall`, `pkill`
- `systemctl stop/disable/restart`
- `DROP DATABASE/TABLE`, `TRUNCATE`
- Firewall changes (`iptables`, `ufw`)
- Crontab modification, disk operations, SSH key operations
- Security-sensitive environment variables

### Whitelist (Always Allowed)

| Pattern | Why |
|---------|-----|
| `git` operations | Version control is non-destructive |
| `cat`, `ls`, `grep`, `head`, `tail`, etc. | Read-only commands |
| `echo`, `printf` (no pipe) | Output only |
| `node -p` | Print-only evaluation |
| `mkdir`, `touch` | Creating files/dirs is non-destructive |
| `tar`, `unzip`, `gzip`, `bzip2`, `xz`, `7z` | Archive operations |
| `openclaw` CLI | OpenClaw's own commands |

### Tool-Level Blacklist

Guardian scans action-oriented fields for **any** tool (email, database, message, etc.):

- **Critical**: `batchDelete`, `expunge`, `emptyTrash`, `purge`, `DROP DATABASE/TABLE`, `TRUNCATE`, `DELETE FROM`
- **Warning**: `delete`, `trash`

### LLM Intent Verification

When a blacklist rule matches, Guardian reads recent conversation context and asks a lightweight LLM: **"Did the user explicitly request this operation?"**

- Uses the cheapest/fastest model from your existing OpenClaw config (prefers Haiku, GPT-4o-mini, Gemini Flash)
- No separate API key needed
- If LLM unavailable: critical → block (fail-safe), warning → ask user

### Dual Protection Protocol

**Layer 1 — Guardian Plugin (automatic):** Regex + LLM verification blocks dangerous tool calls.

**Layer 2 — Agent Self-Discipline (behavioral):** When blocked, the agent must stop, report to the human, and wait for confirmation. No bypass, no retry.

```
Tool call → Regex match → Guardian blocks → Agent stops → Human decides
```

## Architecture

```
extensions/guardian/
├── openclaw.plugin.json    # Plugin manifest (v2.0.0)
├── package.json            # @openclaw/guardian
├── tsconfig.json           # TypeScript config
├── default-policies.json   # Enable/disable toggle
├── index.ts                # Entry — registers before_tool_call hook
├── src/
│   ├── blacklist.ts        # Two-tier regex rules + tool-level blacklist
│   ├── llm-voter.ts        # LLM intent verification (single/multi vote)
│   └── audit-log.ts        # SHA-256 hash-chain audit logger
└── test/
    ├── blacklist.test.ts   # Blacklist rule tests (exec, path, tool-level, newline bypass)
    └── llm-voter.test.ts   # LLM voter tests (mock, fail-safe, concurrency)
```

### How It Hooks Into OpenClaw

Guardian registers a `before_tool_call` plugin hook. This fires **after** the model decides to call a tool but **before** execution. If Guardian returns `{ block: true }`, the tool is stopped and the model receives a rejection message.

## Audit Log

Every blacklist-matched operation is logged to `~/.openclaw/guardian-audit.jsonl` with SHA-256 hash chaining:

```json
{
  "timestamp": "2026-02-27T05:00:00.000Z",
  "toolName": "exec",
  "blacklistLevel": "critical",
  "blacklistReason": "rm -rf on root-level system path",
  "userConfirmed": false,
  "finalReason": "Only 1/3 confirmed (need 3)",
  "hash": "a1b2c3...",
  "prevHash": "d4e5f6..."
}
```

## Token Cost

| Scenario | % of Operations | Extra Cost |
|----------|----------------|------------|
| No match | ~99% | 0 |
| Warning | ~0.5-1% | ~500 tokens |
| Critical | <0.5% | ~1500 tokens |

## Configuration

Guardian is enabled by default. To disable:

```json
{
  "openclaw-guardian": {
    "enabled": false
  }
}
```

## Status

🚧 Under active development — contributions welcome.

## License

MIT
