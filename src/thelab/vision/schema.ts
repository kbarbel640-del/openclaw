import { z } from "zod";

/**
 * Lightroom Develop module controls that the vision model can adjust.
 * Maps to actual Lightroom slider names for UI scripting.
 */
export const LightroomControl = z.enum([
  "exposure",
  "contrast",
  "highlights",
  "shadows",
  "whites",
  "blacks",
  "temp",
  "tint",
  "vibrance",
  "saturation",
  "clarity",
  "dehaze",
  "texture",
  "tone_curve_lights",
  "tone_curve_darks",
  "tone_curve_shadows",
  "tone_curve_highlights",
  "hsl_hue_red",
  "hsl_hue_orange",
  "hsl_hue_yellow",
  "hsl_hue_green",
  "hsl_hue_aqua",
  "hsl_hue_blue",
  "hsl_hue_purple",
  "hsl_hue_magenta",
  "hsl_sat_red",
  "hsl_sat_orange",
  "hsl_sat_yellow",
  "hsl_sat_green",
  "hsl_sat_aqua",
  "hsl_sat_blue",
  "hsl_sat_purple",
  "hsl_sat_magenta",
  "hsl_lum_red",
  "hsl_lum_orange",
  "hsl_lum_yellow",
  "hsl_lum_green",
  "hsl_lum_aqua",
  "hsl_lum_blue",
  "hsl_lum_purple",
  "hsl_lum_magenta",
  "grain_amount",
  "grain_size",
  "grain_roughness",
  "vignette_amount",
]);

export type LightroomControlType = z.infer<typeof LightroomControl>;

export const AdjustmentEntry = z.object({
  control: LightroomControl,
  current_estimate: z.number(),
  target_delta: z.number(),
  confidence: z.number().min(0).max(1),
});

export type AdjustmentEntryType = z.infer<typeof AdjustmentEntry>;

export const ImageAnalysisResult = z.object({
  image_id: z.string(),
  confidence: z.number().min(0).max(1),
  adjustments: z.array(AdjustmentEntry),
  flag_for_review: z.boolean(),
  flag_reason: z.string().nullable(),
  reasoning: z.string().optional(),
});

export type ImageAnalysisResultType = z.infer<typeof ImageAnalysisResult>;

export const VerificationResult = z.object({
  image_id: z.string(),
  adjustments_applied: z.boolean(),
  deviation_score: z.number().min(0).max(1),
  needs_retry: z.boolean(),
  details: z.string().optional(),
});

export type VerificationResultType = z.infer<typeof VerificationResult>;

/**
 * Per-image state tracked across the editing session.
 */
export const ImageState = z.enum([
  "pending",
  "processing",
  "complete",
  "flagged",
  "error",
  "skipped",
]);

export type ImageStateType = z.infer<typeof ImageState>;

export const SessionImageEntry = z.object({
  image_id: z.string(),
  file_path: z.string(),
  state: ImageState,
  analysis: ImageAnalysisResult.nullable(),
  verification: VerificationResult.nullable(),
  attempts: z.number(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  flag_reason: z.string().nullable(),
});

export type SessionImageEntryType = z.infer<typeof SessionImageEntry>;

export const SessionLog = z.object({
  session_id: z.string(),
  film_stock: z.string(),
  started_at: z.string(),
  images: z.array(SessionImageEntry),
  total_images: z.number(),
  completed: z.number(),
  flagged: z.number(),
  errors: z.number(),
});

export type SessionLogType = z.infer<typeof SessionLog>;

/**
 * Film stock target profile -- defines what the vision model aims for.
 */
const SliderRange = z.object({
  min: z.number(),
  max: z.number(),
  typical: z.number(),
});

export const FilmStockTarget = z.object({
  name: z.string(),
  description: z.string(),
  target_ranges: z.record(z.string(), SliderRange),
  color_temperature_bias: z.number().optional(),
  grain_profile: z
    .object({
      amount: z.number(),
      size: z.number(),
      roughness: z.number(),
    })
    .optional(),
  tone_curve_anchors: z
    .array(
      z.object({
        input: z.number(),
        output: z.number(),
      }),
    )
    .optional(),
});

export type FilmStockTargetType = z.infer<typeof FilmStockTarget>;
