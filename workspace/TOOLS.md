# The Lab — Tool Notes

## Primary Tools

### Peekaboo (macOS UI Automation)

- Used for: screenshots, window management, click/type/hotkey in Lightroom
- Always use `--app "Adobe Lightroom Classic"` for targeting
- Use `peekaboo see --annotate` before clicking UI elements
- Use `peekaboo image` for clean screenshots (vision analysis)
- Use `peekaboo hotkey` for keyboard shortcuts
- Use `peekaboo press` for single key presses

### Vision Analyzer (Python Sidecar)

- Located at `src/thelab/vision/analyze.py`
- Runs via `python3` with mlx-vlm
- Modes: `analyze` (screenshot + profile → refined adjustment JSON) and `verify` (post-adjustment check)
- The target JSON now contains the photographer's learned profile, not a film stock

### Style Database (SQLite)

- Located at `~/.thelab/style.db`
- Contains: scenarios, photo_edits, scenario_profiles tables
- Query with `getProfile(scenarioKey)` for the photographer's typical adjustments
- Use `findClosestProfile(classification)` for fallback matching

### Catalog Ingester

- Reads .lrcat files in read-only mode (safe while Lightroom is running)
- Extracts develop settings + EXIF for all edited photos
- Run via: `npx tsx src/thelab/learning/ingest-pipeline.ts --catalog <path>`

### Live Observer

- Background process that watches the photographer edit
- Captures screenshots every 3 seconds, detects image changes
- Records edit deltas tagged by scenario into the style database

## Lightroom Keyboard Shortcuts

- `D` — switch to Develop module
- Arrow keys — navigate between images
- `P/U/X` — flag pick/unflag/reject
- `0-5` — star rating
- `Cmd+Shift+R` — reset all develop settings
- `Cmd+Z` — undo last adjustment

## Safety Rules

- Never delete or move the photographer's original files
- Never auto-reject flagged images — always surface for human review
- Never apply adjustments that alter facial features or body geometry
- Always persist state before executing destructive actions
- Open .lrcat catalogs in read-only mode only
