/**
 * VLM Scene Classification Prompt
 *
 * Structured prompt that asks a vision-language model (Qwen3-VL) to classify
 * a photo into Sophie's SceneClassification dimensions. The VLM can detect
 * things EXIF cannot: backlit subjects, creative blur, moody atmospheres,
 * whether it's a portrait vs group shot, indoor vs outdoor, etc.
 *
 * Returns typed JSON matching `Partial<SceneClassification> & { confidence: number }`,
 * which feeds directly into `SceneClassifier.mergeVisionClassification()`.
 *
 * @equity-partner Qwen3-VL (Alibaba) via mlx-vlm (Apple)
 */

import type {
  TimeOfDay,
  Location,
  Lighting,
  Subject,
  Special,
} from "../learning/scene-classifier.js";

/**
 * The VLM classification result — partial scene classification with confidence.
 * Feeds directly into SceneClassifier.mergeVisionClassification().
 */
export interface VisionClassification {
  timeOfDay?: TimeOfDay;
  location?: Location;
  lighting?: Lighting;
  subject?: Subject;
  special?: Special | null;
  confidence: number;
  reasoning?: string;
}

/**
 * Valid values for each dimension — used for prompt construction and validation.
 */
export const VALID_TIME_OF_DAY: TimeOfDay[] = [
  "golden_hour",
  "blue_hour",
  "midday",
  "morning",
  "afternoon",
  "night",
  "unknown",
];

export const VALID_LOCATIONS: Location[] = ["indoor", "outdoor", "unknown"];

export const VALID_LIGHTING: Lighting[] = [
  "natural_bright",
  "natural_overcast",
  "artificial",
  "mixed",
  "flash",
  "backlit",
  "unknown",
];

export const VALID_SUBJECTS: Subject[] = [
  "portrait",
  "couple",
  "group",
  "detail",
  "landscape",
  "venue",
  "unknown",
];

export const VALID_SPECIALS: Special[] = [
  "backlit",
  "silhouette",
  "dance_floor",
  "sparkler_exit",
  "rain",
  "golden_flare",
  "first_look",
  "ceremony",
  "reception",
  "lens_flare",
  "creative_blur",
  "high_key",
  "low_key",
  "moody",
];

/**
 * Build the classification prompt for the VLM.
 * This is a zero-shot prompt that asks the model to classify the image
 * along Sophie's scene dimensions.
 */
export function buildClassifyPrompt(): string {
  return `You are a professional photo editor's assistant classifying a photograph for automated editing.

Examine this image carefully and classify it along these dimensions:

TIME OF DAY: ${VALID_TIME_OF_DAY.join(", ")}
LOCATION: ${VALID_LOCATIONS.join(", ")}
LIGHTING: ${VALID_LIGHTING.join(", ")}
SUBJECT: ${VALID_SUBJECTS.join(", ")}
SPECIAL (or null if none): ${VALID_SPECIALS.join(", ")}

Classification guide:
- "backlit" lighting: subject is lit from behind, often creating rim light or silhouette
- "golden_flare" special: visible lens flare from sun, warm glow across the image
- "lens_flare" special: any visible lens flare artifacts (not necessarily golden hour)
- "creative_blur" special: intentional motion blur or very shallow DOF used artistically
- "high_key" special: deliberately bright/overexposed look, mostly light tones
- "low_key" special: deliberately dark/moody, mostly shadow tones
- "moody" special: atmospheric, dramatic lighting with strong shadow/highlight contrast
- "silhouette" special: subject is a dark shape against a bright background
- "dance_floor" special: wedding/event dance floor with colored/DJ lighting
- "sparkler_exit" special: sparklers creating light trails, typical wedding send-off
- "first_look" special: intimate moment, usually one or two people, emotional
- "ceremony" special: formal event setting with audience/officiant
- "reception" special: party/celebration setting, tables, speeches, toasts

Respond with ONLY valid JSON, no explanation:
{
  "timeOfDay": "<value>",
  "location": "<value>",
  "lighting": "<value>",
  "subject": "<value>",
  "special": "<value or null>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence explaining your classification>"
}`;
}

/**
 * Parse and validate the VLM's classification output.
 * Handles common model output issues: markdown fences, extra text, invalid values.
 *
 * @returns Validated VisionClassification, or a low-confidence fallback.
 */
export function parseClassifyOutput(rawOutput: string): VisionClassification {
  let text = rawOutput.trim();

  // Strip markdown fences
  if (text.includes("```json")) {
    text = text.split("```json")[1]?.split("```")[0]?.trim() ?? text;
  } else if (text.includes("```")) {
    text = text.split("```")[1]?.split("```")[0]?.trim() ?? text;
  }

  // Extract JSON object
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    text = text.slice(braceStart, braceEnd + 1);
  }

  try {
    const parsed = JSON.parse(text);
    return validateClassification(parsed);
  } catch {
    console.warn("[ClassifyPrompt] Failed to parse VLM output:", rawOutput.slice(0, 200));
    return { confidence: 0 };
  }
}

/**
 * Validate and sanitize parsed classification, ensuring all values are valid enum members.
 */
function validateClassification(raw: Record<string, unknown>): VisionClassification {
  const result: VisionClassification = {
    confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
  };

  if (typeof raw.reasoning === "string") {
    result.reasoning = raw.reasoning;
  }

  // Validate each dimension against allowed values
  if (typeof raw.timeOfDay === "string" && isValid(raw.timeOfDay, VALID_TIME_OF_DAY)) {
    result.timeOfDay = raw.timeOfDay;
  }

  if (typeof raw.location === "string" && isValid(raw.location, VALID_LOCATIONS)) {
    result.location = raw.location;
  }

  if (typeof raw.lighting === "string" && isValid(raw.lighting, VALID_LIGHTING)) {
    result.lighting = raw.lighting;
  }

  if (typeof raw.subject === "string" && isValid(raw.subject, VALID_SUBJECTS)) {
    result.subject = raw.subject;
  }

  if (raw.special === null) {
    result.special = null;
  } else if (typeof raw.special === "string" && isValid(raw.special, VALID_SPECIALS)) {
    result.special = raw.special;
  }

  return result;
}

function isValid<T extends string>(value: string, allowed: T[]): value is T {
  return (allowed as string[]).includes(value);
}
