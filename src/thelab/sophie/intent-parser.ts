/**
 * Parses natural language user messages into structured intents.
 *
 * This is a rule-based parser — no LLM needed for command interpretation.
 * Photographers speak plainly: "go edit the Johnson wedding," "make it warmer,"
 * "how many flagged?" The patterns are predictable.
 */

import type { UserIntent, StartEditingParams, AdjustStyleParams } from "./types.js";

const EDIT_TRIGGERS = [
  /\b(?:go\s+)?edit\b/i,
  /\bstart\s+editing\b/i,
  /\bprocess\b/i,
  /\bget\s+(?:it|them|these)\s+(?:done|edited|processed)\b/i,
  /\bwork\s+(?:on|through)\b/i,
  /\bhandle\s+(?:the|these|those)\b/i,
  /\brun\s+(?:through|on)\b/i,
  /\bget\s+(?:it|them)\s+down\s+to\b/i,
];

const STOP_TRIGGERS = [
  /\bstop\b/i,
  /\bcancel\b/i,
  /\babort\b/i,
  /\bquit\b/i,
  /\bend\s+(?:the\s+)?session\b/i,
];

const PAUSE_TRIGGERS = [
  /\bpause\b/i,
  /\bhold\s+(?:on|up)\b/i,
  /\bwait\b/i,
  /\btake\s+a\s+break\b/i,
];

const RESUME_TRIGGERS = [
  /\bresume\b/i,
  /\bcontinue\b/i,
  /\bkeep\s+going\b/i,
  /\bgo\s+ahead\b/i,
  /\bstart\s+(?:back\s+)?up\b/i,
  /\bunpause\b/i,
];

const LEARN_TRIGGERS = [
  /\blearn\b/i,
  /\bingest\b/i,
  /\bstudy\b/i,
  /\banalyze\s+(?:my\s+)?catalog\b/i,
  /\bscan\s+(?:my\s+)?catalog\b/i,
  /\bread\s+(?:my\s+)?catalog\b/i,
  /\bimport\s+(?:my\s+)?catalog\b/i,
];

const OBSERVE_ON_TRIGGERS = [
  /\bwatch\s+me\b/i,
  /\bobserve\b/i,
  /\blearn\s+from\s+(?:me|my\s+editing)\b/i,
  /\bstart\s+watching\b/i,
];

const OBSERVE_OFF_TRIGGERS = [
  /\bstop\s+watching\b/i,
  /\bstop\s+observing\b/i,
  /\bdon'?t\s+watch\b/i,
];

