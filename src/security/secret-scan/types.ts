import type {
  SecretScanLogMatches,
  SecretScanMode,
  SecretScanOverflow,
  SecretScanningConfig,
} from "../../config/types.security.js";

export type { SecretScanLogMatches, SecretScanMode, SecretScanOverflow, SecretScanningConfig };

export type SecretScanReason = "match" | "too_long";

export type SecretScanMatch = {
  detector: string;
  kind: "format" | "entropy" | "heuristic";
  confidence: "high" | "medium" | "low";
  start: number;
  end: number;
};

export type SecretScanResult = {
  blocked: boolean;
  reason?: SecretScanReason;
  matches: SecretScanMatch[];
  truncated: boolean;
  redactedText?: string;
};

export type SecretScanWarning = {
  kind: "truncated";
  message: string;
  maxChars: number;
  inputChars: number;
};

export type SecretScanOptions = {
  config?: SecretScanningConfig;
  warn?: (warning: SecretScanWarning) => void;
};
