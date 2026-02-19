# Research: Professional Photo Editor in the Photography Industry

_Structured findings for designing Sophie — a photographer's personal AI editor_

---

## 1. What a Photo Editor's Job Actually Is

### Wedding & Portrait Photography Context

A **photo editor** is the person who sits at the computer and processes photos _after_ the shoot. They are distinct from the photographer, who captures images on-site.

**Core responsibilities:**

- **Select** which photos to keep and which to reject (culling)
- **Edit** images using Adobe Lightroom and/or Photoshop: color balance, exposure, contrast, white balance, color grading
- **Retouch** when needed: skin blemishes, stray hair, lens glare, unwanted objects, whitening eyes/teeth
- **Convert** selected images to black and white when appropriate
- **Crop** for improved composition
- **Ensure consistency** across the entire gallery so the set feels cohesive
- **Deliver** final images in the correct format, resolution, and specifications
- **Communicate** with the photographer about creative decisions, ambiguous cases, and flagged images

**What editors do NOT typically do:**

- Shoot the photos
- Make final creative decisions about which images represent the photographer's brand (that's collaborative)
- Manage client relationships (photographer's domain)
- Set pricing or business strategy

### Editorial Photography Context (Magazines, Publications)

In editorial settings, "photo editor" can mean a different role:

- **Image selection and research** for articles; sourcing from agencies, archives, stock
- **Photo production** — conceiving shoots, hiring photographers, creative direction
- **Technical editing** — color correction, optimization, compositing, batch processing
- **Licensing and rights** — contracts, credits, metadata

For Sophie's design, the **wedding/portrait outsourced editor** role is the primary reference, not the magazine photo editor role.

---

## 2. The Editor's Workflow — Step by Step

### Phase 1: Ingestion & Organization

- Transfer files from memory cards
- Back up originals (redundant storage)
- Apply metadata: keywords, ratings, basic organizational structure
- Verify file integrity

### Phase 2: Culling (Selecting Which Photos to Keep)

**Iterative culling** is the recommended approach:

- **First pass:** Quickly eliminate obviously bad images — out of focus, closed eyes, cut-off subjects, technical failures
- **Subsequent passes:** Progressively narrow to the best shots
- **Ratio:** Typically ~7:1 (e.g., 3,500 shot → 500 delivered)

**Culling criteria:**

- Sharpness / focus
- Expression (open eyes, genuine emotion)
- Composition
- Lighting quality
- Story impact — does it advance the narrative?
- Avoid duplicates; pick the best of similar shots

**Output:** A trimmed set of images flagged for editing (Pick/Flag in Lightroom)

### Phase 3: Routing Images Into Editing Buckets

Professional editors don't treat every image the same:

- **Bucket A (Hero images):** High-level editing, hand retouching in Photoshop — portraits, key moments, album picks
- **Bucket B:** Targeted fixes — glare removal, photobomb removal, object removal — often AI-assisted
- **Bucket C:** Bulk editing — 70–90% of images; global adjustments, batch presets, consistent color/exposure

### Phase 4: Color Grading & Development

**Primary color grading** (must come first):

- Normalize exposure, white balance, color cast
- Aim for a neutral, consistent baseline
- Use exposure and color calibration modules

**Secondary color grading** (after primary is stable):

- Apply artistic expression — color balance, creative looks
- Ensures consistency when batch editing

**Before touching sliders:** Diagnose the image:

- Lighting (white balance, soft vs harsh, source)
- Composition (horizon, subject isolation, clutter)
- Subject (expression, skin tone, color casts)
- Mood & story (match edit to intent)

### Phase 5: Flagging Images Needing Special Attention

- Use **Lightroom Flag/Pick** (P key) to mark images requiring retouching
- **Hero images** get detailed attention
- **Notes** for photographer: "Needs heavy retouching," "Creative decision — B&W?" "Unusual lighting — please confirm direction"
- Editors don't silently guess on ambiguous cases; they flag for discussion when the call is unclear

### Phase 6: Retouching (Where Applicable)

- **Portraits/close-ups:** Blemishes, skin smoothing (with natural texture), under-eye circles, whitening
- **White dresses:** Ensure white (not gray) via exposure
- **Backgrounds:** Remove distractions, clutter
- **Lighting fixes:** Harsh shadows, poor conditions
- **Tool split:** Lightroom for color/crop; Photoshop for healing brush, object removal, advanced retouching

### Phase 7: Consistency Check

- Scroll through gallery as a whole
- Ensure skin tones match across images
- Greens, blues, overall temperature should feel cohesive
- No single image that "pops" in the wrong direction

### Phase 8: Communication with Photographer

- Deliver edited set
- Include notes on flagged images
- Respond to revision requests
- Iterate until photographer approves

### Phase 9: Export & Delivery

**Standard export specs:**

- Format: JPEG
- Quality: 85 (Lightroom) or 9 (Photoshop), or 75–80% compression
- Color space: sRGB
- Resolution: As specified (e.g., full resolution; some galleries use ~2100px long side at 300 PPI for prints)
- Metadata: Include all (don't strip EXIF)
- File naming: Per photographer's convention

---

## 3. How Editors Learn a Photographer's Style

### Human Editor Onboarding (e.g., ShootDotEdit, Photographer's Edit)

1. **Personal stylist / consultant** works one-on-one with the photographer
2. **Style development:** Guide photographer toward a coherent editing style that fits their brand
3. **Reference material:**
   - Before/after examples from past work
   - Lightroom presets
   - Sample galleries that represent "the look"
4. **Unlimited feedback loop:** Early batches get detailed revision notes; editor refines until consistent
5. **Documentation:** Implicit or explicit notes on greens, skin tones, temperature, exposure (light/airy vs dark/moody)

### AI Profile Training (Imagen, Aftershoot)

**Imagen AI:**

- **Minimum:** 2,000 edited photos (more = better)
- **Consistency required:** 90%+ same tone curve, color grading, camera calibration
- **Same camera profile** across photos (e.g., Adobe Color)
- **Diverse conditions:** Daylight, indoor, artificial, seasonal
- **Training time:** Up to 24 hours
- **What it learns:** Exposure, white balance, contrast, tone curves, HSL, saturation — not masking or custom tools
- **Refinement:** Upload final edits back; profile evolves over time

**Aftershoot Edits:**

- **Training:** 2,500+ edited images; 5,000+ recommended for optimal accuracy
- **Profiles:** Up to 5 different AI profiles per user
- **Source:** Lightroom or Capture One catalogs

### Core Style Elements Editors Must Learn

| Element          | Variations                                            |
| ---------------- | ----------------------------------------------------- |
| Greens           | Minty, yellow, desaturated, bold                      |
| Skin tones       | Pink, peach, yellow, neutral                          |
| Temperature/Tint | Warm vs cool                                          |
| Exposure/Style   | Light & airy, dark & moody, bold & saturated, natural |
| Contrast         | High editorial vs soft/flat                           |
| Black & white    | When to convert, toning style                         |

### Learning Curve

- **Human editors:** Several batches (e.g., 2–4 weddings) with feedback before consistency is achieved
- **AI profiles:** 24 hours training + 1–2 test batches to validate
- **Ongoing:** Style evolves; both human and AI need periodic recalibration

---

## 4. The Editor–Photographer Relationship

### Communication Patterns

- **Before work:** Agree on deliverables, revision process, turnaround times, style expectations
- **During work:** Flags, notes on ambiguous images, questions when creative direction is unclear
- **After delivery:** Revisions, praise, course-correction for future batches

### Feedback Loop

- Photographer sends RAW (or minimally edited) set
- Editor delivers edited gallery + notes on flagged images
- Photographer reviews, requests changes
- Editor revises
- Iterate until approval

### When to Ask vs. When to Decide

**Ask the photographer when:**

- Creative direction is ambiguous (e.g., B&W vs color for a specific image)
- Unusual lighting or scene with multiple valid interpretations
- Client-specific preferences the editor wouldn't know
- First few batches with a new photographer (building trust and understanding)
- Major stylistic deviation from established look

**Make the call when:**

- Clear technical fixes (exposure, white balance, crop)
- Consistency with established style
- Obvious quality issues (blur, closed eyes — exclude)
- Routine retouching within agreed parameters
- High volume of similar images where pattern is clear

### Building Trust

- Long-term collaboration improves outcomes — editors learn nuances over time
- Honest, specific feedback (not ego-boosting) is valued
- Context from photographer (time of day, venue, client preferences) helps editor make better decisions

---

## 5. Common Editing Services and Companies

### Human Editing Services

| Service                 | Model                            | Key Features                                                                                                                            | Pricing/Turnaround                                                     |
| ----------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **ShootDotEdit**        | Personal stylist + human editors | Built by wedding photographers (since 2007); Lightroom-based; learns your style; 48hr delivery; ~700 images/wedding; unlimited feedback | Subscription plans                                                     |
| **Photographer's Edit** | Per-image outsourcing            | Custom color correction; culling + color; retouching tiers; no contracts/minimums                                                       | ~$0.22–0.24/image color; $0.14 culling+color; $1+ retouching; 3–5 days |
| **FixThePhoto**         | Per-image outsourcing            | Wedding, portrait, product, real estate; since 2003                                                                                     | $0.25+ wedding; $6 portrait; 2 days std                                |
| **Weedit.photos**       | Per-image outsourcing            | 24hr turnaround; 30k+ photos/day                                                                                                        | ~$0.25/image; 24hr                                                     |

### AI Editing Services

| Service                | Model                             | Key Features                                                                                                                                      | Learning                                                 |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Imagen AI**          | AI learns your style              | 0.5 sec/image; learns from 2000+ edited photos; Talent AI profiles if you lack volume; crop, straighten, masking, sky replace, denoise            | Personal AI Profile from past edits; up to 24hr training |
| **Aftershoot**         | AI culling + editing + retouching | Culling (sharpness, composition, expressions); editing with personal or marketplace AI styles; retouching (blemishes, stray hair, glare, objects) | 2500+ images for profile; 5000+ recommended              |
| **Aftershoot Culling** | Standalone culling                | Reduces 3–4hr culling to ~30 min; groups duplicates; ranks by quality                                                                             | Learns over time with use                                |

### Key Differentiators

- **Human:** Personalized, handles edge cases, builds relationship; higher cost, slower
- **AI:** Fast, scalable, consistent; requires training data; may miss nuance
- **Hybrid:** Many photographers use AI for bulk, human for hero images and revisions

---

## 6. What Makes a GREAT Editor vs. a Mediocre One

### Great Editors

| Trait                    | Manifestation                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Ruthless culling**     | Delivers only the strongest images; eliminates duplicates and technically flawed shots decisively |
| **Consistent style**     | Gallery feels cohesive; skin tones, greens, exposure match across images                          |
| **Intentional workflow** | Diagnoses before editing; routes into buckets (hero vs bulk); doesn't hand-retouch everything     |
| **Understands vision**   | Edits serve the story; matches mood to photographer's brand                                       |
| **Communicates clearly** | Flags uncertainties; asks when needed; documents style over time                                  |
| **Efficiency**           | Repeatable systems; batch processing; uses presets/AI appropriately                               |
| **Craft mindset**        | Treats editing as "a detailed process" with intentional decisions, not random slider-tweaking     |

### Mediocre Editors

- Treat editing as applying filters or making ad-hoc adjustments
- Inconsistent color/exposure across gallery
- Either over-edit (retouch everything) or under-edit (miss obvious fixes)
- Don't flag uncertainties — guess and hope
- Slow, non-systematic workflow
- Deliver too many images (weak culling) or too few (over-cull)

### Summary

> _"Mediocre editors treat wedding editing as applying filters or making random adjustments; great editors recognize it as a craft — a detailed process requiring intentional decision-making at every stage."_

---

## 7. Editing Profiles and Style Guides

### What They Capture

An **editing profile** or **style guide** documents:

- **Color palette & saturation** — Core colors, vibrancy
- **Skin tones** — Pink, peach, yellow, neutral
- **Greens** — Minty, yellow, desaturated, bold
- **Temperature/tint** — Warm vs cool
- **Exposure/style** — Light & airy, dark & moody, bold, natural
- **Contrast & clarity** — High vs soft
- **Black & white** — When and how
- **Retouching level** — Minimal, moderate, heavy
- **File specs** — Format, resolution, naming

### How Services Implement Them

- **ShootDotEdit:** Personal stylist consultation; implicit style in editor's head + Lightroom settings
- **Photographer's Edit:** Before/after examples + presets shared at onboarding
- **Imagen/Aftershoot:** Trained from thousands of edited images; learns numerical adjustments (curves, HSL, etc.)
- **Style guides (brand):** Written documents for in-house teams; bullet points on do's and don'ts

### Why Consistency Matters

- Brand recognition — clients know what to expect
- Trust — "your photos will look like your portfolio"
- Revenue — consistent branding can increase revenue ~20%
- Efficiency — less back-and-forth, fewer revisions

---

## Design Implications for Sophie (AI Photo Editor Agent)

### Sophie Should:

1. **Mirror the workflow** — Culling → routing → color grading → flagging → delivery
2. **Learn style** — Via reference galleries, presets, or edited examples (like Imagen/Aftershoot profiles)
3. **Flag uncertainty** — When creative direction is ambiguous, ask rather than guess
4. **Communicate** — Provide notes on flagged images; explain reasoning when helpful
5. **Be consistent** — Apply style uniformly; treat primary then secondary grading
6. **Know when to ask vs decide** — Heuristic: technical/obvious → decide; creative/ambiguous → ask
7. **Support iteration** — Accept feedback, refine style over time
8. **Deliver in standard specs** — JPEG, sRGB, appropriate resolution, metadata preserved

### Sophie Should Avoid:

- Treating every image identically (ignore hero vs bulk distinction)
- Guessing on ambiguous creative choices without flagging
- Applying one-size-fits-all presets without learning photographer's style
- Skipping the "read the image first" diagnostic step
- Over-retouching or under-retouching without guidance

---

_Research compiled for Sophie AI agent design. Sources: industry job descriptions, ShootDotEdit, Imagen AI, Aftershoot, Photographer's Edit, FixThePhoto, workflow guides, and editorial photography roles._
