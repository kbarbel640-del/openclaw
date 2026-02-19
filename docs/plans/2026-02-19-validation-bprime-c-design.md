# Validation v0 — A → B’ → C

## Sophie / The Lab ® / Department of Vibe

### STATUS: APPROVED / 2026-02-19

---

## 0. Purpose

Ship proof that Sophie is an editing clone, not a preset:

- **Headline metric:** PASS RATE (per-image)
- **Proof metric:** SLIDER MATCH (per-slider, weighted)

Validation must exercise the **local vision path** and match the real agent loop:

- **Primary input:** Lightroom Develop **screen capture**
- **Fallback input:** Lightroom **preview/smart preview**
- **Fail-closed:** if we can't see pixels, we do not guess; we flag

This milestone is explicitly optimized for:

- Ogilvy: a claim with evidence ("92% match")
- Lewis: a story with character ("Sophie knew which frames needed you")
- Eastman: "press button, we do rest" (one command / one button)

---

## 1. Scope

### In Scope (v0)

- **A:** Coverage + coherence checks (fast, always-on)
- **B’:** Vision-informed prediction vs ground truth (no Lightroom writes)
- **C:** End-to-end Lightroom replay validation (advanced proof)
- Reports:
  - Markdown report saved to workspace (shareable)
  - Canvas "Accuracy Sheet" (screenshot-able)
  - Flag/outlier queue
- Trend + persistence:
  - store validation runs as JSONL
  - store summary to memory (MEMORY.md + daily log)

### Out of Scope (v0)

- Perceptual image similarity scoring (SSIM/LPIPS) as the headline
- Identity-altering edits (non-negotiable constraint)
- Masking, Photoshop retouching, content-aware/generative tools
- Full Electron UI implementation (we can still output canvas artifacts)

---

## 2. Definitions

### A) Coverage + Coherence

"Do we have enough examples per scenario, and is the learned style internally consistent?"

Outputs:

- scenario coverage counts
- variance flags (where photographer is inconsistent)
- correlation sanity (already supported in style DB)

### B’) Vision Prediction (No Writes)

"Given the pixels (screen capture) + learned profiles, what would Sophie do?"

Compare against:

- ground truth develop settings from `.lrcat`

### C) Lightroom Replay (Writes + Verify)

"Can Sophie reproduce the look end-to-end inside Lightroom?"

Compare against:

- ground truth develop settings from `.lrcat`
- plus verification capture (did we actually land where we intended)

---

## 3. Canonical Image Input Resolver

All vision steps must use a single resolver contract:

### Contract: `resolveVisionInput(photoRef) -> VisionInput`

Preferred:

1. **Screen Capture (Primary)**
   - Ensure Lightroom is frontmost
   - Ensure Develop module
   - Standardize zoom/crop rules (see below)
   - Capture via Peekaboo as a clean image (not annotated)

Fallback: 2. **Lightroom Preview / Smart Preview**

- Extract best available preview for that photo
- Must include enough resolution for color/tone reasoning

Fail-closed: 3. If neither is available:

- mark image as `flagged: cannot_resolve_pixels`
- do not attempt prediction/replay

### Screen Capture Normalization Rules (v0)

We need consistency more than perfection.

- Target: Lightroom Develop main image region (exclude side panels if possible)
- Fixed zoom: "Fit" (or a stable zoom level)
- Avoid UI overlays (histogram hover, clipping indicators if they alter pixels)
- Capture twice if needed (first capture stabilizes UI, second capture used)

If we cannot reliably crop to the image region in v0:

- accept full-window capture
- have vision model instructed to focus on the photo area

---

## 4. Ground Truth Source

Ground truth comes from Lightroom catalog ingestion:

- For each already-edited photo:
  - develop settings (sliders we claim to control)
  - EXIF (scenario classification)
  - scenario key

We do not require RAW/JPEG exports to compute the v0 headline.

---

## 5. Controlled Slider Set (v0)

Validation only scores sliders that are:

- within Identity Lock constraints
- present in our learned profile schema
- reliably readable from `.lrcat`
- reliably applicable in Lightroom automation (for C)

Initial controlled set (proposed):

- Exposure, Contrast
- Highlights, Shadows, Whites, Blacks
- Temp, Tint
- Texture, Clarity, Dehaze
- Vibrance, Saturation
- Grain Amount (optional), Vignette (optional)

Note: exact names must match what `style-db` stores and what the Lightroom controller can apply.

---

## 6. Metrics

### 6.1 Slider Match Score (proof metric)

For each image:

For each slider `s` in controlled set:

- `delta = abs(predicted[s] - truth[s])`
- `tolerance_s` is slider-specific
- `score_s = clamp(1 - delta / tolerance_s, 0..1)`

Weighted aggregate:

- `SLIDER_MATCH = sum(score_s * weight_s) / sum(weight_s)`

We compute:

- per-image SLIDER_MATCH
- per-scenario mean/median SLIDER_MATCH
- overall mean/median SLIDER_MATCH

### 6.2 Image Pass Rate (headline metric)

An image is a PASS if:

- `SLIDER_MATCH >= PASS_THRESHOLD` AND
- no hard-fail conditions occurred (capture failed, verify failed, etc.)

Headline:

