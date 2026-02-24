---
name: golden-hour-photography
description: "Sophie's domain knowledge for golden hour and blue hour editing. Covers warm directional light, magic hour, and twilight scenarios."
triggers:
  scenarios:
    - golden_flare
  timeOfDay:
    - golden_hour
    - blue_hour
  keywords:
    - golden hour
    - magic hour
    - sunset
    - sunrise
    - blue hour
    - twilight
---

# Golden Hour Photography

## Overview

Golden hour is when photographers get their signature shots. The warm directional light creates natural drama, beautiful skin tones, and long shadows. Editing golden hour photos is about enhancing what the light already provides — not fighting it. Blue hour (just after golden hour) demands a completely different approach: cool tones, subtle exposure, and moody atmosphere.

## Key Principles

### Golden Hour: Enhance the Warmth

- The warm light is the whole point — don't cool it down
- Shadows are already warm-toned and soft
- Highlights are rich orange/gold
- The photographer probably metered for the subject, not the sky

### Blue Hour: Embrace the Cool

- Blue hour is the opposite — cool, quiet, ethereal
- Don't add warmth; the blue tone is intentional
- Lower contrast, softer look
- Often slightly underexposed by choice

### The Sky Is Part of the Edit

- Golden hour skies are dramatic — don't blow them out
- Recover highlights if needed to preserve cloud/sky detail
- Blue hour skies are gradients — preserve the subtle color transition

## Golden Hour Editing

### Classic Warm

- Temperature +200-800K (enhance existing warmth)
- Shadows lifted slightly (they're already soft)
- Highlights pulled to preserve sky
- Vibrance +5 to +15 (not saturation — protects skin)

### Film Look

- Same warmth but with faded blacks
- Grain, reduced contrast
- Muted highlights
- Green-shifted shadows (classic film)

### Bold/Punchy

- Strong contrast with the warm light
- Deep shadows, bright highlights
- Increased clarity
- Selective saturation in oranges/yellows

## Blue Hour Editing

### Cool and Clean

- Keep or slightly enhance cool temperature
- Open shadows for detail
- Low contrast, soft look
- Minimal color grading — the natural gradient is enough

### Moody Twilight

- Deepen the blues and purples
- Crush shadows slightly
- Add vignette
- Reduce highlights for drama

## Common Pitfalls

- Mixing golden hour and blue hour edits (they need opposite white balance)
- Over-recovering highlights until the sky goes grey (preserve the golden sky)
- Adding too much vibrance (golden light + vibrance = neon skin)
- Treating all golden hour shots the same (shade vs direct light vs backlit all differ)
- Cooling down golden hour shots to "correct" white balance

## Sophie Guidance

- For golden_hour time classification, temperature adjustments should trend warm (match photographer profile, never cool)
- If the photographer has separate profiles for golden_hour outdoor vs golden_hour backlit, prefer the more specific one
- Blue hour photos: if profile shows warm tendencies globally, reduce warmth by 30% for blue_hour specifically
- Golden hour group shots need less dramatic editing than golden hour portraits — wider DOF changes the mood
- Flag golden hour photos where auto WB produced a cool reading (likely a metering error worth reviewing)
