import type { SecretScanLogMatches, SecretScanMode, SecretScanOverflow } from "./types.js";

export const DEFAULT_SECRET_SCAN_MODE: SecretScanMode = "off";
export const DEFAULT_SECRET_SCAN_MAX_CHARS = 32_768;
export const DEFAULT_SECRET_SCAN_OVERFLOW: SecretScanOverflow = "truncate";
export const DEFAULT_SECRET_SCAN_LOG_MATCHES: SecretScanLogMatches = "off";

export const DEFAULT_REDACT_MIN_LENGTH = 18;
export const DEFAULT_REDACT_KEEP_START = 6;
export const DEFAULT_REDACT_KEEP_END = 4;

export const BASE64_MIN_LENGTH = 20;
export const BASE64URL_MIN_LENGTH = 20;
export const HEX_MIN_LENGTH = 32;

export const BASE64_ENTROPY_THRESHOLD = 4.5;
export const HEX_ENTROPY_THRESHOLD = 3.0;