const PROGRESS_TRIGGERS = [
  /\b(?:how(?:'s|\s+is)\s+it\s+going|progress|status|where\s+are\s+(?:you|we))\b/i,
  /\bhow\s+many\s+(?:done|left|remaining|edited|processed)\b/i,
  /\bwhat(?:'s|\s+is)\s+the\s+(?:status|progress|eta)\b/i,
  /\bhow\s+much\s+longer\b/i,
];

const FLAGGED_TRIGGERS = [
  /\b(?:show|see|view|what(?:'s|\s+are))\s+(?:the\s+)?flagged\b/i,
  /\bhow\s+many\s+flagged\b/i,
  /\bflagged\s+(?:images|photos)\b/i,
  /\bwhat\s+(?:did\s+you|have\s+you)\s+flag/i,
];

const PROFILE_TRIGGERS = [
  /\b(?:show|see|view|what(?:'s|\s+is))\s+(?:my\s+)?(?:style|profile|dna)\b/i,
  /\bhow\s+do\s+I\s+(?:typically\s+)?edit\b/i,
  /\bwhat\s+(?:have\s+you|did\s+you)\s+learn/i,
  /\bwhat\s+do\s+you\s+know\s+about\s+my\s+(?:style|editing)\b/i,
];

const GREETING_TRIGGERS = [
  /^(?:hi|hey|hello|sup|yo|what'?s\s+up|good\s+(?:morning|afternoon|evening))\b/i,
];

export function parseIntent(text: string): UserIntent {
  const trimmed = text.trim();

  if (matchesAny(trimmed, GREETING_TRIGGERS)) {
    return { type: "greeting" };
  }

  // Observation triggers checked before stop/pause since "stop watching"
  // should be observation-off, not stop-editing.
  if (matchesAny(trimmed, OBSERVE_OFF_TRIGGERS)) {
    return { type: "toggle_observation", enabled: false };
  }

  if (matchesAny(trimmed, OBSERVE_ON_TRIGGERS)) {
    return { type: "toggle_observation", enabled: true };
  }

  if (matchesAny(trimmed, STOP_TRIGGERS)) {
    return { type: "stop_editing" };
  }

  if (matchesAny(trimmed, PAUSE_TRIGGERS)) {
    return { type: "pause_editing" };
  }

  if (matchesAny(trimmed, RESUME_TRIGGERS)) {
    return { type: "resume_editing" };
  }

  if (matchesAny(trimmed, FLAGGED_TRIGGERS)) {
    return { type: "show_flagged" };
  }

  if (matchesAny(trimmed, PROGRESS_TRIGGERS)) {
    return { type: "show_progress" };
  }

  if (matchesAny(trimmed, PROFILE_TRIGGERS)) {
    const scenario = extractScenarioHint(trimmed);
    return { type: "show_profile", scenario };
  }

  const styleAdj = parseStyleAdjustment(trimmed);
  if (styleAdj) {
    return { type: "adjust_style", params: styleAdj };
  }

  if (matchesAny(trimmed, LEARN_TRIGGERS)) {
    return {
      type: "start_learning",
      params: { reingest: /re-?ingest/i.test(trimmed) },
    };
  }

  if (matchesAny(trimmed, EDIT_TRIGGERS)) {
    return { type: "start_editing", params: parseEditParams(trimmed) };
  }

  if (trimmed.endsWith("?")) {
    return { type: "question", text: trimmed };
  }

  return { type: "unknown", text: trimmed };
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function parseEditParams(text: string): StartEditingParams {
  const params: StartEditingParams = {};

  const countMatch = text.match(/(?:down\s+to|only|just|limit\s+(?:to|it\s+to)?)\s+(\d[\d,]*)/i);
  if (countMatch) {
    params.targetCount = parseInt(countMatch[1].replace(/,/g, ""), 10);
  }

  const skipMatch = text.match(/skip\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:shots?|photos?|images?)/i);
  if (skipMatch) {
    params.skipScenarios = [skipMatch[1].toLowerCase()];
  }

  if (/cull\s+first/i.test(text)) {
    params.cullFirst = true;
  }

  return params;
}

function parseStyleAdjustment(text: string): AdjustStyleParams | null {
  const adjustments: Record<string, string> = {};

  const directionMap: Record<string, string> = {
    warmer: "temperature:+",
    cooler: "temperature:-",
    brighter: "exposure:+",
    darker: "exposure:-",
  };

  for (const [word, adj] of Object.entries(directionMap)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      const [control, dir] = adj.split(":");
      adjustments[control] = dir;
    }
  }

  const sliderMatch = text.match(
    /\b(increase|decrease|bump|pull|push|raise|lower|lift|drop)\s+(?:the\s+)?(shadows|highlights|exposure|contrast|saturation|vibrance|clarity|temperature|tint|whites|blacks|grain|dehaze|texture)\b/i,
  );
  if (sliderMatch) {
    const direction = sliderMatch[1].toLowerCase();
    const control = sliderMatch[2].toLowerCase();
    const isUp = ["increase", "bump", "push", "raise", "lift"].includes(direction);
    adjustments[control] = isUp ? "+" : "-";
  }

  const moreMatch = text.match(
    /\b(more|less)\s+(contrast|saturation|vibrance|clarity|grain|warmth|exposure)\b/i,
  );
  if (moreMatch) {
    const control =
      moreMatch[2].toLowerCase() === "warmth" ? "temperature" : moreMatch[2].toLowerCase();
    adjustments[control] = moreMatch[1].toLowerCase() === "more" ? "+" : "-";
  }

  if (Object.keys(adjustments).length === 0) {
    return null;
  }

  return {
    scenario: extractScenarioHint(text),
    adjustments,
  };
}

function extractScenarioHint(text: string): string | undefined {
  const scenarioPatterns: Array<[RegExp, string]> = [
    [/\b(?:golden\s+hour|sunset)\b/i, "golden_hour"],
    [/\b(?:blue\s+hour|twilight)\b/i, "blue_hour"],
    [/\b(?:indoor|inside)\b/i, "indoor"],
    [/\b(?:outdoor|outside)\b/i, "outdoor"],
    [/\breception\b/i, "reception"],
    [/\bceremony\b/i, "ceremony"],
    [/\bportrait/i, "portrait"],
    [/\bgroup/i, "group"],
    [/\bdetail/i, "detail"],
    [/\bdance\s*floor\b/i, "dance_floor"],
    [/\bflash\b/i, "flash"],
  ];

  for (const [pattern, hint] of scenarioPatterns) {
    if (pattern.test(text)) {
      return hint;
    }
  }

  return undefined;
}
