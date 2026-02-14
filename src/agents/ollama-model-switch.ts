import { listOllamaModels } from "./ollama-health.js";
import { OLLAMA_BASE_URL } from "./ollama-shared.js";

export type SwitchResult = { success: boolean; model: string; error?: string };

/** Check if a model exists locally. Does NOT change global state. */
export async function switchOllamaModel(
  modelName: string,
  opts?: { baseUrl?: string },
): Promise<SwitchResult> {
  const baseUrl = opts?.baseUrl ?? OLLAMA_BASE_URL;
  try {
    const models = await listOllamaModels(baseUrl);
    const found = models.some(
      (m) =>
        m.name === modelName ||
        m.name === `${modelName}:latest` ||
        (modelName.endsWith(":latest") && m.name === modelName.replace(/:latest$/, "")),
    );
    if (!found) {
      return { success: false, model: modelName, error: `Model not found. Run: ollama pull ${modelName}` };
    }
    return { success: true, model: modelName };
  } catch (err: unknown) {
    const e = err as Error | undefined;
    const msg =
      (e as any)?.cause?.code === "ECONNREFUSED" || e?.message?.includes("ECONNREFUSED")
        ? "Cannot connect to Ollama. Is it running?"
        : String(e?.message ?? err);
    return { success: false, model: modelName, error: msg };
  }
}

/** Return sorted list of locally available Ollama model names. */
export async function listAvailableModels(baseUrl?: string): Promise<string[]> {
  const models = await listOllamaModels(baseUrl ?? OLLAMA_BASE_URL);
  return models.map((m) => m.name).toSorted();
}
