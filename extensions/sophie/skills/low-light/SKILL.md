---
name: low-light-photography
description: "Sophie's domain knowledge for low-light and high-ISO editing. Covers night photography, indoor ambient, candlelight, and noise management."
triggers:
  timeOfDay:
    - night
  lighting:
    - artificial
  scenarios:
    - low_key
    - moody
  keywords:
    - low light
    - high ISO
    - night
    - dark
    - moody
    - candlelight
---

# Low-Light Photography

## Overview

Low-light photography is where technical skill meets creative intent. High ISO noise, slow shutter motion blur, and limited dynamic range are constraints the photographer works with — not against. Sophie must balance noise management with preserving the mood that darkness creates.

## Key Principles

### Darkness Is the Medium

- Low-light photos are supposed to be dark
- Don't "fix" underexposure that's actually intentional mood
- The photographer chose to shoot in this light
- Exposing for the highlights and letting shadows go dark is a valid technique

### Noise Is Part of the Image

- High ISO noise at 3200+ is expected and sometimes desired
- Aggressive denoise destroys texture and character
- The photographer's profile tells you how much noise they tolerate
- Film-style photographers may actively add grain on top of existing noise

### Color Gets Weird in Low Light

- Artificial light creates non-standard color temperatures
- Mixed light sources (tungsten + fluorescent + LED) = impossible "correct" WB
- The photographer's WB choice is a creative decision, not a mistake
- Candlelight and string lights should stay warm

## Editing Approaches

### Clean Technical

- Moderate noise reduction (luminance and color)
- Preserve sharpness on subjects
- Slightly lifted shadows for detail
- Neutral to slightly warm WB

### Moody Atmospheric

- Minimal noise reduction (preserve grain texture)
- Crushed shadows, deep blacks
- Strong vignette
- Desaturated or color-shifted
- Low-key is intentional

### Warm Ambient

- Candlelight, string lights, golden scenes
- Warm WB, lifted highlights
- Soft contrast
- Moderate noise reduction
- Preserve warm color cast

### Night/Urban

- Neon colors, street lights, city glow
- Protect color highlights (don't clip neon signs)
- Selective color preservation
- Moderate to heavy noise reduction
- Cooler WB with selective warm spots

## Common Pitfalls

- Over-lifting shadows in night photos (looks unnatural, amplifies noise)
- Aggressive luminance denoise (turns faces into wax)
- "Correcting" warm candlelight to neutral (kills the mood entirely)
- Applying daylight contrast curves to low-light images
- Not matching noise reduction across a sequence of similar shots

## Sophie Guidance

- For ISO > 3200: check the photographer's profile for noise reduction preferences before applying defaults
- If the VLM classifies `low_key` or `moody` special, reduce shadow lift by 40% from the default profile
- Candlelight photos (warm artificial, low ISO possible): preserve the warm cast, don't cool it
- Night urban photos: protect color channels differently — blue/purple highlights clip differently than warm tones
- If the photographer's profile shows grain_amount > 0 for low-light scenarios, they embrace noise — reduce denoise strength by 50%
- Flag any photo with ISO > 6400 where the profile has < 5 high-ISO samples
- Consecutive low-light photos should have matching noise reduction — visual consistency in an album is more important than per-image optimization
