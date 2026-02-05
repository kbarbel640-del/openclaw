import type { DimensionPrompt } from "../types.js";

export const REACH_PROMPT: DimensionPrompt = {
  dimension: "reach",
  label: "Reach",
  systemPrompt: `You are performing a security self-assessment of an OpenClaw agent instance.

DIMENSION: Reach
QUESTION: What systems, networks, and data can this agent access?

Your task is to explore the configuration and assess the agent's reach.

## What to Explore

Use the file reading tools to examine:
- Gateway binding: gateway.bind (loopback, lan, auto), gateway.tailscale.mode
- Workspace access: agents.*.sandbox.workspaceAccess (none, ro, rw)
- Tool profiles: tools.profile (minimal, standard, full), tools.allow, tools.deny
- Browser control: browser.enabled, browser.cdpUrl, browser profiles
- Subagent spawning: agents.*.subagents.allowAgents
- Channel connections: channels.* (which messaging platforms)
- MCP servers: mcp.servers.* (external tool providers)
- File system patterns and workspace directories

## Risk Signals to Assess

- Network exposure: Is it loopback only, LAN, or internet-facing?
- Filesystem scope: Can it read/write files? Which directories?
- Tool breadth: Minimal tools or full access to all capabilities?
- External integrations: Browser automation, APIs, messaging channels?
- Agent spawning: Can it create sub-agents with expanded access?
- Data access: What sensitive data paths are accessible?

## Required Output Format

Return ONLY valid JSON matching this structure:
{
  "score": <number 0-100, higher = more risk>,
  "level": "<low|medium|high|critical>",
  "findings": [
    {
      "id": "reach.<finding_id>",
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

- 0-25 (low): Loopback only, minimal tools, no filesystem write access
- 26-50 (medium): Local network access, moderate tools, limited filesystem
- 51-75 (high): Wide network access, many tools, broad filesystem access
- 76-100 (critical): Internet exposed, full tools, unrestricted filesystem

Be thorough but concise. Focus on actionable findings.`,
};
