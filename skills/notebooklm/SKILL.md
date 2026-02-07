---
name: notebooklm
description: Google NotebookLM for knowledge synthesis — create AI podcasts, reports, quizzes, flashcards, and mind maps from your sources. Triggers: NotebookLM, podcast, summarize sources, knowledge synthesis.
homepage: https://notebooklm.google.com
metadata:
  {
    "openclaw":
      {
        "emoji": "🎙️",
        "requires": { "bins": ["nlm"] },
        "install":
          [
            {
              "id": "pipx",
              "kind": "pipx",
              "package": "notebooklm-cli",
              "bins": ["nlm"],
              "label": "Install notebooklm-cli (pipx)"
            },
            {
              "id": "pip",
              "kind": "pip",
              "package": "notebooklm-cli",
              "bins": ["nlm"],
              "label": "Install notebooklm-cli (pip)"
            }
          ]
      }
  }
---

# NotebookLM

Use Google NotebookLM to synthesize knowledge from multiple sources into AI-generated podcasts, reports, quizzes, flashcards, mind maps, and more.

## Setup

1. Install the CLI:

   ```bash
   pipx install notebooklm-cli
   # or: pip install notebooklm-cli
   ```

2. Authenticate (opens Chrome, extracts session cookies):

   ```bash
   nlm login
   ```

3. Verify authentication:
   ```bash
   nlm auth status
   ```

Requirements: Python 3.10+, Google Chrome (for auth).

## Core Workflow

**List notebooks:**

```bash
nlm notebook list
```

**Create a notebook:**

```bash
nlm notebook create "My Research"
# Output: Created notebook: abc123-def456-...
```

**Add sources to a notebook:**

```bash
# Add a URL
nlm source add <notebook-id> --url "https://example.com/article"

# Add a YouTube video
nlm source add <notebook-id> --url "https://youtube.com/watch?v=..."

# Add pasted text
nlm source add <notebook-id> --text "Your content here" --title "My Notes"

# Add from Google Drive
nlm source add <notebook-id> --drive <doc-id>
```

**List sources in a notebook:**

```bash
nlm source list <notebook-id>
```

## Content Generation

All generation commands require `--confirm` to execute:

**Generate AI podcast:**

```bash
nlm audio create <notebook-id> --confirm
```

**Generate report:**

```bash
nlm report create <notebook-id> --confirm
```

**Generate study materials:**

```bash
nlm quiz create <notebook-id> --confirm
nlm flashcards create <notebook-id> --confirm
nlm mindmap create <notebook-id> --confirm
nlm slides create <notebook-id> --confirm
```

**Check generation status:**

```bash
nlm studio status <notebook-id>
```

## Chat & Query

**Ask questions about your sources:**

```bash
nlm notebook query <notebook-id> "What are the key findings?"
```

**Interactive chat session:**

```bash
nlm chat start <notebook-id>
# REPL commands: /sources, /clear, /help, /exit
```

## Research (Discover New Sources)

**Web search for sources:**

```bash
nlm research start "query" --notebook-id <id>
nlm research start "query" --notebook-id <id> --mode deep
```

**Search Google Drive:**

```bash
nlm research start "query" --notebook-id <id> --source drive
```

**Import discovered sources:**

```bash
nlm research import <notebook-id> <task-id>
```

## Aliases (UUID Shortcuts)

Create memorable names for notebook IDs:

```bash
nlm alias set myproject abc123-def456-...
nlm notebook list  # Shows "myproject" instead of UUID
nlm source add myproject --url "..."
```

## Output Formats

```bash
nlm notebook list --format json
nlm notebook list --format quiet  # IDs only
```

## AI Integration

Generate full documentation for AI assistants:

```bash
nlm --ai
```

## Notes

- Session cookies expire; re-run `nlm login` if needed
- Multiple profiles supported: `nlm login --profile work`
- Config stored in `~/.config/nlm/`
