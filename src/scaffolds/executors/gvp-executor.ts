import type { GateFailure } from "../gates/types.js";
import type { SkillScaffoldManifestV1 } from "../manifests/skill-scaffold-manifest.v1.js";
import type {
  CallModelFn,
  ScaffoldExecutionContext,
  ScaffoldExecutor,
  ScaffoldExecutorResult,
} from "./types.js";
import { BudgetExceeded, type BudgetCounter } from "../budgets/budget-counter.js";
import { runGatePipeline } from "../gates/gate-pipeline.js";

function stripWholeMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (!match) {
    return text;
  }
  return match[1] ?? "";
}

function tryParseJsonStrict(
  text: string,
): { ok: true; value: unknown } | { ok: false; failure: GateFailure } {
  const candidate = stripWholeMarkdownFence(text);
  try {
    const value = JSON.parse(candidate);
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      failure: {
        gate: "json_parse",
        id: "json_parse",
        message: `invalid JSON: ${message}`,
        path: "$",
      },
    };
  }
}

function formatFailuresForPatch(failures: GateFailure[]): string {
  const lines = failures.map((f) => {
    const p = f.path ? ` ${f.path}` : "";
    return `- [${f.gate}:${f.id}]${p}: ${f.message}`;
  });
  return lines.join("\n");
}

function buildGenerateMessages(params: {
  userPrompt: string;
  schema: unknown;
  answerField: string;
  invariants: SkillScaffoldManifestV1["scaffolds"]["output"]["invariants"];
}): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const system = [
    "You are producing a JSON artifact.",
    "Return valid JSON only.",
    "Do not wrap in markdown fences.",
    `The final user-visible answer must be in the string field "${params.answerField}".`,
  ].join(" ");

  const schemaBlock = JSON.stringify(params.schema);
  const invariantsBlock = JSON.stringify(params.invariants);

  const user = [
    "Task:",
    params.userPrompt,
    "\nJSON Schema:",
    schemaBlock,
    "\nInvariants:",
    invariantsBlock,
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function buildPatchMessages(params: {
  failures: GateFailure[];
  previousJsonText: string;
}): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const system = [
    "You are patching a JSON artifact.",
    "Return corrected JSON only.",
    "Do not wrap in markdown fences.",
  ].join(" ");

  const user1 = `The JSON artifact failed validation:\n${formatFailuresForPatch(params.failures)}`;
  const assistant = params.previousJsonText.trim();
  const user2 = "Fix the artifact to satisfy the failures. Return JSON only (no markdown).";

  return [
    { role: "system", content: system },
    { role: "user", content: user1 },
    { role: "assistant", content: assistant },
    { role: "user", content: user2 },
  ];
}

function extractAnswer(params: { artifact: unknown; answerField: string }): string | null {
  const obj = params.artifact as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }
  const val = obj[params.answerField];
  return typeof val === "string" ? val : null;
}

export class GvpExecutor implements ScaffoldExecutor {
  readonly id = "g-v-p" as const;

  async execute(params: {
    ctx: ScaffoldExecutionContext;
    manifest: SkillScaffoldManifestV1;
    callModel: CallModelFn;
    budgets: BudgetCounter;
  }): Promise<ScaffoldExecutorResult> {
    const manifest = params.manifest;
    const answerField = manifest.scaffolds.output.answerField;
    const schema = manifest.scaffolds.output.schema;
    const invariants = manifest.scaffolds.output.invariants;

    const userPrompt = params.ctx.prompt ?? "";

    let lastArtifactText = "";
    let lastArtifact: unknown = undefined;
    let lastFailures: GateFailure[] = [];

    try {
      params.budgets.consumeLlmCall();
      const gen = await params.callModel({
        messages: buildGenerateMessages({
          userPrompt,
          schema,
          answerField,
          invariants,
        }),
      });

      lastArtifactText = gen.text;
      const parsed0 = tryParseJsonStrict(gen.text);
      if (!parsed0.ok) {
        lastFailures = [parsed0.failure];
      } else {
        lastArtifact = parsed0.value;
        const gate0 = runGatePipeline({
          artifact: lastArtifact,
          schema,
          answerField,
          invariants,
        });
        if (gate0.ok) {
          const answer = extractAnswer({ artifact: lastArtifact, answerField });
          if (typeof answer === "string") {
            return { text: answer, meta: { applied: [this.id] } };
          }
        } else {
          lastFailures = gate0.failures;
        }
      }

      for (let i = 0; i < manifest.scaffolds.budgets.maxRetries; i += 1) {
        params.budgets.consumeRetry();
        params.budgets.consumeLlmCall();

        const patch = await params.callModel({
          messages: buildPatchMessages({
            failures: lastFailures,
            previousJsonText: lastArtifactText,
          }),
        });

        lastArtifactText = patch.text;
        const parsed = tryParseJsonStrict(patch.text);
        if (!parsed.ok) {
          lastFailures = [parsed.failure];
          continue;
        }

        lastArtifact = parsed.value;
        const gate = runGatePipeline({
          artifact: lastArtifact,
          schema,
          answerField,
          invariants,
        });
        if (gate.ok) {
          const answer = extractAnswer({ artifact: lastArtifact, answerField });
          if (typeof answer === "string") {
            return { text: answer, meta: { applied: [this.id] } };
          }
          lastFailures = [
            {
              gate: "extract",
              id: "answer_field_missing",
              message: `answerField '${answerField}' must be a string`,
              path: `$/` + answerField,
            },
          ];
          continue;
        }
        lastFailures = gate.failures;
      }

      return {
        text: "Scaffold error: could not produce a valid answer (E_VERIFY_FAILED).",
        meta: { applied: [this.id] },
      };
    } catch (err) {
      if (err instanceof BudgetExceeded) {
        return {
          text: "Scaffold error: budget exceeded (E_BUDGET_EXCEEDED).",
          meta: { applied: [this.id] },
        };
      }
      throw err;
    }
  }
}
