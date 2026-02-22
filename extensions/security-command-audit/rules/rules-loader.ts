import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { DetectionPlatform, DetectionRule } from "../destructive/detector.js";

export type RegexSpec = { pattern: string; flags?: string };

export type JsonDetectionRule = Omit<DetectionRule, "regex"> & { regex: RegexSpec };

function readJsonRelative<T>(relativeToThisFile: string): T {
  const filePath = fileURLToPath(new URL(relativeToThisFile, import.meta.url));
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function compileRegex(spec: RegexSpec, hint: string): RegExp {
  const pattern = spec.pattern ?? "";
  const flags = spec.flags ?? "i";
  try {
    return new RegExp(pattern, flags);
  } catch (err) {
    throw new Error(`[security-command-audit] invalid regex (${hint}): ${String(err)}`);
  }
}

function normalizePlatform(value: unknown): DetectionPlatform {
  if (value === "all" || value === "linux" || value === "windows") {
    return value;
  }
  return "all";
}

export function loadBuiltinDestructiveRules(): {
  common: DetectionRule[];
  linux: DetectionRule[];
  windows: DetectionRule[];
} {
  // Built-in rule files are static; cache compiled output to avoid re-reading on every tool call.
  if (cachedDestructiveRules) {
    return cachedDestructiveRules;
  }
  const common = readJsonRelative<JsonDetectionRule[]>("./destructive.common.json").map((r) => ({
    ...r,
    platform: normalizePlatform(r.platform),
    regex: compileRegex(r.regex, r.rule),
  }));
  const linux = readJsonRelative<JsonDetectionRule[]>("./destructive.linux.json").map((r) => ({
    ...r,
    platform: normalizePlatform(r.platform),
    regex: compileRegex(r.regex, r.rule),
  }));
  const windows = readJsonRelative<JsonDetectionRule[]>("./destructive.windows.json").map((r) => ({
    ...r,
    platform: normalizePlatform(r.platform),
    regex: compileRegex(r.regex, r.rule),
  }));
  cachedDestructiveRules = { common, linux, windows };
  return cachedDestructiveRules;
}

export type ExternalDomainRulesJson = {
  internalAllowlistSource: string;
  common: {
    hasHttp: RegexSpec;
    urlHost: RegexSpec;
    ftpSftpUrlHost: RegexSpec;
    bareHost: RegexSpec;
    remoteHostColon: RegexSpec;
    scpUserAtHost: RegexSpec;
    curlExfil: RegexSpec;
    wgetExfil: RegexSpec;
    sftpForbidden: RegexSpec;
    lftpForbidden: RegexSpec;
    ftpForbidden: RegexSpec;
    ftpSftpHostArg: RegexSpec;
    transferUpload: RegexSpec;
  };
  linux: { exfilPlatformIndicator: RegexSpec; devTcpHost: RegexSpec };
  windows: { exfilPlatformIndicator: RegexSpec };
};

export type ExternalDomainRulesCompiled = {
  internalAllowlistSource: string;
  internalHostRe: RegExp;
  HAS_HTTP_RE: RegExp;
  URL_HOST_RE: RegExp;
  FTP_SFTP_URL_HOST_RE: RegExp;
  BARE_HOST_RE: RegExp;
  REMOTE_HOST_COLON_RE: RegExp;
  SCP_USER_AT_HOST_RE: RegExp;
  CURL_EXFIL_RE: RegExp;
  WGET_EXFIL_RE: RegExp;
  SFTP_FORBIDDEN_RE: RegExp;
  LFTP_FORBIDDEN_RE: RegExp;
  FTP_FORBIDDEN_RE: RegExp;
  FTP_SFTP_HOST_ARG_RE: RegExp;
  EXFIL_TRANSFER_UPLOAD_RE: RegExp;
  DEV_TCP_HOST_RE: RegExp;
  EXFIL_PLATFORM_INDICATOR_RE_LINUX: RegExp;
  EXFIL_PLATFORM_INDICATOR_RE_WINDOWS: RegExp;
};

export function loadBuiltinExternalDomainRules(): ExternalDomainRulesCompiled {
  if (cachedExternalDomainRules) {
    return cachedExternalDomainRules;
  }
  const raw = readJsonRelative<ExternalDomainRulesJson>("./external-domain.json");
  const envOverride = process.env.SECURITY_COMMAND_INTERNAL_ALLOWLIST_SOURCE?.trim();
  const internalAllowlistSource = envOverride?.length
    ? envOverride
    : (raw.internalAllowlistSource ?? "");
  const internalHostRe = compileRegex(
    { pattern: `^${internalAllowlistSource}`, flags: "i" },
    "internalAllowlist",
  );

  cachedExternalDomainRules = {
    internalAllowlistSource,
    internalHostRe,
    HAS_HTTP_RE: compileRegex(raw.common.hasHttp, "hasHttp"),
    URL_HOST_RE: compileRegex(raw.common.urlHost, "urlHost"),
    FTP_SFTP_URL_HOST_RE: compileRegex(raw.common.ftpSftpUrlHost, "ftpSftpUrlHost"),
    BARE_HOST_RE: compileRegex(raw.common.bareHost, "bareHost"),
    REMOTE_HOST_COLON_RE: compileRegex(raw.common.remoteHostColon, "remoteHostColon"),
    SCP_USER_AT_HOST_RE: compileRegex(raw.common.scpUserAtHost, "scpUserAtHost"),
    CURL_EXFIL_RE: compileRegex(raw.common.curlExfil, "curlExfil"),
    WGET_EXFIL_RE: compileRegex(raw.common.wgetExfil, "wgetExfil"),
    SFTP_FORBIDDEN_RE: compileRegex(raw.common.sftpForbidden, "sftpForbidden"),
    LFTP_FORBIDDEN_RE: compileRegex(raw.common.lftpForbidden, "lftpForbidden"),
    FTP_FORBIDDEN_RE: compileRegex(raw.common.ftpForbidden, "ftpForbidden"),
    FTP_SFTP_HOST_ARG_RE: compileRegex(raw.common.ftpSftpHostArg, "ftpSftpHostArg"),
    EXFIL_TRANSFER_UPLOAD_RE: compileRegex(raw.common.transferUpload, "transferUpload"),
    DEV_TCP_HOST_RE: compileRegex(raw.linux.devTcpHost, "devTcpHost"),
    EXFIL_PLATFORM_INDICATOR_RE_LINUX: compileRegex(
      raw.linux.exfilPlatformIndicator,
      "linuxExfilIndicator",
    ),
    EXFIL_PLATFORM_INDICATOR_RE_WINDOWS: compileRegex(
      raw.windows.exfilPlatformIndicator,
      "windowsExfilIndicator",
    ),
  };
  return cachedExternalDomainRules;
}

let cachedDestructiveRules:
  | {
      common: DetectionRule[];
      linux: DetectionRule[];
      windows: DetectionRule[];
    }
  | undefined;
let cachedExternalDomainRules: ExternalDomainRulesCompiled | undefined;
