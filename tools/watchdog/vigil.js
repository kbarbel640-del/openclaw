#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const readline = require("readline");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const targetArg = args.find((a) => !a.startsWith("--"));

if (!targetArg || flags.has("--help") || flags.has("-h")) {
  console.log("Usage: node scan.js <path-to-repo> [--json] [--fix]");
  process.exit(targetArg ? 0 : 1);
}

const targetRoot = path.resolve(process.cwd(), targetArg);
if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
  console.error("Invalid path:", targetRoot);
  process.exit(1);
}

const wantJson = flags.has("--json");
const wantFix = flags.has("--fix");
const start = Date.now();

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

const sevColor = {
  CRITICAL: COLORS.red,
  HIGH: COLORS.yellow,
  MEDIUM: COLORS.blue,
  LOW: COLORS.gray,
};

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  ".next",
  ".venv",
  "venv",
]);
const CODE_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".rs"]);

// .vigilignore support
const vigilIgnorePath = path.join(targetRoot, ".vigilignore");
const ignoredFiles = new Set();
if (fs.existsSync(vigilIgnorePath)) {
  fs.readFileSync(vigilIgnorePath, "utf8")
    .split("\n")
    .forEach((l) => {
      l = l.trim();
      if (l && !l.startsWith("#")) {
        ignoredFiles.add(l);
      }
    });
}

const findings = [];
let filesScanned = 0;

function addFinding({ severity, type, file, line, description, fix }) {
  findings.push({
    severity,
    type,
    file: path.relative(targetRoot, file),
    line,
    description,
    ...(fix ? { fix } : {}),
  });
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) {
        continue;
      }
      walk(full, out);
    } else if (e.isFile()) {
      const rel = path.relative(targetRoot, full);
      if (ignoredFiles.has(e.name) || ignoredFiles.has(rel)) {
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (CODE_EXT.has(ext) || e.name === "package.json") {
        out.push(full);
      }
    }
  }
  return out;
}

const SECRET_PATTERNS = [
  {
    re: /AKIA[0-9A-Z]{16}/g,
    severity: "CRITICAL",
    type: "Hardcoded AWS Access Key",
    fix: "Move key to environment variable and rotate the credential.",
  },
  {
    re: /gh[pousr]_[A-Za-z0-9_]{20,}/g,
    severity: "CRITICAL",
    type: "Hardcoded GitHub Token",
    fix: "Use a secret manager/env var and revoke exposed token.",
  },
  {
    re: /sk_live_[0-9a-zA-Z]{16,}/g,
    severity: "CRITICAL",
    type: "Hardcoded Stripe Live Key",
    fix: "Never store live keys in code; load from secure runtime config.",
  },
  {
    re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\n]{8,}['"]/gi,
    severity: "HIGH",
    type: "Possible Hardcoded Secret",
    fix: "Replace hardcoded secret with env var and rotate if real.",
  },
  {
    re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
    severity: "HIGH",
    type: "Possible Embedded Bearer Token",
    fix: "Do not embed bearer tokens in source files.",
  },
];

