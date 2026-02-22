import type { DestructiveMatch } from "../destructive/detector.js";
import type { ExternalDomainRulesCompiled } from "../rules/rules-loader.js";
import { loadBuiltinExternalDomainRules } from "../rules/rules-loader.js";

function normalizeHost(host: string): string {
  let h = (host || "").trim();
  // strip brackets for IPv6 like [::1]
  if (h.startsWith("[") && h.endsWith("]")) {
    h = h.slice(1, -1);
  }
  // strip trailing punctuation
  h = h.replace(/[),.;]+$/, "");
  return h.toLowerCase();
}

function isInternalHost(host: string, rules: ExternalDomainRulesCompiled): boolean {
  const h = normalizeHost(host);
  if (!h) return true;
  return rules.internalHostRe.test(h);
}

function extractHosts(command: string, rules: ExternalDomainRulesCompiled): string[] {
  const hosts: string[] = [];
  const s = command || "";
  const isTransferUpload = rules.EXFIL_TRANSFER_UPLOAD_RE.test(s);
  const isSftpLike = rules.SFTP_FORBIDDEN_RE.test(s);
  const isFtpLike = rules.FTP_FORBIDDEN_RE.test(s);
  const isLftpLike = rules.LFTP_FORBIDDEN_RE.test(s);
  const skipBareHosts = isTransferUpload || isSftpLike || isFtpLike || isLftpLike;

  // URLs
  for (const m of s.matchAll(rules.URL_HOST_RE)) {
    const host = m[1];
    if (host) hosts.push(host);
  }
  // ftp/sftp URLs (sftp://, ftp://, ftps://)
  for (const m of s.matchAll(rules.FTP_SFTP_URL_HOST_RE)) {
    const host = m[1];
    if (host) hosts.push(host);
  }
  // scp/ssh like user@host
  for (const m of s.matchAll(rules.SCP_USER_AT_HOST_RE)) {
    const host = m[1];
    if (host) hosts.push(host);
  }
  // scp/rsync remote spec like host:/path (with or without user@)
  for (const m of s.matchAll(rules.REMOTE_HOST_COLON_RE)) {
    const host = m[1];
    if (host) hosts.push(host);
  }
  // ftp/sftp host argument (with or without user@)
  for (const m of s.matchAll(rules.FTP_SFTP_HOST_ARG_RE)) {
    const host = m[1];
    if (host) hosts.push(host);
  }
  // /dev/tcp|udp/<host>/<port>
  for (const m of s.matchAll(rules.DEV_TCP_HOST_RE)) {
    const host = m[1];
    if (host) hosts.push(host);
  }
  // Bare hosts / IPv4
  // NOTE: for transfer tools (scp/rsync), do NOT extract generic "bare hosts",
  // otherwise local filenames like `test3.py` may be mis-detected as a host.
  if (!skipBareHosts) {
    for (const m of s.matchAll(rules.BARE_HOST_RE)) {
      const host = m[1];
      if (host) hosts.push(host);
    }
  }
  return hosts;
}

export function detectExternalDomainViolation(
  command: string,
  osType?: "linux" | "windows" | "darwin",
  rules?: ExternalDomainRulesCompiled,
): DestructiveMatch | undefined {
  const compiled = rules ?? loadBuiltinExternalDomainRules();
  const full = (command || "").trim();
  if (!full) return undefined;

  // Directly forbid ftp (do not depend on host extraction or allowlist).
  if (compiled.FTP_FORBIDDEN_RE.test(full)) {
    return {
      category: "network_destructive",
      severity: "violation",
      rule: "violation.ftp_forbidden",
      reason: "检测到 ftp 命令（高风险数据传输），策略禁止执行",
    };
  }
  // Directly forbid sftp/lftp (do not depend on host extraction or allowlist).
  if (compiled.SFTP_FORBIDDEN_RE.test(full)) {
    return {
      category: "network_destructive",
      severity: "violation",
      rule: "violation.sftp_forbidden",
      reason: "检测到 sftp 命令（高风险数据传输），策略禁止执行",
    };
  }
  if (compiled.LFTP_FORBIDDEN_RE.test(full)) {
    return {
      category: "network_destructive",
      severity: "violation",
      rule: "violation.lftp_forbidden",
      reason: "检测到 lftp 命令（高风险数据传输），策略禁止执行",
    };
  }

  const EXFIL_LINUX_RE = compiled.EXFIL_PLATFORM_INDICATOR_RE_LINUX;
  const EXFIL_WINDOWS_RE = compiled.EXFIL_PLATFORM_INDICATOR_RE_WINDOWS;
  const platform = osType === "windows" ? "windows" : "linux";
  const platformIndicator = platform === "windows" ? EXFIL_WINDOWS_RE : EXFIL_LINUX_RE;

  // Only trigger external-domain checks when there are explicit exfil indicators.
  // This avoids blocking simple browsing like: `curl www.baidu.com`
  const looksLikeExfil =
    platformIndicator.test(full) ||
    compiled.CURL_EXFIL_RE.test(full) ||
    compiled.WGET_EXFIL_RE.test(full) ||
    compiled.EXFIL_TRANSFER_UPLOAD_RE.test(full);
  if (!looksLikeExfil) {
    return undefined;
  }

  // Host extraction is allowed for both URL and non-URL commands.
  // If you want to require http(s) URLs only, tighten this by checking HAS_HTTP_RE.
  if (
    !compiled.HAS_HTTP_RE.test(full) &&
    !compiled.EXFIL_TRANSFER_UPLOAD_RE.test(full) &&
    !compiled.CURL_EXFIL_RE.test(full) &&
    !compiled.WGET_EXFIL_RE.test(full) &&
    !platformIndicator.test(full)
  ) {
    return undefined;
  }

  const hosts = extractHosts(full, compiled).map(normalizeHost).filter(Boolean);

  if (hosts.length === 0) {
    return undefined;
  }

  for (const h of hosts) {
    if (!isInternalHost(h, compiled)) {
      return {
        category: "network_destructive",
        severity: "violation",
        rule: "violation.external_domain",
        reason: `检测到外部域名/IP 访问（疑似数据外发）：${h}`,
      };
    }
  }

  return undefined;
}
