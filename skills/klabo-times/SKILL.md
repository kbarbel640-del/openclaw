---
name: klabo-times
description: Generates and prints daily family newspaper for the Klabo household. Use when printing newspaper, updating Klabo Times content, or managing daily print schedule.
invocation: user
arguments: "[print|preview|schedule] [--no-gate] [--strict] [--style classic|tabloid] [--styles both]"
---

# Klabo Times

Daily family newspaper printed on Brother HL-L2370DW (192.168.1.7).

## Quick Reference

| Command                                | Action                                    |
| -------------------------------------- | ----------------------------------------- |
| `/klabo-times print`                   | Generate, gate, and print today's edition |
| `/klabo-times preview`                 | Generate and gate without printing        |
| `/klabo-times preview --no-gate`       | Generate without running the gate         |
| `/klabo-times preview --strict`        | Use tighter gate thresholds               |
| `/klabo-times schedule`                | Set up daily cron job                     |
| `/klabo-times preview --style classic` | Generate classic broadsheet styling       |
| `/klabo-times preview --style tabloid` | Generate tabloid headline styling         |
| `/klabo-times preview --styles both`   | Generate both style PDFs for comparison   |

## Layout System (Monochrome)

- Fixed newspaper layout with named sections (masthead, hero, family corners).
- Pure B&W hierarchy: line weight, spacing, and patterns only.
- Content contracts validate lengths before render to avoid overflow.

## Workflow

1. Gather data: Weather API and Bitcoin price.
2. Select daily content from `content/library.json`.
3. Generate HTML using `scripts/layout_engine.py`.
4. Render PDF with headless Chromium.
5. Run layout gate on PDFs.
6. Print with double sided settings.

## Layout Gate

The gate verifies:

- Enough ink coverage (no empty pages).
- No large blank vertical gaps inside columns.
- Column bottoms are balanced.

Files:

- `scripts/layout_gate.py`
- `scripts/run-gate.sh`

## Data Sources

| Data          | Source                 | Fallback               |
| ------------- | ---------------------- | ---------------------- |
| Weather       | wttr.in API            | "Check weather app"    |
| Bitcoin       | mempool.space API      | "N/A"                  |
| Daily content | `content/library.json` | Deterministic rotation |

## Content Rotation

Content is stored in `content/library.json` and rotates by day of year:

- remarkable_women
- space_facts
- recipes
- wellness
- riddles
- challenges
- briefs
- quotes
- local_events
- garden_tasks
- calendar_items

## Printer Settings

```bash
# Double-sided print
lp -d Brother_HL_L2370DW_series -o sides=two-sided-long-edge file.pdf

# Check printer status
lpstat -p Brother_HL_L2370DW_series
```

## Troubleshooting

| Issue                | Fix                                                                 |
| -------------------- | ------------------------------------------------------------------- |
| Gate fails           | Check PDFs in /tmp/klabo-times and re-run with --no-gate to inspect |
| PDF conversion fails | Install chromium: `pacman -S chromium`                              |
| Gate tool missing    | Install poppler-utils for pdftoppm                                  |
| Weather API down     | Falls back to "Check weather app"                                   |

## Related

- `/honklab` - Printer documentation
- `/calendar` - Family calendar integration
- `/bitcoin` - Node status for Bitcoin corner
