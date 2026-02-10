/**
 * Knowledge Scout — self-improvement through online research.
 *
 * Periodically searches Reddit, Hacker News, and forums for:
 * - New techniques for local LLM routing/agents
 * - Prompt engineering tips
 * - Skill automation patterns
 * - Security hardening advice
 *
 * Summarises findings and proposes skill/config improvements.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ModelRef } from "../types.js";
import { callModelSimple } from "../shared/pi-bridge.js";
import { search } from "../tools/search.js";
import { sanitiseUntrustedInput } from "../security/guards.js";
import { loadAllSkills } from "../shared/skill-loader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoutReport {
  date: string;
  queries: string[];
  findingsCount: number;
  insights: ScoutInsight[];
  proposals: SkillProposal[];
}

export interface ScoutInsight {
  topic: string;
  summary: string;
  source: string;
  relevance: "low" | "medium" | "high";
}

export interface SkillProposal {
  id: string;
  type: "new_skill" | "improve_skill" | "new_route" | "config_change";
  title: string;
  description: string;
  implementation: string;
  source: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Search topics — what we're looking for
// ---------------------------------------------------------------------------

const SCOUT_TOPICS = [
  // LLM agent patterns
  'site:reddit.com/r/LocalLLaMA local LLM agent automation',
  'site:reddit.com/r/selfhosted AI personal assistant self-hosted',
  'site:reddit.com/r/ollama agent routing multiple models',

  // Prompt engineering
  'site:reddit.com/r/PromptEngineering prompt injection defence',
  'site:reddit.com/r/ChatGPT system prompt best practices',

  // Automation skills
  'site:reddit.com/r/automation web scraping browser automation 2025',
  'site:reddit.com/r/homeautomation AI assistant integration',

  // Agent frameworks
  'LLM agent framework comparison local models',
  'multi-agent orchestration local LLM',

  // Security
  'prompt injection prevention techniques LLM agent',
  'LLM agent security best practices',
];

// ---------------------------------------------------------------------------
// Main scout function
// ---------------------------------------------------------------------------

/**
 * Run a knowledge scout sweep.
 * Searches multiple sources, synthesises findings, proposes improvements.
 */
