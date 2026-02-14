import type { EveningAvailability } from "./types.js";

export type ParsedReply = {
  availability: EveningAvailability;
  etaMinutes?: number;
  confidence: number;
  reason: string;
};

const YES_PATTERNS = [
  /\b(yes|yep|yeah|sure|coming|join|attend)\b/i,
  /\b(arriving|on my way|otw|pakka|definitely|confirm)\b/i,
  /\b(haan|han|haanji|aa raha|aa rha|aunga|aaoonga|milte)\b/i,
];

const NO_PATTERNS = [
  /\b(no|nope|nah|not coming|cant make it|can't make it|skip)\b/i,
  /\b(wont|won't|will not|unable|busy|next time)\b/i,
  /\b(nahi|nahin|nhi|nahi aa paunga|nahi aa raha|nahi aa rha)\b/i,
];

const MAYBE_PATTERNS = [
  /\b(maybe|not sure|unsure|will try|try karunga|dekhta|dekhte)\b/i,
  /\b(running late|thoda late)\b/i,
  /\b(shayad|pata nahi)\b/i,
];

const ETA_RANGE_PATTERN =
  /\b(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*(min|mins|minute|minutes|m|hr|hrs|hour|hours|h|ghanta|ghante)\b/i;
const ETA_SINGLE_PATTERN =
  /\b(?:in\s+)?(\d{1,3})\s*(min|mins|minute|minutes|m|hr|hrs|hour|hours|h|ghanta|ghante)\b/i;
const ETA_HALF_HOUR_PATTERN = /\b(half\s+hour|aadha\s+ghanta)\b/i;

function toMinutes(value: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("h") || normalized.startsWith("gh")) {
    return value * 60;
  }
  return value;
}

export function extractEtaMinutes(text: string): number | undefined {
  const range = text.match(ETA_RANGE_PATTERN);
  if (range?.[1] && range[2] && range[3]) {
    const low = Number.parseInt(range[1], 10);
    const high = Number.parseInt(range[2], 10);
    if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0) {
      const avg = Math.round((low + high) / 2);
      return toMinutes(avg, range[3]);
    }
  }

  const single = text.match(ETA_SINGLE_PATTERN);
  if (single?.[1] && single[2]) {
    const value = Number.parseInt(single[1], 10);
    if (Number.isFinite(value) && value > 0) {
      return toMinutes(value, single[2]);
    }
  }

  if (ETA_HALF_HOUR_PATTERN.test(text)) {
    return 30;
  }

  return undefined;
}

function scoreMatch(text: string, patterns: RegExp[]): number {
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      score += 1;
    }
  }
  return score;
}

export function parseShubhamReply(rawText: string): ParsedReply {
  const text = rawText.trim();
  if (!text) {
    return {
      availability: "unknown",
      confidence: 0.1,
      reason: "empty",
    };
  }

  const yesScore = scoreMatch(text, YES_PATTERNS);
  const noScore = scoreMatch(text, NO_PATTERNS);
  const maybeScore = scoreMatch(text, MAYBE_PATTERNS);
  const etaMinutes = extractEtaMinutes(text);

  let availability: EveningAvailability = "unknown";
  let reason = "ambiguous";

  if (noScore > yesScore && noScore >= 1) {
    availability = "no";
    reason = "negative";
  } else if (yesScore > noScore && yesScore >= 1) {
    availability = "yes";
    reason = "positive";
  } else if (maybeScore >= 1) {
    availability = "maybe";
    reason = "tentative";
  } else if (yesScore === 0 && noScore === 0 && maybeScore === 0 && etaMinutes !== undefined) {
    availability = "maybe";
    reason = "eta_only";
  }

  let confidence = 0.3;
  if (availability === "yes" || availability === "no") {
    confidence += 0.45;
  } else if (availability === "maybe") {
    confidence += 0.25;
  }
  if (etaMinutes !== undefined) {
    confidence += 0.15;
  }

  return {
    availability,
    etaMinutes,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
    reason,
  };
}
