/**
 * Lightroom Classic keyboard shortcut mappings.
 *
 * These map logical actions to Peekaboo hotkey/press commands.
 * Lightroom's keyboard shortcuts are well-documented and stable across versions.
 */

export const LR_SHORTCUTS = {
  modules: {
    library: "g",
    develop: "d",
    map: null,
    book: null,
    slideshow: null,
    print: null,
    web: null,
  },

  navigation: {
    nextImage: "right",
    prevImage: "left",
    firstImage: "home",
    lastImage: "end",
  },

  rating: {
    star0: "0",
    star1: "1",
    star2: "2",
    star3: "3",
    star4: "4",
    star5: "5",
    flagPick: "p",
    flagReject: "x",
    flagUnflag: "u",
  },

  develop: {
    autoTone: "cmd,shift,u",
    resetAll: "cmd,shift,r",
    convertBW: "v",
    beforeAfter: "\\",
    copySettings: "cmd,shift,c",
    pasteSettings: "cmd,shift,v",
    syncSettings: "cmd,shift,s",
    undo: "cmd,z",
  },

  general: {
    import: "cmd,shift,i",
    export: "cmd,shift,e",
    selectAll: "cmd,a",
    deselectAll: "cmd,d",
  },
} as const;

/**
 * Slider control names mapped to their Lightroom panel locations.
 * Used to navigate to the correct panel before adjusting.
 */
export const SLIDER_PANELS: Record<string, string> = {
  exposure: "Basic",
  contrast: "Basic",
  highlights: "Basic",
  shadows: "Basic",
  whites: "Basic",
  blacks: "Basic",
  temp: "Basic",
  tint: "Basic",
  vibrance: "Basic",
  saturation: "Basic",
  clarity: "Basic",
  dehaze: "Basic",
  texture: "Basic",
  tone_curve_lights: "Tone Curve",
  tone_curve_darks: "Tone Curve",
  tone_curve_shadows: "Tone Curve",
  tone_curve_highlights: "Tone Curve",
  hsl_hue_red: "HSL / Color",
  hsl_hue_orange: "HSL / Color",
  hsl_hue_yellow: "HSL / Color",
  hsl_hue_green: "HSL / Color",
  hsl_hue_aqua: "HSL / Color",
  hsl_hue_blue: "HSL / Color",
  hsl_hue_purple: "HSL / Color",
  hsl_hue_magenta: "HSL / Color",
  hsl_sat_red: "HSL / Color",
  hsl_sat_orange: "HSL / Color",
  hsl_sat_yellow: "HSL / Color",
  hsl_sat_green: "HSL / Color",
  hsl_sat_aqua: "HSL / Color",
  hsl_sat_blue: "HSL / Color",
  hsl_sat_purple: "HSL / Color",
  hsl_sat_magenta: "HSL / Color",
  hsl_lum_red: "HSL / Color",
  hsl_lum_orange: "HSL / Color",
  hsl_lum_yellow: "HSL / Color",
  hsl_lum_green: "HSL / Color",
  hsl_lum_aqua: "HSL / Color",
  hsl_lum_blue: "HSL / Color",
  hsl_lum_purple: "HSL / Color",
  hsl_lum_magenta: "HSL / Color",
  grain_amount: "Effects",
  grain_size: "Effects",
  grain_roughness: "Effects",
  vignette_amount: "Effects",
};

/**
 * Human-readable slider labels as they appear in Lightroom's UI.
 * Used for Peekaboo element targeting via text search.
 */
export const SLIDER_UI_LABELS: Record<string, string> = {
  exposure: "Exposure",
  contrast: "Contrast",
  highlights: "Highlights",
  shadows: "Shadows",
  whites: "Whites",
  blacks: "Blacks",
  temp: "Temp",
  tint: "Tint",
  vibrance: "Vibrance",
  saturation: "Saturation",
  clarity: "Clarity",
  dehaze: "Dehaze",
  texture: "Texture",
  grain_amount: "Amount",
  grain_size: "Size",
  grain_roughness: "Roughness",
  vignette_amount: "Amount",
};
