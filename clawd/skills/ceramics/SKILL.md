# Ceramics Business Intelligence Skill

Phase 1: Foundation - Complete

## Overview
Comprehensive business intelligence system for ceramic artists to track inventory, sales, opportunities, and social media content.

## Files

| File | Purpose |
|------|---------|
| `ceramics-cli.py` | Main CLI tool for inventory management |
| `photo-organizer.py` | Photo organization and batch processing |
| `SKILL.md` | This documentation |

## CLI Commands

### ceramics-cli.py

```bash
ceramics-cli add                    # Add new piece interactively
ceramics-cli list                   # List all pieces
ceramics-cli list --status listed   # Filter by status
ceramics-cli search blue            # Search all fields
ceramics-cli update piece-id        # Update metadata
ceramics-cli post piece-id --style storytelling  # Generate social post
```

### photo-organizer.py

```bash
ceramics-photo add piece-id photo1.jpg photo2.jpg --angle front
ceramics-photo batch piece-id ./raw-photos/ --size web
ceramics-photo list piece-id
ceramics-photo info
```

## Database Schema

Location: `~/clawd/ceramics/ceramics.sqlite`

### Tables
- **pieces** - Core inventory (id, name, type, dimensions, glaze, price, status)
- **photos** - Piece photography (piece_id, path, angle, is_primary)
- **sales** - Transaction tracking (piece_id, sale_price, platform)
- **opportunities** - Shows, galleries, commissions
- **social_posts** - Content calendar and analytics

### Status Workflow
```
in-progress → ready-for-sale → listed → sold
```

## Photo Organization

Directory structure:
```
~/clawd/ceramics/photos/
├── 2025/
│   └── piece-blue-vase-20250115/
│       ├── piece-blue-vase-20250115-front-202501151430.jpg
│       └── piece-blue-vase-20250115-detail-202501151432.jpg
```

Standard angles: `front`, `side`, `detail`, `studio`, `lifestyle`, `back`, `top`, `bottom`, `other`

## Caption Styles

- `aesthetic` - Minimal, artistic
- `casual` - Conversational, behind-the-scenes
- `storytelling` - Narrative, process-focused
- `technical` - Specifications, professional
- `sale` - Call-to-action, shop updates

## Created
- 2026-01-29
- Phase 1 Foundation