const RULES = [
  {
    // SQL injection by concatenation/interpolation
    test: (line) => /(SELECT|INSERT|UPDATE|DELETE).*(\+|\$\{|%s|format\(|f["'])/i.test(line),
    severity: "HIGH",
    type: "Possible SQL Injection",
    desc: "SQL query appears dynamically built using concatenation/interpolation.",
    fix: "Use parameterized queries/prepared statements.",
  },
  {
    test: (line) => /\b(innerHTML\s*=|dangerouslySetInnerHTML)\b/.test(line),
    severity: "HIGH",
    type: "Potential XSS Sink",
    desc: "Direct HTML injection sink used.",
    fix: "Sanitize input or use safe text rendering APIs.",
  },
  {
    test: (line) => /<[^>]*\$\{[^}]+\}[^>]*>/.test(line),
    severity: "MEDIUM",
    type: "Potential Unsanitized Template HTML",
    desc: "Template literal appears inside HTML context.",
    fix: "Escape/sanitize interpolated values before rendering.",
  },
  {
    test: (line) =>
      /\b(res\.(redirect|writeHead)\(|window\.location\s*=|location\.href\s*=)/.test(line) &&
      /(req\.|params\.|query\.|input|user)/i.test(line),
    severity: "HIGH",
    type: "Possible Open Redirect",
    desc: "Redirect may include untrusted input.",
    fix: "Allowlist destination domains/paths before redirect.",
  },
  {
    test: (line) =>
      /(\.\.[/\\]|path\.join\(|sendFile\(|open\()/.test(line) &&
      /(req\.|params\.|query\.|input|user)/i.test(line),
    severity: "HIGH",
    type: "Possible Path Traversal",
    desc: "Filesystem path may include untrusted input.",
    fix: "Normalize and constrain to allowlisted base directory.",
  },
  {
    test: (line) => /\b(md5|sha1)\s*\(/i.test(line) && /(pass|password|pwd|hash)/i.test(line),
    severity: "HIGH",
    type: "Insecure Password Hashing",
    desc: "MD5/SHA1 appears used for password-related hashing.",
    fix: "Use bcrypt, scrypt, or Argon2 with salt.",
  },
  {
    test: (line) =>
      /(Access-Control-Allow-Origin\s*[:=]\s*['"]\*['"]|cors\(\s*\{[^}]*origin\s*:\s*['"]\*['"])/i.test(
        line,
      ),
    severity: "MEDIUM",
    type: "Permissive CORS",
    desc: "CORS configured with wildcard origin.",
    fix: "Restrict origins to trusted domains.",
  },
  {
    test: (line) => /\b(eval\s*\(|new\s+Function\s*\(|exec\s*\(|spawn\s*\(|popen\s*\()/i.test(line),
    severity: "MEDIUM",
    type: "Dynamic Code/Command Execution",
    desc: "Potentially dangerous execution API used.",
    fix: "Avoid dynamic execution; validate input and use safer APIs.",
  },
];

function scanPackageJson(file) {
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return;
  }
  const deps = Object.assign(
    {},
    obj.dependencies || {},
    obj.devDependencies || {},
    obj.optionalDependencies || {},
  );
  const riskyNames = new Set(["event-stream", "node-serialize", "serialize-javascript"]);
  const insecureRanges = [/^\s*\*\s*$/, /^\s*latest\s*$/i, /^\s*[<>~^]?0\./];

  for (const [name, ver] of Object.entries(deps)) {
    if (riskyNames.has(name)) {
      addFinding({
        severity: "HIGH",
        type: "Risky Dependency",
        file,
        line: 1,
        description: `Dependency "${name}" is frequently flagged in supply-chain incidents.`,
        fix: "Review necessity, pin a safe version, and monitor advisories.",
      });
    }
    if (
      typeof ver === "string" &&
      (ver.startsWith("http:") ||
        ver.includes("github:") ||
        insecureRanges.some((r) => r.test(ver)))
    ) {
      addFinding({
        severity: "MEDIUM",
        type: "Potentially Insecure Dependency Version",
        file,
        line: 1,
        description: `Dependency "${name}" uses risky specifier "${ver}".`,
        fix: "Pin to reviewed semver versions and avoid URL-based installs.",
      });
    }
  }
}

function scanCodeFile(file) {
  filesScanned += 1;
  const input = fs.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNo = 0;

  return new Promise((resolve) => {
    rl.on("line", (line) => {
      lineNo += 1;
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(line)) {
          addFinding({
            severity: p.severity,
            type: p.type,
            file,
            line: lineNo,
            description: "Pattern matched a potential hardcoded secret/token.",
            fix: p.fix,
          });
        }
        p.re.lastIndex = 0;
      }
      for (const r of RULES) {
        if (r.test(line)) {
          addFinding({
            severity: r.severity,
            type: r.type,
            file,
            line: lineNo,
            description: r.desc,
            fix: r.fix,
          });
        }
      }
    });
    rl.on("close", resolve);
    rl.on("error", resolve);
  });
}

function scanEnvCommitted() {
  try {
    const tracked = cp
      .execSync("git ls-files", { cwd: targetRoot, stdio: ["ignore", "pipe", "ignore"] })
      .toString();
    const trackedEnv = tracked.split("\n").filter((f) => /(^|\/)\.env(\.|$)/.test(f));
    for (const f of trackedEnv) {
      addFinding({
        severity: "CRITICAL",
        type: ".env File Tracked in Git",
        file: path.join(targetRoot, f),
        line: 1,
        description: ".env-like file is tracked in git history/index.",
        fix: "Remove from git, rotate secrets, and add .env* to .gitignore.",
      });
    }

    const status = cp
      .execSync("git status --porcelain", { cwd: targetRoot, stdio: ["ignore", "pipe", "ignore"] })
      .toString();
    const statusEnv = status
      .split("\n")
      .map((l) => l.slice(3))
      .filter((f) => /(^|\/)\.env(\.|$)/.test(f));
    for (const f of statusEnv) {
      addFinding({
        severity: "HIGH",
        type: ".env File Present in Git Changes",
        file: path.join(targetRoot, f),
        line: 1,
        description: ".env-like file appears in git status output.",
        fix: "Unstage/remove and add .env patterns to .gitignore.",
      });
    }
  } catch {
    // Not a git repo or git unavailable.
  }
}

async function run() {
  const files = walk(targetRoot);
  for (const file of files) {
    if (path.basename(file) === "package.json") {
      scanPackageJson(file);
    } else {
      await scanCodeFile(file);
    }
  }
  scanEnvCommitted();

  const summary = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) {
    summary[f.severity] = (summary[f.severity] || 0) + 1;
  }
  const elapsedMs = Date.now() - start;

  if (wantJson) {
    console.log(
      JSON.stringify(
        {
          target: targetRoot,
          filesScanned,
          elapsedMs,
          summary,
          findings,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`\nSecurity Scan Report: ${targetRoot}`);
  console.log("=".repeat(80));

  if (!findings.length) {
    console.log("No findings. ✅");
  } else {
    for (const f of findings) {
      const color = sevColor[f.severity] || "";
      const reset = color ? COLORS.reset : "";
      console.log(`${color}[${f.severity}]${reset} ${f.type}`);
      console.log(`  File: ${f.file}:${f.line}`);
      console.log(`  Desc: ${f.description}`);
      if (wantFix && f.fix) {
        console.log(`  Fix:  ${f.fix}`);
      }
      console.log("");
    }
  }

  console.log("-".repeat(80));
  console.log(
    `Summary: CRITICAL=${summary.CRITICAL} HIGH=${summary.HIGH} MEDIUM=${summary.MEDIUM} LOW=${summary.LOW}`,
  );
  console.log(`Files scanned: ${filesScanned}`);
  console.log(`Time elapsed: ${(elapsedMs / 1000).toFixed(2)}s\n`);
}

run().catch((err) => {
  console.error("Scan failed:", err.message);
  process.exit(1);
});
