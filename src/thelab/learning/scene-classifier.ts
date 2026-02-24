import type { CatalogExifData } from "./catalog-ingester.js";

/**
 * Scene scenario dimensions. Each photo is classified along multiple axes.
 * A "scenario" is the combination of these classifications.
 */
export interface SceneClassification {
  timeOfDay: TimeOfDay;
  location: Location;
  lighting: Lighting;
  subject: Subject;
  special: Special | null;
  confidence: number;
  overridden: boolean;
}

export type TimeOfDay =
  | "golden_hour"
  | "blue_hour"
  | "midday"
  | "morning"
  | "afternoon"
  | "night"
  | "unknown";
export type Location = "indoor" | "outdoor" | "unknown";
export type Lighting =
  | "natural_bright"
  | "natural_overcast"
  | "artificial"
  | "mixed"
  | "flash"
  | "backlit"
  | "unknown";
export type Subject =
  | "portrait"
  | "couple"
  | "group"
  | "detail"
  | "landscape"
  | "venue"
  | "unknown";
export type Special =
  | "backlit"
  | "silhouette"
  | "dance_floor"
  | "sparkler_exit"
  | "rain"
  | "golden_flare"
  | "first_look"
  | "ceremony"
  | "reception"
  // Vision-only classifications (detectable by VLM, not EXIF)
  | "lens_flare"
  | "creative_blur"
  | "high_key"
  | "low_key"
  | "moody";

/**
 * Generates a stable string key for a scenario combination.
 * Used as the lookup key in the style profile database.
 */
export function scenarioKey(classification: SceneClassification): string {
  const parts: string[] = [
    classification.timeOfDay,
    classification.location,
    classification.lighting,
    classification.subject,
  ];
  if (classification.special) {
    parts.push(classification.special);
  }
  return parts.join("::");
}

/**
 * Generates a human-readable label for a scenario.
 */
export function scenarioLabel(classification: SceneClassification): string {
  const parts: string[] = [];

  if (classification.timeOfDay !== "unknown") {
    parts.push(classification.timeOfDay.replace(/_/g, " "));
  }
  if (classification.location !== "unknown") {
    parts.push(classification.location);
  }
  if (classification.lighting !== "unknown") {
    parts.push(classification.lighting.replace(/_/g, " "));
  }
  if (classification.subject !== "unknown") {
    parts.push(classification.subject);
  }
  if (classification.special) {
    parts.push(classification.special.replace(/_/g, " "));
  }

  return parts.length > 0 ? parts.join(" / ") : "unclassified";
}

/**
 * Classifies a photo's scene based on EXIF metadata.
 *
 * This is the auto-detect layer. The photographer can override
 * any classification after the fact.
 */
export class SceneClassifier {
  /**
   * Classify a photo using only EXIF data (no vision model needed).
   * Fast, runs on every photo during catalog ingestion.
   */
  classifyFromExif(exif: CatalogExifData): SceneClassification {
    return {
      timeOfDay: this.classifyTimeOfDay(exif),
      location: this.classifyLocation(exif),
      lighting: this.classifyLighting(exif),
      subject: this.classifySubject(exif),
      special: this.classifySpecial(exif),
      confidence: this.computeExifConfidence(exif),
      overridden: false,
    };
  }

  /**
   * Merge a vision-model classification with the EXIF-based one.
   * Vision results override EXIF guesses when they have higher confidence.
   */
  mergeVisionClassification(
    exifBased: SceneClassification,
    visionResult: Partial<SceneClassification> & { confidence: number },
  ): SceneClassification {
    const merged = { ...exifBased };

    if (visionResult.confidence > exifBased.confidence) {
      if (visionResult.location && visionResult.location !== "unknown") {
        merged.location = visionResult.location;
      }
      if (visionResult.subject && visionResult.subject !== "unknown") {
        merged.subject = visionResult.subject;
      }
      if (visionResult.lighting && visionResult.lighting !== "unknown") {
        merged.lighting = visionResult.lighting;
      }
      if (visionResult.special) {
        merged.special = visionResult.special;
      }
    }

    merged.confidence = Math.max(exifBased.confidence, visionResult.confidence);
    return merged;
  }

  /**
   * Apply a photographer's manual override to a classification.
   */
  applyOverride(
    base: SceneClassification,
    overrides: Partial<Omit<SceneClassification, "confidence" | "overridden">>,
  ): SceneClassification {
    return {
      ...base,
      ...overrides,
      confidence: 1.0,
      overridden: true,
    };
  }

