/**
 * Memory Materializer — Writes MABOS structured data as Markdown files
 * that OpenClaw's chokidar watcher auto-detects and indexes with vector+BM25.
 *
 * By writing to `memory/*.md` inside agent workspaces, we get free
 * hybrid search indexing with zero OpenClaw core modifications.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveWorkspaceDir } from "./common.js";

async function readJson(p: string): Promise<any> {
  try {
    return JSON.parse(await readFile(p, "utf-8"));
  } catch {
    return null;
  }
}

async function readMd(p: string): Promise<string> {
  try {
    return await readFile(p, "utf-8");
  } catch {
    return "";
  }
}

async function writeMd(p: string, content: string): Promise<void> {
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, content, "utf-8");
}

/**
 * Materialize facts.json as a searchable Markdown file.
 */
export async function materializeFacts(api: OpenClawPluginApi, agentId: string): Promise<void> {
  const ws = resolveWorkspaceDir(api);
  const factsPath = join(ws, "agents", agentId, "facts.json");
  const outPath = join(ws, "agents", agentId, "memory", "mabos-facts.md");

  const store = await readJson(factsPath);
  if (!store?.facts?.length) return;

  const lines: string[] = [
    `# MABOS Facts — ${agentId}`,
    "",
    `> Auto-materialized from facts.json. ${store.facts.length} facts.`,
    "",
  ];

  for (const fact of store.facts) {
    lines.push(`## ${fact.subject} ${fact.predicate} ${fact.object}`);
    lines.push("");
    lines.push(`- **ID:** ${fact.id}`);
    lines.push(`- **Confidence:** ${fact.confidence}`);
    lines.push(`- **Source:** ${fact.source}`);
    if (fact.valid_from) lines.push(`- **Valid from:** ${fact.valid_from}`);
    if (fact.valid_until) lines.push(`- **Valid until:** ${fact.valid_until}`);
    if (fact.derived_from?.length) {
      lines.push(`- **Derived from:** ${fact.derived_from.join(", ")}`);
    }
    lines.push("");
  }

  await writeMd(outPath, lines.join("\n"));
}

/**
 * Materialize BDI cognitive files (Beliefs, Desires, Goals) as a single searchable file.
 */
export async function materializeBeliefs(api: OpenClawPluginApi, agentId: string): Promise<void> {
  const ws = resolveWorkspaceDir(api);
  const agentDir = join(ws, "agents", agentId);
  const outPath = join(agentDir, "memory", "mabos-beliefs.md");

  const beliefs = await readMd(join(agentDir, "Beliefs.md"));
  const desires = await readMd(join(agentDir, "Desires.md"));
  const goals = await readMd(join(agentDir, "Goals.md"));

  if (!beliefs && !desires && !goals) return;

  const lines: string[] = [
    `# MABOS BDI State — ${agentId}`,
    "",
    `> Auto-materialized from Beliefs.md, Desires.md, Goals.md`,
    "",
  ];

  if (beliefs) {
    lines.push("## Beliefs");
    lines.push("");
    lines.push(beliefs.trim());
    lines.push("");
  }

  if (desires) {
    lines.push("## Desires");
    lines.push("");
    lines.push(desires.trim());
    lines.push("");
  }

  if (goals) {
    lines.push("## Goals");
    lines.push("");
    lines.push(goals.trim());
    lines.push("");
  }

  await writeMd(outPath, lines.join("\n"));
}

/**
 * Materialize memory-store.json (long-term + short-term) as a searchable Markdown file.
 */
export async function materializeMemoryItems(
  api: OpenClawPluginApi,
  agentId: string,
): Promise<void> {
  const ws = resolveWorkspaceDir(api);
  const storePath = join(ws, "agents", agentId, "memory-store.json");
  const outPath = join(ws, "agents", agentId, "memory", "mabos-memory-items.md");

  const store = await readJson(storePath);
  if (!store) return;

  const longTerm: any[] = store.long_term || [];
  const shortTerm: any[] = store.short_term || [];
  const allItems = [
    ...longTerm.map((i: any) => ({ ...i, _store: "long_term" })),
    ...shortTerm.map((i: any) => ({ ...i, _store: "short_term" })),
  ];

  if (allItems.length === 0) return;

  const lines: string[] = [
    `# MABOS Memory Items — ${agentId}`,
    "",
    `> Auto-materialized from memory-store.json. ${longTerm.length} long-term, ${shortTerm.length} short-term items.`,
    "",
  ];

  for (const item of allItems) {
    lines.push(`## [${item._store}] ${item.type}: ${item.content.slice(0, 120)}`);
    lines.push("");
    lines.push(`- **ID:** ${item.id}`);
    lines.push(`- **Store:** ${item._store}`);
    lines.push(`- **Type:** ${item.type}`);
    lines.push(`- **Importance:** ${item.importance}`);
    lines.push(`- **Source:** ${item.source}`);
    if (item.tags?.length) lines.push(`- **Tags:** ${item.tags.join(", ")}`);
    lines.push(`- **Created:** ${item.created_at}`);
    lines.push("");
    lines.push(item.content);
    lines.push("");
  }

  await writeMd(outPath, lines.join("\n"));
}

/**
 * Run all three materializers in parallel. Failures are non-fatal.
 */
export async function materializeAll(api: OpenClawPluginApi, agentId: string): Promise<void> {
  await Promise.all([
    materializeFacts(api, agentId).catch(() => {}),
    materializeBeliefs(api, agentId).catch(() => {}),
    materializeMemoryItems(api, agentId).catch(() => {}),
  ]);
}
