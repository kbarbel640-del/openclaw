---
name: pptx
description: Parse PowerPoint files with rich extraction - text, structure, tables, and metadata. Includes One Point community parsing and Twenty CRM sync.
homepage: https://python-pptx.readthedocs.io
metadata:
  clawdis:
    emoji: "📊"
    requires:
      bins: ["python3", "uv"]
      env: ["TWENTY_API_URL", "TWENTY_API_TOKEN"]
    primaryEnv: "TWENTY_API_TOKEN"
---

# PowerPoint Parser

Extract structured content from PPTX files including text, tables, speaker notes, and metadata. Special support for One Point community reference guides with Twenty CRM integration.

## Commands

### Extract to JSON (structured)
```bash
uv run {baseDir}/scripts/pptx_parser.py extract <file.pptx> --json
```

### Extract to Markdown (readable)
```bash
uv run {baseDir}/scripts/pptx_parser.py extract <file.pptx> --markdown
```

### Get Metadata Only
```bash
uv run {baseDir}/scripts/pptx_parser.py info <file.pptx>
```

### Extract Specific Slides
```bash
uv run {baseDir}/scripts/pptx_parser.py extract <file.pptx> --slides 1-5,10
```

## One Point Community Parsing

Parse reference guide PPTXs and extract structured community data:

```bash
uv run {baseDir}/scripts/pptx_parser.py parse-community <reference-guide.pptx>
```

**Extracts:**
- Community name and address
- Client contacts (CEO, CFO, etc. with emails)
- One Point team (Partner, Client Lead, EM, Market Expert)
- Client goals
- Market analysis summaries
- Development vulnerabilities/opportunities
- Presentations log (dates)
- Next steps

## Twenty CRM Sync

Sync parsed community data directly to Twenty CRM:

```bash
# Parse and sync in one pipeline
uv run {baseDir}/scripts/pptx_parser.py parse-community <file.pptx> | \
  uv run {baseDir}/scripts/sync_to_twenty.py

# Dry run (show what would be created)
uv run {baseDir}/scripts/pptx_parser.py parse-community <file.pptx> | \
  uv run {baseDir}/scripts/sync_to_twenty.py --dry-run

# From saved JSON
uv run {baseDir}/scripts/sync_to_twenty.py --file community_data.json
```

**Creates/Updates in Twenty:**
- Links Engagement Manager (e.g., Hayley) to engagement
- Links Community record to engagement
- Creates People records for client contacts
- Creates Notes linked to engagement:
  - One Point Team
  - Client Goals
  - Market Analysis
  - Development Analysis
  - Presentations Log
  - Next Steps

## Output Structure (JSON)

### Standard Extract
```json
{
  "metadata": {
    "title": "Reference Guide",
    "author": "One Point",
    "slide_count": 38
  },
  "slides": [
    {
      "number": 1,
      "title": "Reference Guide: Carleton-Willard Village",
      "content": ["November 2025"],
      "notes": "Speaker notes here",
      "tables": []
    }
  ]
}
```

### Community Parse
```json
{
  "name": "Carleton-Willard Village",
  "address": "100 Old Billerica Rd, Bedford, MA 01730",
  "contacts": [
    {"name": "Chris Golen", "title": "CEO", "email": "cgolen@cwvillage.org"}
  ],
  "one_point_team": [
    {"name": "Hayley", "role": "Engagement Manager"}
  ],
  "goals": ["IL expansion", "Care level rightsizing"],
  "market_analysis": {"demand_summary": [...]},
  "development": {"vulnerabilities": [...], "opportunities": [...]},
  "presentations": [{"date": "Sept 9, 2025", "slide": 6}],
  "next_steps": ["RFQ", "Site Test Fit"]
}
```

## Environment Variables

- `TWENTY_API_URL` - Twenty API endpoint (e.g., `https://api.mollified.app`)
- `TWENTY_API_TOKEN` - Twenty API key (from Settings → Developers)

Configure in `~/.clawdis/clawdis.json`:
```json
{
  "skills": {
    "pptx": {
      "env": {
        "TWENTY_API_URL": "https://api.mollified.app",
        "TWENTY_API_TOKEN": "your-token"
      }
    }
  }
}
```

## Use Cases

- Parse One Point client reference guides
- Auto-populate Twenty CRM from PPTXs
- Extract community data for reports
- Search across presentation content
- Generate engagement summaries
