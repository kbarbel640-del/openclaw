import RE2 from "re2";

import {
  BASE64_ENTROPY_THRESHOLD,
  BASE64_MIN_LENGTH,
  BASE64URL_MIN_LENGTH,
  DEFAULT_SECRET_SCAN_LOG_MATCHES,
  DEFAULT_SECRET_SCAN_MAX_CHARS,
  DEFAULT_SECRET_SCAN_MODE,
  DEFAULT_SECRET_SCAN_OVERFLOW,
  HEX_ENTROPY_THRESHOLD,
  HEX_MIN_LENGTH,
} from "./constants.js";
import { maskToken, redactPemBlock } from "./redact.js";
import type {
  SecretScanMatch,
  SecretScanOptions,
  SecretScanResult,
  SecretScanWarning,
  SecretScanningConfig,
} from "./types.js";

const BASE64_RE = new RE2(`[A-Za-z0-9+/=]{${BASE64_MIN_LENGTH},}`, "g");
const BASE64URL_RE = new RE2(`[A-Za-z0-9_-]{${BASE64URL_MIN_LENGTH},}`, "g");
const HEX_RE = new RE2(`[A-Fa-f0-9]{${HEX_MIN_LENGTH},}`, "g");

type DetectorKind = SecretScanMatch["kind"];

type RegexDetector = {
  id: string;
  kind: DetectorKind;
  confidence: SecretScanMatch["confidence"];
  pattern: string;
  flags?: string;
  group?: number;
  redact: "group" | "full";
};

type CompiledDetector = RegexDetector & { re: RE2 };

type Redaction = {
  start: number;
  end: number;
  replacement: string;
  detector: string;
};

