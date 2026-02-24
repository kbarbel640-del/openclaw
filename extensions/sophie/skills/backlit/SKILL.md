---
name: backlit-photography
description: "Sophie's domain knowledge for editing backlit photos. Covers rim light, silhouettes, sun flare, and contre-jour techniques."
triggers:
  scenarios:
    - backlit
    - silhouette
    - lens_flare
    - golden_flare
  lighting:
    - backlit
  keywords:
    - backlit
    - rim light
    - silhouette
    - sun flare
---

# Backlit Photography

## Overview

Backlit photos are among the most intentional in any photographer's portfolio. The photographer chose to shoot into the light — every editing decision should respect that choice. The key tension: preserve the drama of backlighting while maintaining enough shadow detail to see the subject.

## Key Principles

### The Photographer Chose This Light

- Backlighting is never accidental at a professional level
- Don't "fix" the exposure to make it look front-lit
- The haze, glow, and reduced contrast are the point

### Shadow Detail Is a Spectrum

- Full silhouette: subject is a dark shape — don't lift shadows
- Rim light: edge glow with moderate face detail — lift shadows gently
- Sun flare: hazy glow with the subject visible — moderate shadow lift
- The photographer's profile tells you which end of the spectrum they prefer

### Preserve the Glow

- Backlit shots have a natural warm haze
- Dehaze should be used sparingly or not at all
- Clarity can sharpen rim light but kills the glow

## Editing Approaches

### Silhouette

- Minimal shadow lift (or even crush)
- High contrast
- Preserve dramatic sky/background
- Subject shape is everything

### Romantic Rim Light

- Moderate shadow lift (+15 to +40)
- Reduced contrast (-10 to -20)
- Warm white balance shift
- Slightly lifted blacks for airy feel

### Sun Flare / Lens Flare

- Accept flare artifacts — they're the vibe
- Don't add dehaze (kills flare)
- Warm temp, reduced highlights
- Grain adds to the dreamy quality

## Common Pitfalls

- Applying dehaze to a backlit photo (destroys the atmosphere)
- Lifting shadows so much the backlit look disappears (looks like bad front light)
- Adding clarity to lens flare shots (sharpens flare artifacts unnaturally)
- "Correcting" the warm color cast (it's from the sun — it's supposed to be warm)
- Applying the same backlit edit to silhouettes AND rim-light photos

## Sophie Guidance

- If VLM classifies as `backlit` lighting, reduce dehaze confidence by 50% and cap at the profile's value
- For silhouette specials: do NOT lift shadows beyond the profile's learned value, even if the image looks dark
- When `lens_flare` or `golden_flare` special is detected, skip clarity adjustments entirely
- Backlit portraits should use the photographer's portrait profile for skin controls, but the backlit profile for contrast/shadows
- Flag any backlit photo where the learned profile has < 5 samples — backlit editing is highly personal
