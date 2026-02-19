# SOPHIE — UI SPECIFICATION

## THE LAB ® / DEPARTMENT OF VIBE

### v0.2 / 2026 / CONFIDENTIAL

---

## ARCHITECTURE

### Stack

- **Electron** (main + renderer) — local-first, single Mac binary
- **React + TypeScript** (renderer)
- **Tailwind CSS** + custom design tokens from `design-system.md`
- **SQLite** via `node:sqlite` (style database, session state)
- **IPC channels** for main/renderer communication
- **`src/thelab/`** modules as the backend engine

### Design Reference

All visual decisions follow `docs/design-system.md` — the American Industrial Utility language reverse-engineered from Brass Hands references and approved by the Equity Council.

---

## APP SHELL

```
┌──────────────────────────────────────────────────────────────────┐
│ THE LAB ®                                  DEPARTMENT OF VIBE    │
│ SOPHIE / CHAT                                       v0.1 / 2026 │
├──────────────────────────────────────────────────────────────────┤
│        │                                                         │
│  NAV   │                                                         │
│        │                   MAIN AREA                             │
│ [■] CH │                                                         │
│ [ ] LN │   (content changes per active section)                  │
│ [ ] ED │                                                         │
│ [ ] DN │                                                         │
│        │                                                         │
│        │                                                         │
│        │                                                         │
│        │                                                         │
│        │                                                         │
│        │                                                         │
├────────┴─────────────────────────────────────────────────────────┤
│ ● SOPHIE / STATUS: IDLE                           LOCAL / MACOS  │
└──────────────────────────────────────────────────────────────────┘
```

### Header Bar

- Left: `THE LAB ®` in Space Grotesk 700, 14px, uppercase
- Left below: `SOPHIE / [ACTIVE SECTION]` in JetBrains Mono 400, 11px, uppercase, +3px tracking, `--text-secondary`
- Right: `DEPARTMENT OF VIBE` in JetBrains Mono 400, 10px, uppercase
- Right below: `v0.1 / 2026` in JetBrains Mono 400, 10px, `--text-muted`
- Separated from content by 2px `--border-strong` rule

### Navigation Rail (Left, 64px wide)

```
┌────────┐
│        │
│ [■] CH │   CHAT
│ [ ] LN │   LEARN
│ [ ] ED │   EDIT     ●
│ [ ] DN │   DNA
│        │
│        │
│        │
└────────┘
```

- Square indicators, not circles, not rounded
- 2-letter abbreviations in JetBrains Mono, 10px, uppercase
- Active state: filled square `■`, accent color text
- Inactive: empty square `□`, secondary text
- Badge indicators: orange dot `●` for active processes, count `(3)` for pending reviews
- Separated from content by 1px `--border` rule
- Background: `--bg-primary`

### Status Bar (Bottom)

```
──────────────────────────────────────────────────
● SOPHIE / STATUS: EDITING · 472/1,847 · 23 FLAGGED · ETA 45M
──────────────────────────────────────────────────
```

- Full width, 32px height
- JetBrains Mono, 10px, uppercase, +3px tracking
- Status dot: 6px circle, color-coded:
  - `--accent` (orange): active / editing / learning
  - `--success` (green): idle / ready
  - `--warning` (orange): waiting for user input
- Separated by 1px `--border-strong` rule above

---

## SECTION 1: CHAT

The primary interaction surface. Everything the photographer needs can be done from here.

### Layout

