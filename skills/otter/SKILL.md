---
name: otter
description: Otter.ai transcription CLI - list, search, download, and summarize meeting transcripts.
homepage: https://otter.ai
metadata:
  clawdbot:
    emoji: "🦦"
    requires:
      bins: ["python3", "uv"]
    env:
      - OTTER_EMAIL
      - OTTER_PASSWORD
---

# Otter.ai Transcription CLI

Interact with Otter.ai to manage meeting transcripts - list, search, download, upload, and summarize.

## Setup

1. Set environment variables:
   ```bash
   export OTTER_EMAIL="your@email.com"
   export OTTER_PASSWORD="your-password"
   ```

2. Or configure in clawdis.json:
   ```json
   "otter": {
     "env": {
       "OTTER_EMAIL": "your@email.com",
       "OTTER_PASSWORD": "..."
     }
   }
   ```

## Commands

### List Recent Transcripts
```bash
uv run skills/otter/scripts/otter.py list [--limit 10]
```

### Get Full Transcript
```bash
uv run skills/otter/scripts/otter.py get <speech_id>
```

### Search Transcripts
```bash
uv run skills/otter/scripts/otter.py search "quarterly review"
```

### Download Transcript
```bash
uv run skills/otter/scripts/otter.py download <speech_id> [--format txt|pdf|docx|srt]
```

### Upload Audio for Transcription
```bash
uv run skills/otter/scripts/otter.py upload /path/to/audio.mp3
```

### Get Summary (AI-generated)
```bash
uv run skills/otter/scripts/otter.py summary <speech_id>
```

## Twenty CRM Integration (Optional)

To sync transcripts to Twenty CRM, also set:
```bash
export TWENTY_API_URL="https://api.your-twenty.com"
export TWENTY_API_TOKEN="your-token"
```

Then use:
```bash
uv run skills/otter/scripts/otter.py sync-twenty <speech_id> --contact "John Smith"
```

See `references/twenty-sync.md` for detailed CRM integration guide.

## Output Formats

All commands support `--json` for machine-readable output:
```bash
uv run skills/otter/scripts/otter.py list --json
```

## Notes

- Requires Otter.ai account (Business recommended for full API access)
- Uses unofficial Otter.ai API (reverse-engineered)
- Rate limits may apply
- Transcripts are cached locally to reduce API calls
