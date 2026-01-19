import type { RE2JS } from "re2js";

import { maskToken, redactPemBlock } from "../redact.js";
import type { SecretScanMatch } from "../types.js";
import { formatDetectors } from "./format.js";
import { heuristicDetectors } from "./heuristics.js";
import { keywordDetectors } from "./keyword.js";
import type { Redaction, RegexDetector } from "./types.js";
import { compileRegex, execAll } from "./utils.js";

type CompiledDetector = RegexDetector & { re: RE2JS };

const REGEX_DETECTORS: RegexDetector[] = [
  ...formatDetectors,
  ...heuristicDetectors,
  ...keywordDetectors,
];

const COMPILED_DETECTORS: CompiledDetector[] = REGEX_DETECTORS.map((detector) => ({
  ...detector,
  re: compileRegex(detector.pattern, detector.flags ?? "g"),
}));

function addMatch(
  matches: SecretScanMatch[],
  redactions: Redaction[],
  seen: Set<string>,
  detector: RegexDetector,
  matchStart: number,
  matchText: string,
  groupText?: string,
): void {
  const redactionText = groupText ?? matchText;
  const redactionOffset = groupText
    ? detector.groupPosition === "first"
      ? matchText.indexOf(groupText)
      : matchText.lastIndexOf(groupText)
    : 0;
  const start = matchStart + (redactionOffset >= 0 ? redactionOffset : 0);
  const end = start + redactionText.length;
  const key = `${detector.id}:${start}:${end}`;
  if (seen.has(key)) return;
  seen.add(key);
  matches.push({
    detector: detector.id,
    kind: detector.kind,
    confidence: detector.confidence,
    start,
    end,
  });
  const replacement =
    detector.redact === "full"
      ? matchText.includes("PRIVATE KEY-----")
        ? redactPemBlock(matchText)
        : maskToken(matchText)
      : maskToken(redactionText);
  redactions.push({ start, end, replacement, detector: detector.id });
}

export function addRegexDetections(
  text: string,
  matches: SecretScanMatch[],
  redactions: Redaction[],
  seen: Set<string>,
): void {
  for (const detector of COMPILED_DETECTORS) {
    execAll(detector.re, text, (match) => {
      const full = match.text;
      if (!full) return;
      const start = match.index;
      const groupText = detector.group ? (match.groups[detector.group] ?? undefined) : undefined;
      const candidate = groupText ?? full;
      if (detector.validator && !detector.validator(candidate ?? "")) return;
      addMatch(matches, redactions, seen, detector, start, full, groupText);
    });
  }
}
