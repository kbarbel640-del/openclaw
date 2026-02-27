---
name: klabo-times
description: Generates and prints daily family newspaper for the Klabo household. Use when printing newspaper, updating Klabo Times content, or managing daily print schedule.
invocation: user
arguments: "[print|preview|schedule]"
---

# Klabo Times

Daily family newspaper printed on Brother HL-L2370DW (192.168.1.7).

## Design Target: Black & White Laser Printer

**All design decisions optimize for B&W laser output:**

- No color dependencies - everything must work in pure B&W
- Minimum line weight: 0.5pt (thinner lines disappear on laser)
- No gray fills - use patterns (dots, stripes, hatching) instead
- High contrast required - laser printers lose subtle gradients
- Test in grayscale preview before finalizing any design changes
- Decorative elements use Unicode symbols, not images
- Typography hierarchy through weight/size, not color

## Quick Reference

| Command                 | Action                             |
| ----------------------- | ---------------------------------- |
| `/klabo-times print`    | Generate and print today's edition |
| `/klabo-times preview`  | Generate without printing          |
| `/klabo-times schedule` | Set up daily cron job              |

## Family Members

| Person     | Content Focus                                                  |
| ---------- | -------------------------------------------------------------- |
| **Joel**   | Bitcoin price/stats, tech news, honklab status                 |
| **Claire** | Recipe of the day, wellness tip, local events, garden/seasonal |
| **Poppy**  | Remarkable women in history, art/creativity prompts            |
| **Beau**   | Space facts, dinosaurs, vehicles, animals                      |

## Layout (Double-Sided)

### Front Page

```
┌─────────────────────────────────────┐
│         THE KLABO TIMES             │
│   "All the News That's Fit to Honk" │
├─────────────────────────────────────┤
│ Date │ Petaluma, CA │ Edition #XXX  │
├─────────────────────────────────────┤
│           WEATHER BOX               │
│  Today's forecast + 3-day outlook   │
├──────────────────┬──────────────────┤
│  POPPY'S CORNER  │  BEAU'S REPORT   │
│  Remarkable woman│  Space/dino fact │
│  of the day      │  Cool discovery  │
├──────────────────┴──────────────────┤
│           BITCOIN CORNER            │
│  Price │ Block height │ Sats/$1     │
├─────────────────────────────────────┤
│        FAMILY CALENDAR              │
│  Upcoming birthdays & events        │
└─────────────────────────────────────┘
```

### Back Page

```
┌─────────────────────────────────────┐
│          CLAIRE'S KITCHEN           │
│  Recipe of the day (simple/seasonal)│
├─────────────────────────────────────┤
│          WELLNESS CORNER            │
│  Health tip, mindfulness, or quote  │
├──────────────────┬──────────────────┤
│  LOCAL EVENTS    │  GARDEN CORNER   │
│  Petaluma area   │  Seasonal tips   │
│  family-friendly │  or plant care   │
├──────────────────┴──────────────────┤
│           FUN & GAMES               │
│  Riddle, joke, or family challenge  │
├─────────────────────────────────────┤
│          HONKLAB STATUS             │
│  Node sync % │ Machines online      │
└─────────────────────────────────────┘
```

## Workflow

1. **Gather data**: Weather API, Bitcoin price, calendar events
2. **Generate content**: Rotate through curated facts/recipes
3. **Render HTML**: Front and back pages
4. **Convert to PDF**: Chromium headless
5. **Print**: `lp -d Brother_HL_L2370DW_series -o sides=two-sided-long-edge`

## Printer Settings

```bash
# Double-sided print
lp -d Brother_HL_L2370DW_series -o sides=two-sided-long-edge file.pdf

# Check printer status
lpstat -p Brother_HL_L2370DW_series
```

## Data Sources

| Data     | Source            | Fallback                   |
| -------- | ----------------- | -------------------------- |
| Weather  | wttr.in API       | Static "Check weather app" |
| Bitcoin  | mempool.space API | honkbox node RPC           |
| Calendar | `/calendar` skill | Manual events in assets/   |

## Content Rotation

Content stored in `assets/` with dated rotation:

- `assets/remarkable-women.json` - 365 entries
- `assets/space-facts.json` - Beau's daily facts
- `assets/recipes.json` - Simple family recipes
- `assets/wellness-tips.json` - Daily wellness content

## Verification

After printing:

1. Check printer queue: `lpstat -o`
2. Verify double-sided: Physical inspection
3. Content accuracy: Date, weather, Bitcoin price

## Troubleshooting

| Issue                | Fix                                    |
| -------------------- | -------------------------------------- |
| Printer offline      | `ping 192.168.1.7`, check power        |
| Single-sided only    | Add `-o sides=two-sided-long-edge`     |
| PDF conversion fails | Install chromium: `pacman -S chromium` |
| Weather API down     | Falls back to static message           |

## Related

- `/honklab` - Printer documentation
- `/calendar` - Family calendar integration
- `/bitcoin` - Node status for Bitcoin corner
