---
name: flash-photography
description: "Sophie's domain knowledge for flash photography editing. Covers on-camera flash, off-camera lighting, bounce flash, and mixed ambient+flash."
triggers:
  lighting:
    - flash
    - mixed
  scenarios:
    - dance_floor
  keywords:
    - flash
    - strobe
    - speedlight
    - OCF
---

# Flash Photography

## Overview

Flash photography produces fundamentally different images than natural light. The light quality, color temperature, fall-off, and shadow characteristics are distinct. Sophie must recognize flash-lit photos and apply the photographer's flash-specific editing profile rather than their ambient profile.

## Key Principles

### Flash Has Its Own Color Temperature

- Bare flash: ~5500K (daylight balanced)
- Gelled flash: varies (CTO = warm, CTB = cool)
- Mixed flash + ambient: the photographer balanced them intentionally
- Don't auto-correct flash white balance to match ambient

### Flash Creates Clean Light

- Well-lit flash photos need less noise reduction
- Shadows from flash are harder/sharper than natural light
- Highlight roll-off is different from natural light

### Power and Ratio Are Intentional

- Key-to-fill ratio is a creative choice
- Dark backgrounds with flash = the photographer killed ambient intentionally
- Don't lift the background if the photographer chose flash-dominant

## Scenario Variations

### On-Camera Bounce Flash

- Soft, even light from ceiling bounce
- Tends slightly warm (ceiling color)
- Even exposure across frame
- Minimal editing needed — exposure fine-tune and WB correction

### Off-Camera / Dramatic

- Strong directional light, deep shadows
- High contrast is intentional
- Don't lift shadows — the darkness is the design
- Often needs minimal color correction

### Fill Flash (Ambient Dominant)

- Flash fills shadows but ambient sets the mood
- Edit as ambient photo, flash just reduced contrast range
- Warm ambient + neutral flash can create subtle mixed tones

### Dance Floor / Event Flash

- Flash freezes motion in dim environment
- Colored ambient light (DJ lights) + white flash on subject
- Subject is well-exposed; background may be dark or color-shifted
- Preserve the contrast between subject and environment

## Common Pitfalls

- Lifting shadows on intentionally dark flash portraits (kills the drama)
- "Correcting" warm bounce flash when it matches the room
- Applying dehaze to flash photos (can create halo artifacts)
- Using the same noise reduction for flash and ambient from same event
- Desaturating DJ-lit dance floor images

## Sophie Guidance

- When EXIF shows flashFired=true AND the profile has flash-specific samples, use the flash profile
- Flash photos with ISO < 800 rarely need noise reduction — skip or minimize
- For dance floor flash: increase contrast tolerance by 15% and vibrance tolerance by 10%
- Mixed flash+ambient: use the ambient profile as base, but reduce shadow lift by 30%
- If the photographer's flash profile shows more contrast than their ambient profile, respect the difference — don't blend them
- Flag flash photos where the profile has < 3 flash-specific samples
