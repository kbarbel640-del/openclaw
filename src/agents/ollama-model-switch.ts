import { listOllamaModels } from "./ollama-health.js";
import { OLLAMA_NATIVE_BASE_URL } from "./ollama-stream.js";

export type SwitchResult = {
  success: boolean;
  model: string;
  error?: string;
};

/**
 * Check if a model exists locally and return a switch result.
 * Does NOT actually change any global state — the caller (TUI command handler)
 * is responsible for wiring the model into the session via patchSession.
 */
export async function switchOllamaModel(
  modelName: string,
  opts?: { baseUrl?: string },
): Promise<SwitchResult> {
  const baseUrl = opts?.baseUrl ?? OLLAMA_NATIVE_BASE_URL;
  try {
    const models = await listOllamaModels(baseUrl);
    const names = models.map((m) => m.name);
    // Allow matching with or without :latest tag
    const found = names.some(
      (n) =>
        n === modelName ||
        n === `${modelName}:latest` ||
        (modelName.endsWith(":latest") && n === modelName.replace(/:latest$/, "")),
    );
    if (!found) {
      return {
        success: false,
        model: modelName,
        error: `Model not found. Run: ollama pull ${modelName}`,
      };
    }
    return { success: true, model: modelName };
  } catch (err: unknown) {
    const e = err as Error | undefined;
    const msg =
      (e as { cause?: { code?: string } })?.cause?.code === "ECONNREFUSED" ||
      e?.message?.includes("ECONNREFUSED")
        ? "Cannot connect to Ollama. Is it running?"
        : String(e?.message ?? err);
    return { success: false, model: modelName, error: msg };
  }
}

/**
 * Return sorted list of locally available Ollama model names.
 */
export async function listAvailableModels(baseUrl?: string): Promise<string[]> {
  const models = await listOllamaModels(baseUrl ?? OLLAMA_NATIVE_BASE_URL);
  return models.map((m) => m.name).toSorted();
}
