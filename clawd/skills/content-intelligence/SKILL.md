# Content Intelligence System (CIS) v1.0

Track, harvest, and extract actionable insights from content sources.

## Overview

CIS monitors content creators across platforms (Substack, YouTube, blogs) and:
1. **Archives** historical content
2. **Extracts** AI-powered insights
3. **Routes** insights to PARA categories
4. **Monitors** for new content daily

## Quick Start

```bash
# Add a new source interactively
clawdbot content add-source

# Or initialize directly
clawdbot content init "Nate Jones" "https://natejones.substack.com" --platform substack

# Harvest historical content
clawdbot content harvest nate-jones

# Extract insights with AI
clawdbot content extract nate-jones

# Route to PARA
clawdbot content route nate-jones

# Check for new content
clawdbot content monitor
```

## Commands

| Command | Description |
|---------|-------------|
| `init [name] [url]` | Initialize new content source |
| `add-source` | Interactive wizard to add source |
| `harvest [name]` | Fetch historical content |
| `extract [name]` | AI-powered insight extraction |
| `route [name]` | Route insights to PARA categories |
| `monitor` | Check for new content |
| `list` | Show all tracked sources |

## Directory Structure

```
~/clawd/content-intelligence/
├── sources/
│   └── [source-name]/
│       ├── archive/          # Raw content (JSON)
│       ├── insights/         # Extracted insights (JSON)
│       └── metadata/         # Source info, routing logs
├── config/
│   └── sources.json          # Source registry
└── logs/
    ├── monitor_checks.json   # Daily check history
    └── weekly-digest-*.json  # Weekly summaries
```

## Supported Platforms

- **Substack** - Full post harvesting with content extraction
- **YouTube** - Video metadata cataloging (requires `yt-dlp`)
- **Blog/RSS** - RSS/Atom feed parsing (requires `feedparser`)
- **Twitter** - Planned
- **Podcast** - Planned

## Insight Extraction

The system extracts:

1. **Actionable Advice** - Techniques, methods, steps to implement
2. **Frameworks** - Mental models and structured approaches
3. **Key Takeaways** - Core messages and lessons
4. **Resources** - Books, tools, references mentioned
5. **Quotes** - Memorable statements

Extracted insights are tagged with:
- PARA category (Projects/Areas/Resources/Archives)
- Topic tags for filtering
- Applicability (personal/business/creative/etc.)

## PARA Integration

Insights route to PARA categories based on content analysis:

**Active Projects:**
- Sticker business venture
- Ceramics/handmade goods
- EF Coaching practice
- Content Intelligence System

**Active Areas:**
- Business Development
- Creative Practice
- Personal Productivity
- Learning & Development

Routed insights are saved to `~/clawd/memory/para.sqlite` in the `cis_routing` table.

## Monitoring

Daily monitoring (`clawdbot content monitor`):
- Checks all sources for new content
- Auto-harvests new items
- Auto-extracts insights
- Logs to `monitor_checks.json`

Weekly digest generation:
- Summarizes new content from past 7 days
- Saved to `weekly-digest-YYYYMMDD.json`

## Cron Setup

Add to crontab for automated monitoring:

```bash
# Daily check at 9 AM
0 9 * * * cd ~/clawd/skills/content-intelligence && python3 content-cli.py monitor

# Weekly digest every Monday at 10 AM
0 10 * * 1 cd ~/clawd/skills/content-intelligence && python3 -c "from lib.monitor import Monitor; m = Monitor(); m.generate_weekly_digest()"
```

## Configuration

Sources are configured in `~/clawd/content-intelligence/config/sources.json`:

```json
{
  "sources": {
    "nate-jones": {
      "name": "Nate Jones",
      "url": "https://natejones.substack.com",
      "platform": "substack",
      "status": "active",
      "archive_count": 42,
      "insight_count": 156
    }
  }
}
```

## Dependencies

Required Python packages:
```bash
pip install requests beautifulsoup4
```

Optional (for full functionality):
```bash
pip install yt-dlp      # YouTube support
pip install feedparser  # RSS/Atom support
```

## Adding New Sources

1. Find the creator's main URL
2. Determine platform (Substack, YouTube, etc.)
3. Run: `clawdbot content init "Name" "URL" --platform [type]`
4. Run: `clawdbot content harvest [name]`
5. Run: `clawdbot content extract [name]`
6. Run: `clawdbot content route [name]`

## Files

- `content-cli.py` - Main CLI entry point
- `lib/source_manager.py` - Source CRUD operations
- `lib/harvester.py` - Platform-specific harvesting
- `lib/insight_extractor.py` - AI insight extraction
- `lib/para_router.py` - PARA category routing
- `lib/monitor.py` - New content monitoring

## Version

CIS v1.0 - January 2026