export async function runKnowledgeScout(params: {
  projectRoot: string;
  analysisModel: ModelRef;
  maxQueries?: number;
}): Promise<ScoutReport> {
  const { projectRoot, analysisModel } = params;
  const maxQueries = params.maxQueries ?? 6;
  const today = new Date().toISOString().split("T")[0];

  console.log("[scout] Starting knowledge scout sweep...");

  // 1. Load current skills to understand what we have
  const skills = await loadAllSkills(path.join(projectRoot, "skills"));
  const skillSummary = Array.from(skills.values())
    .map((s) => `- ${s.name} (${s.tier}): ${s.description}`)
    .join("\n");

  // 2. Load previous scout reports to avoid repeating ourselves
  const previousFindings = await loadRecentScoutReports(projectRoot, 3);

  // 3. Search across multiple topics
  const allFindings: Array<{ query: string; title: string; url: string; snippet: string }> = [];
  const queriesUsed: string[] = [];

  // Pick a rotating subset of topics so we don't search everything every time
  const shuffled = [...SCOUT_TOPICS].sort(() => Math.random() - 0.5);
  const selectedTopics = shuffled.slice(0, maxQueries);

  for (const topic of selectedTopics) {
    queriesUsed.push(topic);
    try {
      const results = await search(topic, { maxResults: 5 });
      for (const r of results.results) {
        // Sanitise search snippets
        const { sanitised } = sanitiseUntrustedInput(r.snippet, `scout:${r.url}`, "untrusted");
        allFindings.push({
          query: topic,
          title: r.title,
          url: r.url,
          snippet: sanitised,
        });
      }
    } catch {
      // Search failed for this topic — continue
    }

    // Small delay between searches to be polite
    await sleep(1000);
  }

  console.log(`[scout] Found ${allFindings.length} results across ${queriesUsed.length} queries`);

  if (allFindings.length === 0) {
    const emptyReport: ScoutReport = {
      date: today,
      queries: queriesUsed,
      findingsCount: 0,
      insights: [],
      proposals: [],
    };
    await saveScoutReport(projectRoot, today, emptyReport);
    return emptyReport;
  }

  // 4. Use cloud model to analyse findings and propose improvements
  const findingsSummary = allFindings
    .map((f) => `[${f.query}] ${f.title}\nURL: ${f.url}\n${f.snippet}`)
    .join("\n\n---\n\n");

  const analysisPrompt = buildScoutAnalysisPrompt({
    findings: findingsSummary,
    currentSkills: skillSummary,
    previousFindings,
    today,
  });

  const raw = await callModelSimple(analysisModel, analysisPrompt, {
    systemPrompt: SCOUT_SYSTEM_PROMPT,
    maxTokens: 8192,
    temperature: 0.3,
  });

  // 5. Parse response
  const report = parseScoutResponse(raw, today, queriesUsed, allFindings.length);

  // 6. Save report
  await saveScoutReport(projectRoot, today, report);

  console.log(
    `[scout] Analysis complete: ${report.insights.length} insights, ${report.proposals.length} proposals`,
  );

  return report;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SCOUT_SYSTEM_PROMPT = `You are a knowledge scout for a personal AI assistant system.
You analyse search results from Reddit, Hacker News, and tech forums to find useful techniques,
patterns, and ideas that could improve the system.

The system is a local LLM router with 4 agents (comms, browser, coder, monitor) that routes
tasks to either local models (Ollama) or cloud (Claude API) based on intent classification.

Your output must be valid JSON:
{
  "insights": [
    {
      "topic": "Brief topic name",
      "summary": "What was learned and why it matters",
      "source": "URL",
      "relevance": "low|medium|high"
    }
  ],
  "proposals": [
    {
      "id": "scout-NNN",
      "type": "new_skill|improve_skill|new_route|config_change",
      "title": "Short title",
      "description": "What to do and why",
      "implementation": "Concrete implementation steps or SKILL.md content",
      "source": "URL that inspired this",
      "confidence": 0.0-1.0
    }
  ]
}

Focus on actionable improvements. Only propose changes with confidence > 0.6.
Prioritise security improvements, better prompt patterns, and new automation skills.
Skip anything the system already does well based on the current skills list.`;

function buildScoutAnalysisPrompt(params: {
  findings: string;
  currentSkills: string;
  previousFindings: string[];
  today: string;
}): string {
  const prevSummary = params.previousFindings.length > 0
    ? params.previousFindings.join("\n---\n")
    : "No previous scout reports.";

  return `# Knowledge Scout Analysis — ${params.today}

## Search Findings

${params.findings}

## Current Skills in the System

${params.currentSkills}

## Previous Scout Reports (avoid repeating these)

${prevSummary}

Analyse these findings. Identify useful insights and propose concrete improvements
to the system's skills, routing, or configuration. Focus on what's new and actionable.
Return your analysis as JSON.`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseScoutResponse(
  raw: string,
  date: string,
  queries: string[],
  findingsCount: number,
): ScoutReport {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { date, queries, findingsCount, insights: [], proposals: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      date,
      queries,
      findingsCount,
      insights: parsed.insights ?? [],
      proposals: parsed.proposals ?? [],
    };
  } catch {
    return { date, queries, findingsCount, insights: [], proposals: [] };
  }
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

async function saveScoutReport(
  projectRoot: string,
  date: string,
  report: ScoutReport,
): Promise<void> {
  const dir = path.join(projectRoot, "scout", "reports");
  await fs.mkdir(dir, { recursive: true });

  const markdown = [
    `# Knowledge Scout Report — ${date}`,
    "",
    `## Summary`,
    `- Queries: ${report.queries.length}`,
    `- Findings: ${report.findingsCount}`,
    `- Insights: ${report.insights.length}`,
    `- Proposals: ${report.proposals.length}`,
    "",
    ...(report.insights.length > 0
      ? [
          "## Insights",
          "",
          ...report.insights.map(
            (i) => `### ${i.topic} (${i.relevance})\n${i.summary}\nSource: ${i.source}`,
          ),
          "",
        ]
      : []),
    ...(report.proposals.length > 0
      ? [
          "## Proposals",
          "",
          ...report.proposals.map(
            (p) =>
              `### ${p.id}: ${p.title} (${p.type})\n${p.description}\nConfidence: ${(p.confidence * 100).toFixed(0)}%\nSource: ${p.source}\n\n**Implementation:**\n${p.implementation}`,
          ),
        ]
      : []),
  ].join("\n");

  await fs.writeFile(path.join(dir, `${date}.md`), markdown, "utf-8");

  // Also save proposals as individual files for the approval flow
  for (const proposal of report.proposals) {
    const proposalDir = path.join(projectRoot, "errors", "proposals", "pending");
    await fs.mkdir(proposalDir, { recursive: true });

    const proposalMd = [
      `# Scout Proposal: ${proposal.id}`,
      `> **Type**: ${proposal.type}`,
      `> **Confidence**: ${(proposal.confidence * 100).toFixed(0)}%`,
      `> **Source**: ${proposal.source}`,
      "",
      `## ${proposal.title}`,
      proposal.description,
      "",
      "## Implementation",
      proposal.implementation,
    ].join("\n");

    await fs.writeFile(
      path.join(proposalDir, `${proposal.id}.md`),
      proposalMd,
      "utf-8",
    );
  }
}

async function loadRecentScoutReports(
  projectRoot: string,
  count: number,
): Promise<string[]> {
  const dir = path.join(projectRoot, "scout", "reports");
  const reports: string[] = [];

  try {
    const files = await fs.readdir(dir);
    const sorted = files
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, count);

    for (const file of sorted) {
      const content = await fs.readFile(path.join(dir, file), "utf-8");
      reports.push(content);
    }
  } catch {
    // No reports directory yet
  }

  return reports;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
