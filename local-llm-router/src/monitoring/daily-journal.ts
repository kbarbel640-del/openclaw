/**
 * Daily Learning Journal
 *
 * Every evening, compiles a narrative summary of what the system did,
 * what it learned, what went wrong, and what it plans to improve.
 *
 * Sources:
 * - Audit log (tasks handled, by agent, by channel)
 * - Error journal (failures, rejections, corrections)
 * - Token usage (cost, model split)
 * - Scout reports (if scouting ran today)
 * - Pending proposals (improvements awaiting approval)
 *
 * The cloud model synthesises these into a human-readable daily report
 * that gets sent via Telegram and saved as a markdown file.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ModelRef, AuditEntry, ErrorEntry } from "../types.js";
import { AuditLog } from "../persistence/audit.js";
import { ErrorJournal } from "../errors/journal.js";
import { TokenTracker, type UsageSummary } from "./token-tracker.js";
import { callModelSimple } from "../shared/pi-bridge.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyJournal {
  date: string;
  taskCount: number;
  errorCount: number;
  costUsd: number;
  narrative: string;
  highlights: string[];
  lessonsLearned: string[];
  tomorrowFocus: string[];
}

// ---------------------------------------------------------------------------
// Main journal function
// ---------------------------------------------------------------------------

export async function compileDailyJournal(params: {
  projectRoot: string;
  auditLog: AuditLog;
  errorJournal: ErrorJournal;
  tokenTracker: TokenTracker;
  analysisModel: ModelRef;
}): Promise<DailyJournal> {
  const { projectRoot, auditLog, errorJournal, tokenTracker, analysisModel } = params;
  const today = new Date().toISOString().slice(0, 10);

  console.log("[journal] Compiling daily learning journal...");

  // 1. Gather today's audit entries
  const auditEntries = await auditLog.readDate(today);
  const taskSummary = summariseAuditEntries(auditEntries);

  // 2. Gather today's errors
  const errors = await errorJournal.readRecent(24);
  const errorSummary = summariseErrors(errors);

  // 3. Gather today's token usage
  const usage = await tokenTracker.todaySummary();
  const usageSummary = summariseUsage(usage);

  // 4. Check for today's scout report
  const scoutSummary = await loadTodayScoutReport(projectRoot, today);

  // 5. Check for pending proposals
  const proposalSummary = await loadPendingProposals(projectRoot);

  // 6. Load yesterday's journal for continuity
  const yesterdayJournal = await loadYesterdayJournal(projectRoot, today);

  // 7. Ask cloud model to synthesise into a narrative
  const prompt = buildJournalPrompt({
    today,
    taskSummary,
    errorSummary,
    usageSummary,
    scoutSummary,
    proposalSummary,
    yesterdayJournal,
  });

  const raw = await callModelSimple(analysisModel, prompt, {
    systemPrompt: JOURNAL_SYSTEM_PROMPT,
    maxTokens: 4096,
    temperature: 0.4,
  });

  // 8. Parse response
  const journal = parseJournalResponse(raw, today, auditEntries.length, errors.length, usage.totalCostUsd);

  // 9. Save
  await saveJournal(projectRoot, today, journal);

  console.log(`[journal] Journal saved: ${journal.highlights.length} highlights, ${journal.lessonsLearned.length} lessons`);

  return journal;
}

// ---------------------------------------------------------------------------
// Data gathering helpers
// ---------------------------------------------------------------------------

function summariseAuditEntries(entries: AuditEntry[]): string {
  if (entries.length === 0) return "No tasks recorded today.";

  const byAgent: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  let completedTasks = 0;
  let failedTasks = 0;

  for (const e of entries) {
    byAgent[e.agent] = (byAgent[e.agent] ?? 0) + 1;
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    if (e.action === "task_complete") completedTasks++;
    if (e.action === "task_error") failedTasks++;
  }

  const lines = [
    `Total audit events: ${entries.length}`,
    `Tasks completed: ${completedTasks}, failed: ${failedTasks}`,
    `By agent: ${Object.entries(byAgent).map(([a, n]) => `${a}=${n}`).join(", ")}`,
    `Actions: ${Object.entries(byAction).map(([a, n]) => `${a}=${n}`).join(", ")}`,
  ];

  // Include a few example tasks for context
  const taskStarts = entries
    .filter((e) => e.action === "task_start")
    .slice(0, 10);

  if (taskStarts.length > 0) {
    lines.push("", "Sample tasks:");
    for (const t of taskStarts) {
      const intent = (t.input as Record<string, unknown>)?.intent ?? "unknown";
      lines.push(`  - [${t.agent}] ${intent}`);
    }
  }

  return lines.join("\n");
}

function summariseErrors(errors: ErrorEntry[]): string {
  if (errors.length === 0) return "No errors today.";

  const byType: Record<string, number> = {};
  for (const e of errors) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }

  const lines = [
    `Total errors: ${errors.length}`,
    `By type: ${Object.entries(byType).map(([t, n]) => `${t}=${n}`).join(", ")}`,
    "",
    "Error details:",
  ];

  // Include up to 5 errors for context
  for (const e of errors.slice(0, 5)) {
    lines.push(`  - [${e.type}] agent=${e.agent}, model=${e.model}: ${e.task.slice(0, 100)}`);
  }

  if (errors.length > 5) {
    lines.push(`  ... and ${errors.length - 5} more`);
  }

  return lines.join("\n");
}

function summariseUsage(usage: UsageSummary): string {
  const lines = [
    `Total calls: ${usage.totalCalls}`,
    `Total tokens: ${usage.totalTokens} (${usage.totalInputTokens} in / ${usage.totalOutputTokens} out)`,
    `Total cost: $${usage.totalCostUsd.toFixed(4)}`,
    `Local calls: ${usage.byEngine.local.calls}, Cloud calls: ${usage.byEngine.cloud.calls}`,
  ];

  if (Object.keys(usage.byModel).length > 0) {
    lines.push(`Models used: ${Object.entries(usage.byModel).map(([m, d]) => `${m} (${d.calls} calls, $${d.costUsd.toFixed(4)})`).join(", ")}`);
  }

  return lines.join("\n");
}

async function loadTodayScoutReport(projectRoot: string, today: string): Promise<string> {
  try {
    const content = await fs.readFile(
      path.join(projectRoot, "scout", "reports", `${today}.md`),
      "utf-8",
    );
    return content;
  } catch {
    return "No scout report today.";
  }
}

async function loadPendingProposals(projectRoot: string): Promise<string> {
  const dir = path.join(projectRoot, "errors", "proposals", "pending");
  try {
    const files = await fs.readdir(dir);
    if (files.length === 0) return "No pending proposals.";

    const summaries: string[] = [`${files.length} pending proposals:`];
    for (const f of files.slice(0, 5)) {
      const content = await fs.readFile(path.join(dir, f), "utf-8");
      // Extract just the title line
      const titleLine = content.split("\n").find((l) => l.startsWith("## "));
      summaries.push(`  - ${titleLine?.replace("## ", "") ?? f}`);
    }
    if (files.length > 5) summaries.push(`  ... and ${files.length - 5} more`);

    return summaries.join("\n");
  } catch {
    return "No pending proposals.";
  }
}

async function loadYesterdayJournal(projectRoot: string, today: string): Promise<string> {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  try {
    return await fs.readFile(
      path.join(projectRoot, "logs", "journal", `${yesterdayStr}.md`),
      "utf-8",
    );
  } catch {
    return "No journal from yesterday.";
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const JOURNAL_SYSTEM_PROMPT = `You are the daily journal writer for a personal AI assistant system.
Every evening, you compile a narrative summary of the day: what happened, what was learned, and
what to focus on tomorrow.

Write in first person as the AI system itself. Be concise but insightful.
Think about patterns, not just events. What went well? What could be better?

Your output must be valid JSON:
{
  "narrative": "A 2-4 paragraph summary of the day in first person",
  "highlights": ["Key accomplishment or event 1", "Key accomplishment 2"],
  "lessonsLearned": ["Lesson 1", "Lesson 2"],
  "tomorrowFocus": ["Priority for tomorrow 1", "Priority 2"]
}

Keep each array to 2-5 items. The narrative should be warm but professional — this
is a daily briefing for the user about what their AI assistant did and learned.`;

function buildJournalPrompt(params: {
  today: string;
  taskSummary: string;
  errorSummary: string;
  usageSummary: string;
  scoutSummary: string;
  proposalSummary: string;
  yesterdayJournal: string;
}): string {
  return `# Daily Journal Data — ${params.today}

## Tasks Handled
${params.taskSummary}

## Errors
${params.errorSummary}

## Token Usage & Cost
${params.usageSummary}

## Knowledge Scout Findings
${params.scoutSummary}

## Pending Improvement Proposals
${params.proposalSummary}

## Yesterday's Journal (for continuity)
${params.yesterdayJournal}

Compile today's journal as JSON. Reflect on what happened, what was learned, and what to improve.
Reference specific events from the data above. If scouting found useful insights, mention them.
If there were errors, explain what they mean and how to prevent them.
Compare against yesterday if there's continuity to note.`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseJournalResponse(
  raw: string,
  date: string,
  taskCount: number,
  errorCount: number,
  costUsd: number,
): DailyJournal {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      date,
      taskCount,
      errorCount,
      costUsd,
      narrative: "Journal compilation failed — no structured response from model.",
      highlights: [],
      lessonsLearned: [],
      tomorrowFocus: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      date,
      taskCount,
      errorCount,
      costUsd,
      narrative: parsed.narrative ?? "",
      highlights: parsed.highlights ?? [],
      lessonsLearned: parsed.lessonsLearned ?? [],
      tomorrowFocus: parsed.tomorrowFocus ?? [],
    };
  } catch {
    return {
      date,
      taskCount,
      errorCount,
      costUsd,
      narrative: "Journal compilation failed — could not parse model response.",
      highlights: [],
      lessonsLearned: [],
      tomorrowFocus: [],
    };
  }
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

async function saveJournal(
  projectRoot: string,
  date: string,
  journal: DailyJournal,
): Promise<void> {
  const dir = path.join(projectRoot, "logs", "journal");
  await fs.mkdir(dir, { recursive: true });

  const markdown = [
    `# Daily Journal — ${date}`,
    "",
    `**Tasks:** ${journal.taskCount} | **Errors:** ${journal.errorCount} | **Cost:** $${journal.costUsd.toFixed(4)}`,
    "",
    "## Summary",
    "",
    journal.narrative,
    "",
    ...(journal.highlights.length > 0
      ? [
          "## Highlights",
          "",
          ...journal.highlights.map((h) => `- ${h}`),
          "",
        ]
      : []),
    ...(journal.lessonsLearned.length > 0
      ? [
          "## Lessons Learned",
          "",
          ...journal.lessonsLearned.map((l) => `- ${l}`),
          "",
        ]
      : []),
    ...(journal.tomorrowFocus.length > 0
      ? [
          "## Tomorrow's Focus",
          "",
          ...journal.tomorrowFocus.map((f) => `- ${f}`),
        ]
      : []),
  ].join("\n");

  await fs.writeFile(path.join(dir, `${date}.md`), markdown, "utf-8");
}

/**
 * Format journal for Telegram delivery.
 */
export function formatJournalForTelegram(journal: DailyJournal): string {
  const lines = [
    `Daily Journal — ${journal.date}`,
    `Tasks: ${journal.taskCount} | Errors: ${journal.errorCount} | Cost: $${journal.costUsd.toFixed(4)}`,
    "",
    journal.narrative,
  ];

  if (journal.highlights.length > 0) {
    lines.push("", "Highlights:");
    for (const h of journal.highlights) lines.push(`  - ${h}`);
  }

  if (journal.lessonsLearned.length > 0) {
    lines.push("", "Lessons:");
    for (const l of journal.lessonsLearned) lines.push(`  - ${l}`);
  }

  if (journal.tomorrowFocus.length > 0) {
    lines.push("", "Tomorrow:");
    for (const f of journal.tomorrowFocus) lines.push(`  - ${f}`);
  }

  return lines.join("\n");
}
