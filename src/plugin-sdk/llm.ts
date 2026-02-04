import { type Api, completeSimple, type Model } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../config/config.js";
import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import { getApiKeyForModel } from "../agents/model-auth.js";
import {
  buildModelAliasIndex,
  resolveDefaultModelForAgent,
  resolveModelRefFromString,
} from "../agents/model-selection.js";
import { ensureOpenClawModelsJson } from "../agents/models-config.js";
import { resolveModel } from "../agents/pi-embedded-runner/model.js";

function isTextContentBlock(block: { type: string }): block is { type: "text"; text: string } {
  return block.type === "text";
}

export async function completeTextWithModelRef(params: {
  cfg: OpenClawConfig;
  modelRef: string;
  prompt: string;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<{ text: string; model: string }> {
  const startedAt = Date.now();
  const timeoutMs = params.timeoutMs ?? 10_000;
  const maxTokens = params.maxTokens ?? 256;

  const defaultRef = resolveDefaultModelForAgent({ cfg: params.cfg, agentId: undefined });
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider: defaultRef.provider,
  });
  const resolved = resolveModelRefFromString({
    raw: params.modelRef,
    defaultProvider: defaultRef.provider,
    aliasIndex,
  });
  if (!resolved) {
    throw new Error(`Invalid model ref: ${params.modelRef}`);
  }

  const agentDir = resolveOpenClawAgentDir();
  await ensureOpenClawModelsJson(params.cfg, agentDir);

  const { model, error } = resolveModel(
    resolved.ref.provider,
    resolved.ref.model,
    agentDir,
    params.cfg,
  );
  if (!model || error) {
    throw new Error(
      error ?? `Failed to resolve model: ${resolved.ref.provider}/${resolved.ref.model}`,
    );
  }

  const auth = await getApiKeyForModel({ model: model as Model<Api>, cfg: params.cfg, agentDir });
  const apiKey = auth.apiKey?.trim() ?? "";
  if (!apiKey && auth.mode !== "aws-sdk") {
    throw new Error(
      `No API key resolved for provider "${resolved.ref.provider}" (auth mode: ${auth.mode}).`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  timer.unref?.();

  try {
    const res = await completeSimple(
      model as Model<Api>,
      {
        messages: [
          {
            role: "user",
            content: params.prompt,
            timestamp: startedAt,
          },
        ],
      },
      {
        apiKey,
        maxTokens,
        signal: controller.signal,
      },
    );

    const text = res.content
      .filter(isTextContentBlock)
      .map((block) => block.text.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!text) {
      throw new Error("No text returned");
    }

    return {
      text,
      model: `${resolved.ref.provider}/${resolved.ref.model}`,
    };
  } catch (err) {
    const error = err as Error;
    if (error?.name === "AbortError") {
      throw new Error("Completion timed out", { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function probeModelRefAuth(params: {
  cfg: OpenClawConfig;
  modelRef: string;
}): Promise<{
  ok: boolean;
  provider: string;
  hasKey: boolean;
  source?: string;
  error?: string;
}> {
  const defaultRef = resolveDefaultModelForAgent({ cfg: params.cfg, agentId: undefined });
  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider: defaultRef.provider,
  });
  const resolved = resolveModelRefFromString({
    raw: params.modelRef,
    defaultProvider: defaultRef.provider,
    aliasIndex,
  });
  if (!resolved) {
    return {
      ok: false,
      provider: "",
      hasKey: false,
      error: `Invalid model ref: ${params.modelRef}`,
    };
  }

  const provider = resolved.ref.provider;
  try {
    const agentDir = resolveOpenClawAgentDir();
    await ensureOpenClawModelsJson(params.cfg, agentDir);
    const { model, error } = resolveModel(provider, resolved.ref.model, agentDir, params.cfg);
    if (!model || error) {
      return {
        ok: true,
        provider,
        hasKey: false,
        error: error ?? `Failed to resolve model: ${provider}/${resolved.ref.model}`,
      };
    }
    const auth = await getApiKeyForModel({ model: model as Model<Api>, cfg: params.cfg, agentDir });
    const key = auth.apiKey?.trim() ?? "";
    return {
      ok: true,
      provider,
      hasKey: Boolean(key) || auth.mode === "aws-sdk",
      source: auth.source,
      ...(key ? {} : auth.mode === "aws-sdk" ? {} : { error: `Missing API key (${auth.mode})` }),
    };
  } catch (err) {
    return {
      ok: true,
      provider,
      hasKey: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