```
┌──────────────────────────────────────────────────┐
│                                                   │
│  ┌─ SOPHIE ──────────── 14:35:22 ──────────────┐ │
│  │                                              │ │
│  │ I've got 1,847 images from the Tina & Jared  │ │
│  │ wedding. Mostly golden hour outdoor and      │ │
│  │ indoor reception.                            │ │
│  │                                              │ │
│  │ SCENARIOS DETECTED:                          │ │
│  │ GOLDEN_HOUR::OUTDOOR::PORTRAIT      ████  47 │ │
│  │ INDOOR::FLASH::RECEPTION            ███░  31 │ │
│  │ CEREMONY::INDOOR::NATURAL           ██░░  12 │ │
│  │                                              │ │
│  │ Want me to cull first, or go straight to     │ │
│  │ editing?                                     │ │
│  │                                              │ │
│  │ ┌──────────────┐  ┌──────────────┐          │ │
│  │ │ CULL FIRST   │  │ START EDIT   │          │ │
│  │ └──────────────┘  └──────────────┘          │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│                 ┌─ YOU ───── 14:36:01 ──────────┐ │
│                 │                                │ │
│                 │ Go straight to editing. Skip   │ │
│                 │ the ceremony shots for now.    │ │
│                 │                                │ │
│                 └────────────────────────────────┘ │
│                                                   │
│  ┌─ SOPHIE ──────────── 14:36:03 ──────────────┐ │
│  │                                              │ │
│  │ Got it. Starting with portraits and          │ │
│  │ reception. Ceremony shots untouched.         │ │
│  │ 1,412 images to process.                    │ │
│  │                                              │ │
│  │ ▶ SESSION STARTED                            │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ PROGRESS ─────────── 15:02:18 ─────────────┐ │
│  │ ████████████░░░░░░░░░░░░░░░░░  472/1,412    │ │
│  │ 33% · 23 FLAGGED · ETA 45M                   │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
├──────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ SEND  │
│ │ Type a message...                       │ >>>>  │
│ └────────────────────────────────────────┘       │
└──────────────────────────────────────────────────┘
```

### Message Types

**Sophie Message**

- 1px `--border` border, no radius, full-width minus 24px margin
- Header: `SOPHIE` left, timestamp right, JetBrains Mono 10px, `--text-secondary`
- Separated by hairline rule
- Body: Space Grotesk 14px, `--text-primary`
- Can contain: text, inline data tables, scenario bars, thumbnails, action buttons

**User Message**

- Same border treatment, right-aligned, narrower (60% width max)
- Header: `YOU` left, timestamp right
- No action buttons or data tables

**Progress Update**

- Compact card, no header
- Block progress bar using `████` characters or solid `--accent` fill
- Stats in JetBrains Mono 10px below
- Does not scroll with conversation — stacks at bottom of latest Sophie message

**Flag Card**

```
┌─ FLAGGED ────────────────────────────────────────┐
│ DSC_0847.NEF                                      │
│──────────────────────────────────────────────────│
│ [thumbnail ─────────────────────]                 │
│                                                   │
│ SCENARIO     CEREMONY::INDOOR::BACKLIT            │
│ CONFIDENCE   0.42 / LOW                           │
│ REASON       Heavy lens flare. Only 2 examples    │
│              in profile.                          │
│                                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ APPROVE  │ │  MANUAL  │ │   SKIP   │          │
│ └──────────┘ └──────────┘ └──────────┘          │
└──────────────────────────────────────────────────┘
```

- Orange-red left border (2px `--accent`)
- Spec-sheet layout for metadata (label : value, dot leaders)
- Thumbnail area: 16:9 ratio, 1px border
- Action buttons: 1px border, no radius, JetBrains Mono 11px uppercase

**Question Card**

- Same as Sophie message but with selectable option buttons
- Options are 1px-bordered rectangles, hover state adds `--accent` border
- Selected state: filled `--accent` background, white text

### Input Area

- Bottom-pinned, 1px `--border` top rule
- Input field: no visible border, JetBrains Mono 13px
- Placeholder: `TYPE A MESSAGE...` in `--text-muted`, uppercase
- Send button: `>>>>` chevron in `--accent`, or `SEND` in JetBrains Mono 10px
- 48px height

---

## SECTION 2: LEARN

What Sophie has learned and how she's learning.

### Layout

