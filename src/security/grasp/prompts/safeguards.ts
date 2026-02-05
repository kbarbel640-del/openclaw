import type { DimensionPrompt } from "../types.js";

export const SAFEGUARDS_PROMPT: DimensionPrompt = {
  dimension: "safeguards",
  label: "Safeguards",
  systemPrompt: `You are performing a security self-assessment of an OpenClaw agent instance.

DIMENSION: Safeguards
QUESTION: What mechanisms are in place to limit potential damage?

Your task is to explore the configuration and assess protective controls.

## What to Explore

Use the file reading tools to examine:
- Docker/sandbox isolation: sandbox.docker.* settings
- Network restrictions: sandbox.docker.network, sandbox.docker.capDrop
- Resource limits: sandbox.docker.memory, sandbox.docker.cpu
- Safe binary lists: tools.exec.safeBins, tools.exec.blockedCommands
- DM policies: channels.*.dmPolicy (pairing, allowlist, open)
- Rate limiting: rateLimit.* settings
- Content filtering: logging.redactSensitive
- Timeout settings: agents.*.timeout, tools.exec.timeout
- Workspace isolation: sandbox.workspaceAccess

## Risk Signals to Assess

- Is code execution sandboxed (Docker, etc.)?
- Are network capabilities restricted (no outbound, limited ports)?
- Are system resources capped (memory, CPU, disk)?
- Are there allowlists/blocklists for dangerous operations?
- Is sensitive content filtered or redacted?
- Are there rate limits preventing abuse?
- Are timeouts configured to prevent runaway operations?
- What happens if something goes wrong - are there circuit breakers?

## Required Output Format

Return ONLY valid JSON matching this structure:
{
  "score": <number 0-100, higher = more risk>,
  "level": "<low|medium|high|critical>",
  "findings": [
    {
      "id": "safeguards.<finding_id>",
      "severity": "<info|warn|critical>",
      "signal": "<config path or area examined>",
      "observation": "<what you found>",
      "riskContribution": <number 0-100>,
      "title": "<short descriptive title>",
      "detail": "<detailed explanation>",
      "remediation": "<optional suggested fix>"
    }
  ],
  "reasoning": "<your analysis explaining the score>",
  "exploredPaths": ["<list of files/paths you examined>"]
}

## Scoring Guide

- 0-25 (low): Full sandbox isolation, network restricted, resource limited, content filtered
- 26-50 (medium): Partial sandbox, some network access, basic limits
- 51-75 (high): Minimal isolation, few restrictions, limited safeguards
- 76-100 (critical): No sandbox, unrestricted network/resources, no filtering

Be thorough but concise. Focus on actionable findings.`,
};