const REGEX_DETECTORS: RegexDetector[] = [
  {
    id: "pem-private-key",
    kind: "format",
    confidence: "high",
    pattern: String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----`,
    redact: "full",
  },
  {
    id: "authorization-bearer",
    kind: "format",
    confidence: "high",
    pattern: String.raw`Authorization\s*[:=]\s*Bearer\s+([A-Za-z0-9._\-+=]+)`,
    group: 1,
    redact: "group",
  },
  {
    id: "bearer-inline",
    kind: "format",
    confidence: "medium",
    pattern: String.raw`\bBearer\s+([A-Za-z0-9._\-+=]{18,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "env-assignment",
    kind: "heuristic",
    confidence: "medium",
    pattern: String.raw`\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD)\b\s*[=:]\s*(["']?)([^\s"'\\]+)\1`,
    group: 2,
    redact: "group",
  },
  {
    id: "json-field",
    kind: "heuristic",
    confidence: "medium",
    pattern: String.raw`"(?:apiKey|token|secret|password|passwd|accessToken|refreshToken)"\s*:\s*"([^"]+)"`,
    group: 1,
    redact: "group",
  },
  {
    id: "cli-flag",
    kind: "heuristic",
    confidence: "medium",
    pattern: String.raw`--(?:api[-_]?key|token|secret|password|passwd)\s+(["']?)([^\s"']+)\1`,
    group: 2,
    redact: "group",
  },
  {
    id: "token-sk",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(sk-[A-Za-z0-9_-]{8,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-ghp",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(ghp_[A-Za-z0-9]{20,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-github-pat",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(github_pat_[A-Za-z0-9_]{20,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-slack",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(xox[baprs]-[A-Za-z0-9-]{10,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-slack-app",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(xapp-[A-Za-z0-9-]{10,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-google-ai",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(gsk_[A-Za-z0-9_-]{10,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-google-api",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(AIza[0-9A-Za-z\-_]{20,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-perplexity",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(pplx-[A-Za-z0-9_-]{10,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-npm",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(npm_[A-Za-z0-9]{10,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-telegram",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(\d{6,}:[A-Za-z0-9_-]{20,})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "token-aws-access",
    kind: "format",
    confidence: "high",
    pattern: String.raw`\b(A(?:KI|SI)A[0-9A-Z]{16})\b`,
    group: 1,
    redact: "group",
  },
  {
    id: "jwt",
    kind: "format",
    confidence: "medium",
    pattern: String.raw`\b([A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b`,
    group: 1,
    redact: "group",
  },
];

const COMPILED_DETECTORS: CompiledDetector[] = REGEX_DETECTORS.map((detector) => ({
  ...detector,
  re: new RE2(detector.pattern, detector.flags ?? "g"),
}));

type ResolvedSecretScanConfig = {
  mode: NonNullable<SecretScanningConfig["mode"]>;
  maxChars: number;
  overflow: NonNullable<SecretScanningConfig["overflow"]>;
  logSecretMatches: NonNullable<SecretScanningConfig["logSecretMatches"]>;
};

function resolveSecretScanConfig(config?: SecretScanningConfig): ResolvedSecretScanConfig {
  const mode = config?.mode ?? DEFAULT_SECRET_SCAN_MODE;
  const maxChars =
    typeof config?.maxChars === "number" && Number.isFinite(config.maxChars) && config.maxChars > 0
      ? Math.floor(config.maxChars)
      : DEFAULT_SECRET_SCAN_MAX_CHARS;
  const overflow = config?.overflow ?? DEFAULT_SECRET_SCAN_OVERFLOW;
  const logSecretMatches = config?.logSecretMatches ?? DEFAULT_SECRET_SCAN_LOG_MATCHES;
  return { mode, maxChars, overflow, logSecretMatches };
}

function buildTruncateWarning(maxChars: number, inputChars: number): SecretScanWarning {
  return {
    kind: "truncated",
    maxChars,
    inputChars,
    message: `Secret scan truncated to ${maxChars} chars (set security.secretScanning.maxChars to increase).`,
  };
}

function execAll(re: RE2, text: string, onMatch: (match: RegExpExecArray) => void): void {
  re.lastIndex = 0;
  let match: RegExpExecArray | null = re.exec(text);
  while (match) {
    onMatch(match);
    if (!match[0]) {
      re.lastIndex += 1;
    }
    match = re.exec(text);
  }
}

function applyRedactions(text: string, redactions: Redaction[]): string {
  if (redactions.length === 0) return text;
  const sorted = [...redactions].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });
  let out = "";
  let cursor = 0;
  for (const redaction of sorted) {
    if (redaction.end <= cursor) continue;
    if (redaction.start < cursor) continue;
    out += text.slice(cursor, redaction.start);
    out += redaction.replacement;
    cursor = redaction.end;
  }
  out += text.slice(cursor);
  return out;
}

function shannonEntropy(value: string): number {
  if (!value) return 0;
  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  const len = value.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isHex(value: string): boolean {
  return /^[A-Fa-f0-9]+$/.test(value);
}

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
  const redactionOffset = groupText ? matchText.indexOf(groupText) : 0;
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
    detector.redact === "full" ? redactPemBlock(matchText) : maskToken(redactionText);
  redactions.push({ start, end, replacement, detector: detector.id });
}

function addRegexDetections(
  text: string,
  matches: SecretScanMatch[],
  redactions: Redaction[],
  seen: Set<string>,
): void {
  for (const detector of COMPILED_DETECTORS) {
    execAll(detector.re, text, (match) => {
      const full = match[0];
      if (!full) return;
      const start = match.index ?? 0;
      const groupText = detector.group ? match[detector.group] : undefined;
      addMatch(matches, redactions, seen, detector, start, full, groupText);
    });
  }
}

function addEntropyDetections(
  text: string,
  matches: SecretScanMatch[],
  redactions: Redaction[],
  seen: Set<string>,
): void {
  const addEntropyMatch = (
    token: string,
    start: number,
    kind: DetectorKind,
    confidence: SecretScanMatch["confidence"],
  ) => {
    const end = start + token.length;
    const key = `entropy:${start}:${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push({ detector: "entropy", kind, confidence, start, end });
    redactions.push({ start, end, replacement: maskToken(token), detector: "entropy" });
  };

  execAll(HEX_RE, text, (match) => {
    const token = match[0];
    if (!token) return;
    const entropy = shannonEntropy(token);
    if (entropy < HEX_ENTROPY_THRESHOLD) return;
    const start = match.index ?? 0;
    addEntropyMatch(token, start, "entropy", "low");
  });

  execAll(BASE64_RE, text, (match) => {
    const token = match[0];
    if (!token || isHex(token)) return;
    const entropy = shannonEntropy(token);
    if (entropy < BASE64_ENTROPY_THRESHOLD) return;
    const start = match.index ?? 0;
    addEntropyMatch(token, start, "entropy", "low");
  });

  execAll(BASE64URL_RE, text, (match) => {
    const token = match[0];
    if (!token || isHex(token)) return;
    const entropy = shannonEntropy(token);
    if (entropy < BASE64_ENTROPY_THRESHOLD) return;
    const start = match.index ?? 0;
    addEntropyMatch(token, start, "entropy", "low");
  });
}

export function scanText(input: string, options: SecretScanOptions = {}): SecretScanResult {
  const config = resolveSecretScanConfig(options.config);
  if (config.mode === "off") {
    return { blocked: false, matches: [], truncated: false };
  }

  const source = input ?? "";
  const inputChars = source.length;
  let text = source;
  let truncated = false;

  if (inputChars > config.maxChars) {
    if (config.overflow === "block") {
      return { blocked: true, reason: "too_long", matches: [], truncated: false };
    }
    truncated = true;
    text = source.slice(0, config.maxChars);
    options.warn?.(buildTruncateWarning(config.maxChars, inputChars));
  }

  const matches: SecretScanMatch[] = [];
  const redactions: Redaction[] = [];
  const seen = new Set<string>();

  addRegexDetections(text, matches, redactions, seen);
  addEntropyDetections(text, matches, redactions, seen);

  const shouldRedactOutput = config.mode === "redact" || matches.length > 0 || truncated;
  const redactedBase = shouldRedactOutput ? applyRedactions(text, redactions) : undefined;
  const redactedText = shouldRedactOutput
    ? truncated
      ? `${redactedBase ?? text}${source.slice(text.length)}`
      : redactedBase
    : undefined;

  if (matches.length > 0 && config.mode === "block") {
    return {
      blocked: true,
      reason: "match",
      matches,
      truncated,
      redactedText,
    };
  }

  return {
    blocked: false,
    matches,
    truncated,
    redactedText,
  };
}

export { resolveSecretScanConfig, buildTruncateWarning };