- `PASS_RATE = passed_images / total_images`

### 6.3 Hard-Fail Conditions

Hard-fail immediately marks image as FAIL and flags it for review:

- Cannot resolve pixels (screen + preview both failed)
- Vision analyze returns empty/null or invalid format
- Identity Lock constraint triggered (vision suggests face/body/geometry edits)
- In C: Lightroom automation failed to apply, or verify step indicates mismatch

---

## 7. Initial Tolerances + Weights (v0 defaults)

These defaults are intended to be conservative and tuned via early runs.

### Suggested tolerances

- Exposure: 0.10
- Temp: 150K
- Tint: 5
- Highlights/Shadows/Whites/Blacks: 8
- Contrast: 8
- Texture/Clarity/Dehaze: 5
- Vibrance/Saturation: 6
- Grain amount: 5
- Vignette: 6

### Suggested weights

Primary (highest weight):

- Exposure, Temp, Tint, Highlights, Shadows

Secondary:

- Whites, Blacks, Contrast, Vibrance

Tertiary (lowest weight):

- Clarity, Texture, Dehaze, Saturation, Grain, Vignette

Rationale:

- These reflect the editor workflow: exposure/WB/tone first; effects last.

### PASS_THRESHOLD

Default: `PASS if SLIDER_MATCH >= 0.90`

We will also report alternative pass rates at:

- 0.85 (lenient)
- 0.95 (strict)

---

## 8. Sampling Strategy

We must avoid "all golden hour portraits" bias.

Sampling modes:

- `stratified_by_scenario` (default): max N per scenario (e.g., 10) across top scenarios
- `random` (for quick sanity)
- `scenario_filter` (for debugging weak areas)

Default v0 run:

- `n = 50` images, stratified

---

## 9. Pipelines

### A) Coverage + Coherence (fast)

Inputs:

- style DB profiles + scenario counts

Outputs:

- scenario coverage table
- variance warnings ("indoor flash reception high variance")
- correlation highlights

### B’) Vision Prediction (no writes)

For each sampled photo:

1. Read ground truth develop settings from `.lrcat`
2. Classify scenario (EXIF + taxonomy)
3. Resolve vision input (screen → preview fallback)
4. Vision analyze -> predicted adjustments
5. Score against ground truth
6. If score low: create outlier entry (flag card)

### C) Lightroom Replay (advanced)

For each test photo:

1. Navigate to photo
2. Reset develop to baseline
3. Resolve vision input (screen capture expected)
4. Vision analyze -> predicted adjustments
5. Apply adjustments via UI automation
6. Re-capture screen
7. Vision verify -> applied? coherent?
8. Compare predicted vs ground truth
9. Log result + flag if needed

---

## 10. OpenClaw Integration (Required)

OpenClaw provides the operating system for the creative agent.

### Sessions

- Each validation run is a durable session with transcript + compaction.
- Use hooks to persist state snapshots pre-compaction.

### Memory

- Write run summaries to `MEMORY.md`
- Append per-run details to `memory/YYYY-MM-DD.md`
- Ensure outliers include "why" for later learning.

### Sub-agents

- B’ can be parallelized by scenario partitions.
- Main session stays responsive and receives completion announcements.

### Canvas

- Present "Accuracy Sheet" and "Outlier Queue" as a dashboard.
- Primary marketing artifact is a screenshot of this canvas.

### Cron

- Nightly validation runs (trend)
- Weekly "Accuracy + DNA" report generation

### Channels

- On completion: send a concise wake-up message:
  - PASS_RATE, median SLIDER_MATCH
  - number of outliers flagged
  - top weak scenarios

### Observability

- Record tool durations, error rates, and capture failure frequency.

---

## 11. Reports (v0)

### Markdown Report

Sections:

- Header: catalog, run timestamp, sample size, mode (B’ or C)
- Headline metrics:
  - PASS_RATE (0.90 threshold)
  - median SLIDER_MATCH
- Scenario breakdown:
  - top scenarios by sample count
  - pass rate per scenario
- Outliers:
  - top 10 worst match images (with reason codes)
- Next actions:
  - "Need more samples for X"
  - "Increase tolerance for Y" (only after review)

### Canvas "Accuracy Sheet"

Minimal, dense, spec-sheet layout:

- PASS_RATE
- SLIDER_MATCH median
- capture success rate
- top weak scenarios
- outlier count + "view outliers"

---

## 12. Safety / Constraints

- Identity Lock is enforced:
  - no face/body/geometry retouch suggestions
  - validation should flag if vision output implies identity changes
- Local-first:
  - no uploads
  - no telemetry on image content
- Fail closed:
  - if we cannot see pixels, we flag and stop, not guess

---

## 13. Test Plan (v0)

- Run B’ on `n=10` first (fast sanity)
- Run B’ on `n=50` stratified (first real metric)
- Run C on `n=10` (verify automation loop reliability)
- Confirm:
  - reports generate
  - outliers are meaningful
  - capture fallback works
  - metrics are stable and not wildly scenario-biased

---

## 14. Implementation Notes (Not Code Yet)

We implement in this order:

1. A (report + canvas)
2. B’ (screen capture + scoring + outliers)
3. C (replay + verify + reliability metrics)

This document is the spec for the next implementation plan.