  private classifyTimeOfDay(exif: CatalogExifData): TimeOfDay {
    if (!exif.dateTimeOriginal) {
      return "unknown";
    }

    const date = new Date(exif.dateTimeOriginal);
    const hour = date.getHours();
    const month = date.getMonth();

    // Approximate golden/blue hour based on time
    // These vary by latitude/season; this is a reasonable default
    const isSummer = month >= 4 && month <= 8;
    const goldenMorningStart = isSummer ? 5 : 6;
    const goldenMorningEnd = isSummer ? 7 : 8;
    const goldenEveningStart = isSummer ? 19 : 17;
    const goldenEveningEnd = isSummer ? 21 : 19;
    const blueHourOffset = 0.5; // ~30 min before/after golden

    if (hour >= goldenEveningEnd || hour < goldenMorningStart - blueHourOffset) {
      return "night";
    }
    if (hour >= goldenMorningStart - blueHourOffset && hour < goldenMorningStart) {
      return "blue_hour";
    }
    if (hour >= goldenMorningStart && hour < goldenMorningEnd) {
      return "golden_hour";
    }
    if (hour >= goldenMorningEnd && hour < 12) {
      return "morning";
    }
    if (hour >= 12 && hour < 14) {
      return "midday";
    }
    if (hour >= 14 && hour < goldenEveningStart) {
      return "afternoon";
    }
    if (hour >= goldenEveningStart && hour < goldenEveningEnd) {
      return "golden_hour";
    }
    if (hour >= goldenEveningEnd && hour < goldenEveningEnd + blueHourOffset) {
      return "blue_hour";
    }

    return "unknown";
  }

  private classifyLocation(exif: CatalogExifData): Location {
    // High ISO + no flash often suggests indoor
    if (exif.isoSpeedRating && exif.isoSpeedRating >= 1600 && !exif.flashFired) {
      return "indoor";
    }

    // Low ISO in daylight hours suggests outdoor
    if (exif.isoSpeedRating && exif.isoSpeedRating <= 400) {
      const tod = this.classifyTimeOfDay(exif);
      if (tod !== "night" && tod !== "unknown") {
        return "outdoor";
      }
    }

    return "unknown";
  }

  private classifyLighting(exif: CatalogExifData): Lighting {
    if (exif.flashFired) {
      // Flash + low ambient ISO = flash-dominant
      if (exif.isoSpeedRating && exif.isoSpeedRating <= 800) {
        return "flash";
      }
      return "mixed";
    }

    if (!exif.isoSpeedRating) {
      return "unknown";
    }

    // High ISO, no flash = artificial or low light
    if (exif.isoSpeedRating >= 3200) {
      return "artificial";
    }

    // Moderate ISO in daylight
    if (exif.isoSpeedRating <= 200) {
      return "natural_bright";
    }

    if (exif.isoSpeedRating <= 800) {
      return "natural_overcast";
    }

    return "unknown";
  }

  private classifySubject(exif: CatalogExifData): Subject {
    if (!exif.focalLength) {
      return "unknown";
    }

    // Wide angle (< 35mm) suggests landscape/venue/group
    if (exif.focalLength < 35) {
      return "landscape";
    }

    // Standard portrait range (50-135mm)
    if (exif.focalLength >= 50 && exif.focalLength <= 135) {
      // Shallow depth of field (wide aperture) suggests portrait
      if (exif.aperture && exif.aperture <= 2.8) {
        return "portrait";
      }
      // Moderate aperture might be couple/group
      if (exif.aperture && exif.aperture >= 4.0) {
        return "group";
      }
      return "portrait";
    }

    // Telephoto (> 135mm) often detail shots at weddings
    if (exif.focalLength > 135) {
      return "detail";
    }

    return "unknown";
  }

  private classifySpecial(exif: CatalogExifData): Special | null {
    if (!exif.dateTimeOriginal) {
      return null;
    }

    const hour = new Date(exif.dateTimeOriginal).getHours();

    // Late night + flash + high ISO = likely dance floor or sparkler exit
    if (hour >= 21 && exif.flashFired && exif.isoSpeedRating && exif.isoSpeedRating >= 1600) {
      return "dance_floor";
    }

    // Very high ISO + very slow shutter = sparkler exit
    if (
      exif.isoSpeedRating &&
      exif.isoSpeedRating >= 3200 &&
      exif.shutterSpeed &&
      exif.shutterSpeed >= 1
    ) {
      return "sparkler_exit";
    }

    return null;
  }

  /**
   * Estimate how confident we are in the EXIF-only classification.
   * More EXIF data available = higher confidence.
   */
  private computeExifConfidence(exif: CatalogExifData): number {
    let score = 0;
    let maxScore = 0;

    const fields: Array<[unknown, number]> = [
      [exif.dateTimeOriginal, 0.25],
      [exif.isoSpeedRating, 0.2],
      [exif.focalLength, 0.15],
      [exif.aperture, 0.15],
      [exif.flashFired, 0.1],
      [exif.shutterSpeed, 0.1],
      [exif.gpsLatitude, 0.05],
    ];

    for (const [value, weight] of fields) {
      maxScore += weight;
      if (value != null) {
        score += weight;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }
}