```
┌──────────────────────────────────────────────────┐
│ LEARNING STATUS                                   │
│──────────────────────────────────────────────────│
│                                                   │
│ CATALOG     ~/Pictures/Lightroom/MyCatalog.lrcat  │
│ INGESTED    2026-02-18T15:42:00                   │
│ ANALYZED    12,847                                 │
│ SCENARIOS   24                                    │
│                                                   │
│ ┌──────────────┐  ┌──────────────────────────┐   │
│ │ RE-INGEST    │  │ ● WATCH ME EDIT          │   │
│ └──────────────┘  └──────────────────────────┘   │
│                                                   │
│──────────────────────────────────────────────────│
│ SCENARIO COVERAGE                                 │
│──────────────────────────────────────────────────│
│                                                   │
│ GOLDEN_HOUR::OUTDOOR::PORTRAIT                    │
│ ████████████████████████████████████████  47      │
│ CONFIDENCE: HIGH                                  │
│                                                   │
│ INDOOR::FLASH::RECEPTION                          │
│ ████████████████████████████░░░░░░░░░░░  31      │
│ CONFIDENCE: GOOD                                  │
│                                                   │
│ NIGHT::OUTDOOR::MIXED::COUPLE                     │
│ ████████████████░░░░░░░░░░░░░░░░░░░░░░  12      │
│ CONFIDENCE: MODERATE                              │
│                                                   │
│ BLUE_HOUR::OUTDOOR::NATURAL::LANDSCAPE            │
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  4       │
│ CONFIDENCE: LOW                                   │
│                                                   │
│──────────────────────────────────────────────────│
│ RECENT ACTIVITY                                   │
│──────────────────────────────────────────────────│
│                                                   │
│ 2026-02-18  Watched 23 edits (reception)          │
│ 2026-02-17  Ingested 847 catalog edits            │
│ 2026-02-16  Profile updated from feedback         │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Elements

- **Spec-sheet layout** for catalog metadata (label : value pairs, dot leaders)
- **Scenario bars**: solid `--accent` blocks for filled, `--border` for empty
- **Confidence labels**: uppercase, monospaced, color-coded:
  - HIGH = `--success`
  - GOOD = `--text-primary`
  - MODERATE = `--warning`
  - LOW = `--text-muted`
- **Activity timeline**: date + description, monospaced date, natural-voice description
- **Action buttons**: 1px border, no radius, uppercase JetBrains Mono
- **Watch toggle**: dot indicator + label, click to toggle

---

## SECTION 3: EDIT

Active sessions and progress.

### During Active Session

```
┌──────────────────────────────────────────────────┐
│ SESSION: TINA & JARED WEDDING                     │
│ STARTED 14:35 · ETA 16:12                        │
│──────────────────────────────────────────────────│
│                                                   │
│ ████████████████████░░░░░░░░░  472 / 1,412       │
│ 33% COMPLETE · 23 FLAGGED · ~1H 37M REMAINING    │
│                                                   │
│──────────────────────────────────────────────────│
│ CURRENT                                           │
│──────────────────────────────────────────────────│
│                                                   │
│ FILE         DSC_0473.NEF                         │
│ SCENARIO     GOLDEN_HOUR::OUTDOOR::PORTRAIT       │
│ CONFIDENCE   0.92 / HIGH                          │
│ APPLIED      EXP +0.35 / TEMP +300K / SHD +38    │
│                                                   │
│──────────────────────────────────────────────────│
│ FLAGGED FOR REVIEW (23)                           │
│──────────────────────────────────────────────────│
│                                                   │
│ DSC_0847  CEREMONY::INDOOR::BACKLIT  CONF 0.42   │
│ ──── Backlit ceremony, heavy flare               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ APPROVE  │ │  MANUAL  │ │   SKIP   │          │
│ └──────────┘ └──────────┘ └──────────┘          │
│                                                   │
│ DSC_1204  RECEPTION::INDOOR::FLASH   CONF 0.38   │
│ ──── Dance floor, unusual color cast             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ APPROVE  │ │  MANUAL  │ │   SKIP   │          │
│ └──────────┘ └──────────┘ └──────────┘          │
│                                                   │
│──────────────────────────────────────────────────│
│ BREAKDOWN                                         │
│──────────────────────────────────────────────────│
│                                                   │
│ PORTRAITS     187 DONE ·  2 FLAGGED               │
│ RECEPTION     142 DONE · 14 FLAGGED               │
│ CEREMONY      SKIPPED (PER YOUR REQUEST)          │
│ DETAILS        98 DONE ·  3 FLAGGED               │
│ GROUPS         45 DONE ·  4 FLAGGED               │
│                                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│ │  PAUSE   │ │   STOP   │ │ SKIP TO FLAGGED  │  │
│ └──────────┘ └──────────┘ └──────────────────┘  │
└──────────────────────────────────────────────────┘
```

### No Active Session

```
┌──────────────────────────────────────────────────┐
│ NO ACTIVE SESSION                                 │
│──────────────────────────────────────────────────│
│                                                   │
│ Tell Sophie what to edit in Chat, or start        │
│ a session from your Lightroom catalog.            │
│                                                   │
│──────────────────────────────────────────────────│
│ RECENT SESSIONS                                   │
│──────────────────────────────────────────────────│
│                                                   │
│ 2026-02-18  Tina & Jared Wedding                  │
│             1,412 EDITED · 23 FLAGGED · 1H 42M   │
│             [ VIEW REPORT ]                       │
│                                                   │
│ 2026-02-15  Johnson Family Portraits              │
│             342 EDITED · 8 FLAGGED · 28M          │
│             [ VIEW REPORT ]                       │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## SECTION 4: DNA

