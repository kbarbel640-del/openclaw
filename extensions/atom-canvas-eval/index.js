/**
 * Atom Canvas Visual Evaluation Extension
 *
 * Visual evaluation pipeline for the iPhone canvas display.
 * Tracks versions, compares changes, manages rollbacks.
 *
 * Multi-signal evaluation:
 *   Signal 1: Technical validity (file size, basic HTML structure)
 *   Signal 2: Version comparison via LLM (source-level diff analysis)
 *   Signal 3: Rubric-based evaluation (design criteria)
 *
 * Tools:
 *   canvas_version_save    — Save current canvas as a versioned snapshot
 *   canvas_version_list    — List all saved versions with scores
 *   canvas_version_compare — Compare two versions
 *   canvas_version_eval    — Evaluate a version against the canvas rubric
 *   canvas_rollback        — Roll back to a previous version
 *   canvas_version_get     — Get a specific version's code
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join, basename } from "node:path";

const CANVAS_ROOT = "/Users/atom/.openclaw/canvas";
const VERSIONS_DIR = "/Users/atom/.openclaw/workspace/canvas-versions";
const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434";
const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_KEY = "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";
const JUDGE_MODEL = "moonshotai/kimi-k2.5";

const VERSIONS_COLLECTION = "atom_canvas_versions";
const DIMENSION = 768;

// ============================================================================
// Infrastructure
// ============================================================================

async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: text }),
  });
  return (await res.json()).embeddings[0];
}

async function ensureCollection() {
  const check = await fetch(`${QDRANT_URL}/collections/${VERSIONS_COLLECTION}`);
  if (check.ok) return;
  await fetch(`${QDRANT_URL}/collections/${VERSIONS_COLLECTION}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vectors: { size: DIMENSION, distance: "Cosine" } }),
  });
}

async function qdrantUpsert(id, vector, payload) {
  await fetch(`${QDRANT_URL}/collections/${VERSIONS_COLLECTION}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: [{ id, vector, payload }] }),
  });
}

async function qdrantScroll(filter, limit = 100) {
  const res = await fetch(`${QDRANT_URL}/collections/${VERSIONS_COLLECTION}/points/scroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: filter || undefined,
      limit,
      with_payload: true,
      with_vector: false,
    }),
  });
  return (await res.json()).result?.points || [];
}

async function qdrantGet(ids) {
  const res = await fetch(`${QDRANT_URL}/collections/${VERSIONS_COLLECTION}/points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, with_payload: true }),
  });
  return (await res.json()).result || [];
}

async function qdrantUpdate(id, payload) {
  await fetch(`${QDRANT_URL}/collections/${VERSIONS_COLLECTION}/points/payload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: [id], payload }),
  });
}

async function llmCall(model, systemPrompt, userPrompt, temperature = 0) {
  const res = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  return (await res.json()).choices?.[0]?.message?.content || "";
}

function uuid() {
  return crypto.randomUUID();
}

// ============================================================================
// Version management helpers
// ============================================================================

function ensureVersionsDir() {
  if (!existsSync(VERSIONS_DIR)) {
    mkdirSync(VERSIONS_DIR, { recursive: true });
  }
}

function getNextVersion() {
  ensureVersionsDir();
  const files = readdirSync(VERSIONS_DIR).filter((f) => f.match(/^v\d+\.html$/));
  if (files.length === 0) return 1;
  const nums = files.map((f) => parseInt(f.match(/^v(\d+)\.html$/)[1]));
  return Math.max(...nums) + 1;
}

function readCanvasFile(filename = "face.html") {
  const path = join(CANVAS_ROOT, filename);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

// Canvas evaluation rubric
const CANVAS_RUBRIC = [
  {
    id: "renders",
    check: "HTML is well-formed with proper doctype, head, body structure",
    weight: "critical",
  },
  {
    id: "face_present",
    check: "A recognizable face with eyes, mouth, and head outline is present",
    weight: "critical",
  },
  {
    id: "animation",
    check: "At least one animation is implemented (blinking, breathing, expression)",
    weight: "major",
  },
  {
    id: "performance",
    check:
      "Uses efficient techniques (CSS transitions or requestAnimationFrame, not setInterval for visuals)",
    weight: "major",
  },
  { id: "responsive", check: "Fills the viewport properly for mobile display", weight: "major" },
  { id: "colors", check: "Color scheme is harmonious and not clashing", weight: "minor" },
  {
    id: "maintainable",
    check: "Code is organized and under ~500 lines of CSS/JS each",
    weight: "minor",
  },
];

// ============================================================================
// Plugin export
// ============================================================================

export default {
  id: "atom-canvas-eval",
  name: "Atom Canvas Visual Evaluation",
  description: "Visual evaluation pipeline for canvas face/display",
  kind: "tool",

  register(api) {
    api.logger.info("atom-canvas-eval: registering");

    let collectionReady = null;
    function ready() {
      if (!collectionReady) collectionReady = ensureCollection();
      return collectionReady;
    }

    // ========================================================================
    // canvas_version_save — Save a versioned snapshot
    // ========================================================================
    api.registerTool(
      {
        name: "canvas_version_save",
        label: "Save Canvas Version",
        description:
          "Save the current canvas face.html as a versioned snapshot. " +
          "Optionally include notes about what changed.",
        parameters: {
          type: "object",
          properties: {
            notes: { type: "string", description: "What changed in this version" },
            source_file: {
              type: "string",
              description: "Canvas file to snapshot (default: face.html)",
            },
            auto_eval: {
              type: "boolean",
              description: "Run evaluation after saving (default: true)",
            },
          },
        },
        async execute(_callId, params) {
          try {
            await ready();
            ensureVersionsDir();

            const sourceFile = params.source_file || "face.html";
            const html = readCanvasFile(sourceFile);
            if (!html) {
              return {
                content: [{ type: "text", text: `File not found: ${sourceFile}` }],
                isError: true,
              };
            }

            const versionNum = getNextVersion();
            const versionFile = `v${String(versionNum).padStart(3, "0")}.html`;
            const versionPath = join(VERSIONS_DIR, versionFile);

            // Save file
            writeFileSync(versionPath, html);

            // Compute basic stats
            const lines = html.split("\n").length;
            const size = html.length;
            const hasAnimation = /animation|@keyframes|requestAnimationFrame|transition/.test(html);
            const hasCanvas = /<canvas/.test(html);
            const hasSvg = /<svg/.test(html);

            // Save metadata to Qdrant
            const id = uuid();
            const description = params.notes || `Version ${versionNum} of ${sourceFile}`;
            const vector = await embed(description);

            const payload = {
              version_num: versionNum,
              version_file: versionFile,
              source_file: sourceFile,
              notes: params.notes || "",
              lines,
              size_bytes: size,
              has_animation: hasAnimation,
              has_canvas: hasCanvas,
              has_svg: hasSvg,
              eval_score: null,
              eval_verdict: null,
              eval_details: null,
              created_at: new Date().toISOString(),
            };

            await qdrantUpsert(id, vector, payload);

            let evalText = "";

            // Auto-evaluate if requested (default true)
            if (params.auto_eval !== false) {
              const rubricText = CANVAS_RUBRIC.map(
                (c, i) => `${i + 1}. [${c.weight.toUpperCase()}] ${c.check} — PASS or FAIL`,
              ).join("\n");

              const judgeResponse = await llmCall(
                JUDGE_MODEL,
                "You are evaluating HTML canvas code. For each criterion answer PASS or FAIL with brief reasoning.",
                `## Canvas Code (${sourceFile}, ${lines} lines)\n\`\`\`html\n${html.slice(0, 6000)}\n\`\`\`\n\n## Rubric\n${rubricText}`,
              );

              // Parse
              let passCount = 0;
              let criticalFail = false;
              const results = CANVAS_RUBRIC.map((c) => {
                const pattern = new RegExp(
                  `${c.check.slice(0, 25).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(PASS|FAIL)`,
                  "i",
                );
                const match = judgeResponse.match(pattern);
                const pass = match ? match[1].toUpperCase() === "PASS" : false;
                if (pass) passCount++;
                if (!pass && c.weight === "critical") criticalFail = true;
                return { ...c, pass };
              });

              const score = CANVAS_RUBRIC.length > 0 ? passCount / CANVAS_RUBRIC.length : 0;
              const verdict = criticalFail ? "FAIL" : "PASS";

              await qdrantUpdate(id, {
                eval_score: score,
                eval_verdict: verdict,
                eval_details: JSON.stringify(results),
              });

              evalText =
                `\n\n**Evaluation: ${verdict}** (${passCount}/${CANVAS_RUBRIC.length} = ${(score * 100).toFixed(0)}%)\n` +
                results
                  .map((r) => `  ${r.pass ? "PASS" : "FAIL"} [${r.weight}] ${r.check}`)
                  .join("\n");
            }

            return {
              content: [
                {
                  type: "text",
                  text:
                    `Saved version ${versionNum} → ${versionFile}\n` +
                    `Lines: ${lines} | Size: ${(size / 1024).toFixed(1)}KB | ` +
                    `Animation: ${hasAnimation ? "yes" : "no"} | Canvas: ${hasCanvas ? "yes" : "no"} | SVG: ${hasSvg ? "yes" : "no"}` +
                    evalText +
                    `\n(version_id: ${id})`,
                },
              ],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "canvas_version_save" },
    );

    // ========================================================================
    // canvas_version_list — List all versions
    // ========================================================================
    api.registerTool(
      {
        name: "canvas_version_list",
        label: "List Canvas Versions",
        description: "List all saved canvas versions with their evaluation scores.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max results (default 20)" },
          },
        },
        async execute(_callId, params) {
          try {
            await ready();
            const points = await qdrantScroll(null, params.limit || 20);

            if (points.length === 0) {
              return { content: [{ type: "text", text: "No canvas versions saved yet." }] };
            }

            const sorted = points.sort(
              (a, b) => (b.payload.version_num || 0) - (a.payload.version_num || 0),
            );

            const text = sorted.map((pt) => {
              const p = pt.payload;
              const score = p.eval_score !== null ? `${(p.eval_score * 100).toFixed(0)}%` : "n/a";
              const verdict = p.eval_verdict || "pending";
              return (
                `v${String(p.version_num).padStart(3, "0")} | ${verdict} ${score} | ` +
                `${p.lines} lines | ${(p.size_bytes / 1024).toFixed(1)}KB | ` +
                `${p.notes?.slice(0, 50) || "no notes"} | ${p.created_at?.slice(0, 16)} (id: ${pt.id})`
              );
            });

            return {
              content: [{ type: "text", text: `${sorted.length} versions:\n\n${text.join("\n")}` }],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "canvas_version_list" },
    );

    // ========================================================================
    // canvas_version_compare — Compare two versions
    // ========================================================================
    api.registerTool(
      {
        name: "canvas_version_compare",
        label: "Compare Canvas Versions",
        description:
          "Compare two canvas versions. Analyzes source code differences and determines " +
          "which is better. Use for A/B testing during evolution.",
        parameters: {
          type: "object",
          properties: {
            version_a: { type: "number", description: "First version number" },
            version_b: { type: "number", description: "Second version number" },
            criteria: { type: "string", description: "What to compare on" },
          },
          required: ["version_a", "version_b"],
        },
        async execute(_callId, params) {
          try {
            ensureVersionsDir();

            const fileA = `v${String(params.version_a).padStart(3, "0")}.html`;
            const fileB = `v${String(params.version_b).padStart(3, "0")}.html`;
            const pathA = join(VERSIONS_DIR, fileA);
            const pathB = join(VERSIONS_DIR, fileB);

            if (!existsSync(pathA))
              return { content: [{ type: "text", text: `${fileA} not found` }], isError: true };
            if (!existsSync(pathB))
              return { content: [{ type: "text", text: `${fileB} not found` }], isError: true };

            const htmlA = readFileSync(pathA, "utf-8");
            const htmlB = readFileSync(pathB, "utf-8");

            const criteria =
              params.criteria ||
              "visual quality, animation smoothness, code organization, feature completeness";

            const response = await llmCall(
              JUDGE_MODEL,
              "You compare two versions of an animated HTML face display. Analyze the source code differences. " +
                "For each criterion, state which version is better. Then give an overall verdict: A_BETTER, B_BETTER, or TIE.",
              `## Version A (v${params.version_a}, ${htmlA.split("\n").length} lines)\n\`\`\`html\n${htmlA.slice(0, 4000)}\n\`\`\`\n\n` +
                `## Version B (v${params.version_b}, ${htmlB.split("\n").length} lines)\n\`\`\`html\n${htmlB.slice(0, 4000)}\n\`\`\`\n\n` +
                `## Criteria: ${criteria}\n\nCompare and declare winner.`,
            );

            let winner = "TIE";
            if (
              response.includes("B_BETTER") ||
              response.includes("B is better") ||
              response.includes("Winner: B")
            )
              winner = `v${params.version_b}`;
            else if (
              response.includes("A_BETTER") ||
              response.includes("A is better") ||
              response.includes("Winner: A")
            )
              winner = `v${params.version_a}`;

            return {
              content: [
                {
                  type: "text",
                  text: `## Comparison: v${params.version_a} vs v${params.version_b}\n**Winner: ${winner}**\n\n${response.slice(0, 3000)}`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Compare failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "canvas_version_compare" },
    );

    // ========================================================================
    // canvas_version_eval — Evaluate a specific version
    // ========================================================================
    api.registerTool(
      {
        name: "canvas_version_eval",
        label: "Evaluate Canvas Version",
        description: "Run the full canvas rubric evaluation on a specific version.",
        parameters: {
          type: "object",
          properties: {
            version: { type: "number", description: "Version number to evaluate" },
          },
          required: ["version"],
        },
        async execute(_callId, params) {
          try {
            await ready();
            ensureVersionsDir();

            const file = `v${String(params.version).padStart(3, "0")}.html`;
            const path = join(VERSIONS_DIR, file);
            if (!existsSync(path))
              return { content: [{ type: "text", text: `${file} not found` }], isError: true };

            const html = readFileSync(path, "utf-8");

            const rubricText = CANVAS_RUBRIC.map(
              (c, i) => `${i + 1}. [${c.weight.toUpperCase()}] ${c.check} — PASS or FAIL`,
            ).join("\n");

            const judgeResponse = await llmCall(
              JUDGE_MODEL,
              "You are evaluating HTML canvas code for an animated face display on iPhone. " +
                "For each criterion answer PASS or FAIL with brief reasoning.",
              `## Canvas Code (${file}, ${html.split("\n").length} lines, ${(html.length / 1024).toFixed(1)}KB)\n\`\`\`html\n${html.slice(0, 6000)}\n\`\`\`\n\n## Rubric\n${rubricText}`,
            );

            // Parse
            let passCount = 0;
            let criticalFail = false;
            const results = CANVAS_RUBRIC.map((c) => {
              const pattern = new RegExp(
                `${c.check.slice(0, 25).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(PASS|FAIL)`,
                "i",
              );
              const match = judgeResponse.match(pattern);
              const pass = match ? match[1].toUpperCase() === "PASS" : false;
              if (pass) passCount++;
              if (!pass && c.weight === "critical") criticalFail = true;
              return { ...c, pass };
            });

            const score = CANVAS_RUBRIC.length > 0 ? passCount / CANVAS_RUBRIC.length : 0;
            const verdict = criticalFail ? "FAIL" : "PASS";

            // Update stored version if it exists
            const stored = await qdrantScroll(
              { must: [{ key: "version_num", match: { value: params.version } }] },
              1,
            );
            if (stored.length > 0) {
              await qdrantUpdate(stored[0].id, {
                eval_score: score,
                eval_verdict: verdict,
                eval_details: JSON.stringify(results),
              });
            }

            const resultLines = results.map(
              (r) => `${r.pass ? "PASS" : "FAIL"} [${r.weight}] ${r.check}`,
            );

            return {
              content: [
                {
                  type: "text",
                  text:
                    `## Canvas v${params.version} Evaluation: ${verdict}\n` +
                    `**Score:** ${passCount}/${CANVAS_RUBRIC.length} (${(score * 100).toFixed(0)}%)\n\n` +
                    resultLines.join("\n") +
                    `\n\n### Judge Analysis\n${judgeResponse.slice(0, 2000)}`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Eval failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "canvas_version_eval" },
    );

    // ========================================================================
    // canvas_rollback — Roll back to a previous version
    // ========================================================================
    api.registerTool(
      {
        name: "canvas_rollback",
        label: "Rollback Canvas",
        description:
          "Roll back the live canvas to a previous version. Creates a backup of the " +
          "current version first, then restores the target version.",
        parameters: {
          type: "object",
          properties: {
            version: { type: "number", description: "Version number to restore" },
            target_file: {
              type: "string",
              description: "Canvas file to replace (default: face.html)",
            },
          },
          required: ["version"],
        },
        async execute(_callId, params) {
          try {
            ensureVersionsDir();

            const file = `v${String(params.version).padStart(3, "0")}.html`;
            const sourcePath = join(VERSIONS_DIR, file);
            if (!existsSync(sourcePath)) {
              return { content: [{ type: "text", text: `${file} not found` }], isError: true };
            }

            const targetFile = params.target_file || "face.html";
            const targetPath = join(CANVAS_ROOT, targetFile);

            // Backup current before rollback
            if (existsSync(targetPath)) {
              const backupPath = join(CANVAS_ROOT, `${targetFile}.pre-rollback-${Date.now()}`);
              copyFileSync(targetPath, backupPath);
            }

            // Restore
            const html = readFileSync(sourcePath, "utf-8");
            writeFileSync(targetPath, html);

            return {
              content: [
                {
                  type: "text",
                  text: `Rolled back ${targetFile} to version ${params.version}. Previous version backed up.`,
                },
              ],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `Rollback failed: ${err.message}` }],
              isError: true,
            };
          }
        },
      },
      { name: "canvas_rollback" },
    );

    // ========================================================================
    // canvas_version_get — Get version code
    // ========================================================================
    api.registerTool(
      {
        name: "canvas_version_get",
        label: "Get Canvas Version",
        description: "Get the full HTML source of a specific canvas version.",
        parameters: {
          type: "object",
          properties: {
            version: { type: "number", description: "Version number" },
          },
          required: ["version"],
        },
        async execute(_callId, params) {
          try {
            ensureVersionsDir();
            const file = `v${String(params.version).padStart(3, "0")}.html`;
            const path = join(VERSIONS_DIR, file);
            if (!existsSync(path)) {
              return { content: [{ type: "text", text: `${file} not found` }], isError: true };
            }
            const html = readFileSync(path, "utf-8");
            return {
              content: [
                {
                  type: "text",
                  text: `## ${file} (${html.split("\n").length} lines)\n\`\`\`html\n${html}\n\`\`\``,
                },
              ],
            };
          } catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
          }
        },
      },
      { name: "canvas_version_get" },
    );

    api.logger.info("atom-canvas-eval: all tools registered");
  },
};
