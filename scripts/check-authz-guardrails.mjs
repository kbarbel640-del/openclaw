import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

/**
 * File-level guardrail checks to catch accidental upgrade regressions.
 * These are intentionally strict and fail closed.
 */
const checks = [
  {
    file: "src/agents/tools/sessions-send-tool.ts",
    patterns: [
      /classifyHighRiskAuthorizationMessage/,
      /Authorization-style relays require direct user input/,
      /Authorization-style relays are fail-closed/,
      /Authorization relay missing AUTHZ_TOKEN marker/,
      /consumeAuthorizationGrant\(/,
      /requiredProvenanceKind:\s*"external_user"/,
    ],
  },
  {
    file: "src/agents/tools/sessions-authorize-tool.ts",
    patterns: [
      /name:\s*"sessions_authorize"/,
      /ownerOnly:\s*true/,
      /provenanceKind !== "external_user"/,
      /senderIsOwner !== true/,
      /issueAuthorizationGrant\(/,
      /AUTHZ_TOKEN:/,
    ],
  },
  {
    file: "src/agents/openclaw-tools.ts",
    patterns: [
      /createSessionsAuthorizeTool\(/,
      /requestInputProvenance:\s*options\?\.requestInputProvenance/,
      /senderIsOwner:\s*options\?\.senderIsOwner/,
    ],
  },
  {
    file: "src/auto-reply/reply/get-reply-run.ts",
    patterns: [/inputProvenance:\s*{[\s\S]*kind:\s*"external_user"/],
  },
  {
    file: "src/security/dangerous-tools.ts",
    patterns: [
      /DEFAULT_GATEWAY_HTTP_TOOL_DENY/,
      /"sessions_authorize"/,
      /DANGEROUS_ACP_TOOL_NAMES/,
    ],
  },
  {
    file: "src/agents/pi-tools.policy.ts",
    patterns: [/SUBAGENT_TOOL_DENY_ALWAYS/, /"sessions_authorize"/],
  },
  {
    file: "src/agents/tool-mutation.ts",
    patterns: [/MUTATING_TOOL_NAMES/, /"sessions_authorize"/, /case "sessions_authorize":/],
  },
];

let failures = 0;

for (const check of checks) {
  const absPath = path.join(root, check.file);
  if (!fs.existsSync(absPath)) {
    console.error(`authz-guardrail: missing file ${check.file}`);
    failures += 1;
    continue;
  }

  const content = fs.readFileSync(absPath, "utf8");
  for (const pattern of check.patterns) {
    if (!pattern.test(content)) {
      console.error(`authz-guardrail: missing pattern ${pattern} in ${check.file}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  console.error(
    `authz-guardrail: failed (${failures} missing invariant${failures === 1 ? "" : "s"})`,
  );
  process.exit(1);
}

console.log("authz-guardrail: all invariants satisfied");