The photographer's editing style, visualized.

```
┌──────────────────────────────────────────────────┐
│ YOUR EDITING DNA                                  │
│ 12,847 PHOTOS ANALYZED · 24 SCENARIOS             │
│──────────────────────────────────────────────────│
│                                                   │
│ SIGNATURE MOVES                                   │
│──────────────────────────────────────────────────│
│                                                   │
│ ● SHADOWS     +35 avg across all scenarios        │
│ ● TEMPERATURE +280K avg warmth bias               │
│ ● GRAIN       12-18 subtle texture always         │
│ ● GREEN SAT   -8 avg desaturation                 │
│                                                   │
│──────────────────────────────────────────────────│
│ GOLDEN_HOUR::OUTDOOR::PORTRAIT          47 SAMPLES│
│──────────────────────────────────────────────────│
│                                                   │
│ EXPOSURE    ─────────●──────────  +0.35 (±0.12)  │
│ TEMPERATURE ──────────●─────────  +300K (±45)    │
│ SHADOWS     ──────────●─────────  +38 (±8)       │
│ HIGHLIGHTS  ───●────────────────  -25 (±10)      │
│ VIBRANCE    ────────●───────────  +12 (±5)       │
│ GRAIN AMT   ──────●─────────────  15 (±3)        │
│                                                   │
│──────────────────────────────────────────────────│
│ SLIDER CORRELATIONS                               │
│──────────────────────────────────────────────────│
│                                                   │
│ SHADOWS ↑ + HIGHLIGHTS ↓      r = -0.82          │
│ SHADOWS ↑ + CLARITY ↑         r = 0.45           │
│ TEMPERATURE ↑ + VIBRANCE ↓    r = -0.31          │
│                                                   │
│──────────────────────────────────────────────────│
│                                                   │
│ ┌──────────────────┐                             │
│ │ EXPORT REPORT    │                             │
│ └──────────────────┘                             │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## IPC CHANNELS

| Channel            | Direction       | Purpose                           |
| ------------------ | --------------- | --------------------------------- |
| `sophie:message`   | main>>>renderer | Sophie sends a message to display |
| `user:message`     | renderer>>>main | User sends a message to Sophie    |
| `session:progress` | main>>>renderer | Real-time editing progress        |
| `session:flag`     | main>>>renderer | Image flagged for review          |
| `session:complete` | main>>>renderer | Session finished                  |
| `session:start`    | renderer>>>main | User starts editing session       |
| `session:control`  | renderer>>>main | Pause / stop / resume             |
| `learn:status`     | main>>>renderer | Learning status updates           |
| `learn:start`      | renderer>>>main | Trigger catalog ingestion         |
| `learn:observe`    | renderer>>>main | Toggle live observation           |
| `profile:data`     | main>>>renderer | Style profile data for DNA        |
| `flag:action`      | renderer>>>main | User action on flagged image      |

---

## FILE STRUCTURE

```
src/
  thelab/              # Backend engine (existing)
  app/
    main/
      main.ts          # Electron main process
      ipc-handlers.ts  # IPC channel handlers
      sophie-bridge.ts # Routes messages to backend modules
    renderer/
      index.html
      App.tsx
      components/
        Shell.tsx           # Header + nav + content + status bar
        NavRail.tsx
        StatusBar.tsx
        Header.tsx
        chat/
          ChatView.tsx
          SophieMessage.tsx
          UserMessage.tsx
          FlagCard.tsx
          ProgressCard.tsx
          QuestionCard.tsx
          InputBar.tsx
        learn/
          LearnView.tsx
          ScenarioCoverage.tsx
          ActivityTimeline.tsx
        edit/
          EditView.tsx
          SessionProgress.tsx
          FlaggedQueue.tsx
          SessionBreakdown.tsx
        dna/
          DNAView.tsx
          SignatureMoves.tsx
          ScenarioProfile.tsx
          CorrelationView.tsx
      hooks/
        useIPC.ts
        useSophie.ts
        useSession.ts
        useProfile.ts
      tokens/
        colors.ts      # Design token exports
        typography.ts
        spacing.ts
      styles/
        globals.css
```

---

_SOPHIE / THE LAB ® / DEPARTMENT OF VIBE_
_UI SPECIFICATION v0.2_
_DESIGN SYSTEM: AMERICAN INDUSTRIAL UTILITY_
_STATUS: ACTIVE_
