export type SecretScanMode = "off" | "redact" | "block";
export type SecretScanOverflow = "truncate" | "block";
export type SecretScanLogMatches = "off" | "redacted";

export type SecretScanningConfig = {
  mode?: SecretScanMode;
  maxChars?: number;
  overflow?: SecretScanOverflow;
  logSecretMatches?: SecretScanLogMatches;
};

export type SecurityConfig = {
  secretScanning?: SecretScanningConfig;
};
