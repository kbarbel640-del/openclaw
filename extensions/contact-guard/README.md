# Contact Guard Extension

Manages contact state files and enforces project authorization to prevent data leaks across sessions.

## Overview

Contact Guard provides three key hooks for maintaining contact context and preventing unauthorized project information from being shared:

1. **Auto-inject contact state on session start** (`before_agent_start`)
   - Loads contact info from `memory/contacts/<phone>.md`
   - Injects into system context so the agent knows who they're talking to
   - Includes authorized projects list to guide the agent's responses

2. **Scan outgoing messages for leaks** (`message_sending`)
   - Hooks before message delivery
   - Checks for unauthorized project keywords
   - Can warn, block, or redact based on configuration

3. **Preserve contact context during compaction** (`before_compaction`/`after_compaction`)
   - Clears caches after compaction
   - Contact context is automatically re-injected on next agent start

## Configuration

```json
{
  "plugins": {
    "contact-guard": {
      "contactStateDir": "memory/contacts",
      "projectRegistry": "projects/registry.json",
      "ownerPhones": ["+1234567890", "+0987654321"],
      "enableAutoInject": true,
      "enableLeakDetection": true,
      "enableCompactionPreserve": true,
      "leakAction": "warn"
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `contactStateDir` | string | `memory/contacts` | Directory containing contact state files |
| `projectRegistry` | string | `projects/registry.json` | Path to project registry JSON |
| `ownerPhones` | string[] | `[]` | Phone numbers that bypass all authorization checks |
| `enableAutoInject` | boolean | `true` | Auto-inject contact state into agent context |
| `enableLeakDetection` | boolean | `true` | Scan outgoing messages for project leaks |
| `enableCompactionPreserve` | boolean | `true` | Preserve contact context during compaction |
| `leakAction` | string | `warn` | Action on leak: `warn`, `block`, or `redact` |

## Contact State Files

Contact state files are markdown files named after the phone number (e.g., `+2348151259975.md`):

```markdown
# Contact: John Doe (+2348151259975)

**Name:** John Doe
**Relation:** Client
**Active project:** Project Alpha
**Last topic:** Bug fixes for API

## Authorized Projects
- Project Alpha
- Project Beta

## Recent Work
- 2024-01-15: Reviewed API changes
- 2024-01-14: Fixed authentication bug
```

## Project Registry

The project registry defines what projects exist and who is authorized:

```json
{
  "projects": [
    {
      "id": "project-alpha",
      "name": "Project Alpha",
      "authorized_contacts": ["owner", "+2348151259975"],
      "keywords": ["alpha", "project-a"]
    }
  ],
  "contact_aliases": {
    "owner": ["+1234567890", "+0987654321"]
  }
}
```

## CLI Commands

```bash
# Check contact authorization
clawdbot contact-guard check +2348151259975
```

## How It Works

### Session Start Flow
1. Message arrives from phone number
2. `before_agent_start` hook fires
3. Contact state file is loaded
4. Project registry is checked for authorization
5. Context block is prepended to agent prompt

### Message Sending Flow
1. Agent generates response
2. `message_sending` hook fires
3. Response is scanned for project keywords
4. If unauthorized project found:
   - `warn`: Log and continue
   - `block`: Cancel message
   - `redact`: Remove keywords and send

### Compaction Flow
1. Context gets truncated
2. `before_compaction` hook logs the event
3. `after_compaction` clears caches
4. Next message triggers `before_agent_start`
5. Fresh contact context is re-injected

## Security

This extension helps prevent data leaks but is not a complete security solution. It:

- ✅ Adds guardrails against accidental project mentions
- ✅ Provides context continuity across session truncations
- ✅ Logs potential leak attempts
- ❌ Cannot prevent determined circumvention
- ❌ Does not encrypt or sanitize at the protocol level

Always combine with proper access controls and review practices.
