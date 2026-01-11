---
name: emma
description: Retrieve municipal bond data from EMMA for CCRC/senior living engagements. Auto-syncs to Twenty CRM and SharePoint.
homepage: https://emma.msrb.org
metadata: {"clawdis":{"emoji":"📈","requires":{"bins":["pdftotext"],"env":["TWENTY_API_TOKEN","TWENTY_API_URL","SHAREPOINT_TENANT_ID","SHAREPOINT_CLIENT_ID","SHAREPOINT_CLIENT_SECRET"]}}}
---

# EMMA Skill

Retrieve municipal bond disclosure data from MSRB's EMMA system for CCRC engagements.
Automatically downloads documents, extracts metrics, syncs to Twenty CRM and uploads to SharePoint.

## Usage (Agent Context)

When a user provides an EMMA URL and mentions the community/engagement name:

```
User: "Sync EMMA data for Edgewood Baldwin - https://emma.msrb.org/IssueView/Details/P2415140"
```

Run:
```bash
cd skills/emma
uv run python scripts/emma.py auto "https://emma.msrb.org/IssueView/Details/P2415140" \
  --name "Edgewood Baldwin" \
  --sharepoint-drive "b!BSgdu..." \
  --sharepoint-folder "IT Advisory/EMMA Reports"
```

## What Happens

1. **Parse URL** → `P2415140`
2. **Download** Official Statement + key documents from EMMA
3. **Extract** unit counts, covenants, occupancy data from PDFs
4. **Search Twenty** for "Edgewood Baldwin" → finds matching engagement
5. **Create note** on engagement with all extracted data
6. **Upload PDFs** to SharePoint folder

## Command Options

```bash
# With name search + SharePoint
emma.py auto <url> --name "Community Name" \
  --sharepoint-drive "<drive-id>" \
  --sharepoint-folder "path/to/folder"

# With explicit engagement ID
emma.py auto <url> --engagement "uuid" \
  --sharepoint-drive "<drive-id>" \
  --sharepoint-folder "path"

# Twenty only (no SharePoint)
emma.py auto <url> --name "Name"
```

## Example Output

```
Issue ID: P2415140
Downloading documents to ./emma-P2415140...
  Downloading official_statement...
Extracting metrics...
Searching Twenty for 'Edgewood Baldwin'...
  Found: Edgewood - Baldwin (score: 4)
✓ Note synced to Twenty engagement
✓ Uploaded official_statement_P21566762.pdf to SharePoint
```

## What Gets Extracted

| Source | Data |
|--------|------|
| Official Statement | Unit counts (IL, AL/MC), DSCR covenant, Days Cash requirement |
| Occupancy Reports | Latest occupancy by level of care |

## SharePoint Drive IDs (One Point)

| Site | Drive ID |
|------|----------|
| Edgewood | `b!BSgduoDHskSBWcXef_RHjCAe8KYwVl1Alb9bkeMNAeVXqSdvhITOSq_Cl0M2iPpR` |

*Find other drives with:* `sharepoint.py sites` → `sharepoint.py drives <site-id>`

## Manual Commands

```bash
# Search EMMA
emma.py search "woodmont commons" --state NH

# List documents for an issue
emma.py docs P2415140

# Just download documents
emma.py download P2415140 -o ./docs/

# Extract metrics from downloaded docs
emma.py extract P2415140 --from-dir ./docs/

# Sync to specific engagement (manual)
emma.py sync P2415140 --engagement "uuid" --from-dir ./docs/
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWENTY_API_TOKEN` | Yes | Twenty CRM API token |
| `TWENTY_API_URL` | Yes | Twenty API URL |
| `SHAREPOINT_TENANT_ID` | For upload | Azure tenant ID |
| `SHAREPOINT_CLIENT_ID` | For upload | Azure app client ID |
| `SHAREPOINT_CLIENT_SECRET` | For upload | Azure app secret |

## Dependencies

```bash
# Install pdftotext
brew install poppler

# Python deps
cd skills/emma && uv sync
```
