# Equity Partner Review #001

## The Lab — Architecture & Feature Review

**Date:** February 2026

---

## What We Asked

"Look over the project. What's missing? What features or pipelines should we add? Are we using the OpenClaw foundation correctly?"

---

## The Board's Verdict

### Dieter Rams — "You built two things. Pick one."

The Lab has two systems that don't talk to each other: a custom standalone editing engine AND a full OpenClaw agent framework sitting unused underneath it. This is the opposite of "less, but better." Either integrate with OpenClaw properly or strip it out entirely. Having both is complexity without purpose.

**His specific calls:**

- The `run.ts` CLI is primitive. OpenClaw already has a CLI. Use it.
- The custom `TheLabConfig` duplicates OpenClaw's config system. Unnecessary.
- The photographer doesn't need to know OpenClaw exists. The integration should be invisible.

### Virgil Abloh — "Where's the culture?"

The Lab is technically interesting but culturally invisible. There's no story in the object. A photographer can't show this to anyone — there's no UI, no visual identity, no shareable moment. The 17-year-old photographer scrolling Instagram will never know this exists.

**His specific calls:**

- Need a visual interface — even minimal. The macOS app shell already exists in OpenClaw.
- Need a "share your editing DNA" feature — let photographers see their style profile as something visual and shareable.
- The scenario taxonomy (golden_hour::outdoor::natural_bright::portrait) is powerful but invisible. Surface it.

### Brian Chesky — "What's the 11-star version?"

5-star: The Lab edits your photos overnight. 6-star: It sends you progress via iMessage. 7-star: You wake up and see a visual summary of what it did. 8-star: It learned from your last 5 sessions and got noticeably better. 9-star: It flags the 3 images that need your creative eye and explains why. 10-star: Your second shooter's photos get edited in YOUR style automatically.

**His specific calls:**

- iMessage notifications are in the spec but not wired up. OpenClaw has a working iMessage channel. Connect it.
- No session summary or review flow exists. The photographer wakes up to... nothing visible.
- The flagged image review queue is critical UX. Build it.

### Steve Jobs — "You're not controlling the whole widget."

The Lab sits inside OpenClaw but doesn't use OpenClaw. That's the worst of both worlds — you have the dependency without the benefit. Either go vertical (use OpenClaw's agent system, sessions, messaging, macOS app) or go independent (rip it out, ship a standalone binary).

**His specific calls:**

- Use PeekabooBridge instead of raw CLI calls — it's already built and integrated with the macOS app.
- Use OpenClaw's session system — it handles crash recovery, archival, and streaming.
- The editing loop should be an OpenClaw agent run, not a custom while-loop.

### George Eastman — "The photographer still needs to be a developer."

Right now, using The Lab requires: cloning a repo, running `npx tsx`, passing CLI flags, knowing file paths. This is the opposite of "you press the button, we do the rest." The entire learning pipeline (catalog ingestion, profile building) should be one button.

**His specific calls:**

- One-command setup: point at your Lightroom catalog, done.
- The ingest pipeline should auto-discover the catalog location.
- The macOS menubar app should be the only interface a photographer ever sees.

### Fujifilm — "The color science layer is missing."

The style profiles store statistical distributions of slider values, but there's no coherence check. A photographer's "golden hour style" isn't just individual slider positions — it's how those sliders work together. Exposure + white balance + tone curve form a unified look. The current system treats them as independent variables.

**His specific calls:**

- Add correlation tracking between sliders (e.g., when this photographer lifts shadows, they also reduce highlights by X).
- The profile should store adjustment SEQUENCES, not just final positions.
- Add a "style coherence score" — does this set of adjustments look like a unified edit or random noise?

### David Ogilvy — "What's the headline?"

"AI photo editor that learns your style" — that's the headline. But can we prove it? Where's the before/after? Where's the metric that shows it actually matches the photographer's edits? Without proof, this is a claim, not a product.

**His specific calls:**

- Build a validation pipeline: take 50 photos the photographer already edited, run The Lab on the originals, compare results to the photographer's actual edits. Report accuracy.
- That accuracy number IS the marketing. "92% match to your personal editing style."

### Sam Parr — "Would you click this?"

"AI agent that clones your Lightroom editing style and edits 2,000 wedding photos while you sleep." Yes. That's clickable. But the product can't deliver on that promise yet because there's no way to actually USE it without being a developer.

**His specific calls:**

- The demo needs to be visual. Screen recording of The Lab editing in Lightroom autonomously.
- Ship the one-click experience before adding features.

### Oren John — "Where's the content engine?"

The style profile visualization ("your editing DNA") is a content goldmine. Photographers love seeing data about their own work. "Here's how you edit golden hour vs indoor reception" — that's shareable content that markets itself.

**His specific calls:**

- Build a profile visualization/export — the photographer's editing DNA as a visual.
- The scenario breakdown is inherently interesting content.

### Michael Lewis — "Who's the character?"

The story isn't "AI edits photos." The story is: a wedding photographer shot 2,000 frames on Saturday, and by Monday morning, The Lab had edited 1,700 of them in their exact style. The 300 it flagged were the creative challenges — the ones that actually needed the photographer's eye. The AI knew which ones to hand back.

**His specific calls:**

- The flagging system is the narrative hook. The AI that knows what it doesn't know.
- Track and surface the "saved hours" metric. That's the story.

---

## Consolidated Action Items

### Must Build (Integration)

1. **Wire iMessage notifications** — OpenClaw has a working iMessage channel. Connect the editing loop's progress callbacks to it.
2. **Auto-discover Lightroom catalog** — Find the .lrcat file automatically instead of requiring a path.
3. **Update run.ts for new architecture** — The CLI still references film stocks as primary. Update for learned profiles.
4. **Validation pipeline** — Compare The Lab's output to the photographer's actual edits. Report accuracy %.

### Should Build (Features)

5. **Style profile visualization** — Export the photographer's editing DNA as a readable summary.
6. **Session summary report** — When a session completes, generate a human-readable report (images edited, scenarios used, flagged images, time saved).
7. **Slider correlation tracking** — Track how sliders move together, not just independently.

---

_Review conducted by the Department of Vibe Equity Partner Board. Next review after implementation._
