import os from "os";

export interface ModelProfile {
  name: string;
  contextWindow: number;
  ramGB: number;
  description: string;
}

export const OLLAMA_MODEL_PROFILES: Record<
  string,
  { contextWindow: number; ramGB: number; description: string }
> = {
  "gemma3:4b": {
    contextWindow: 8192,
    ramGB: 3,
    description: "Google Gemma 3 4B — fast, efficient",
  },
  "gemma3:12b": { contextWindow: 8192, ramGB: 8, description: "Google Gemma 3 12B — balanced" },
  "gemma3:27b": { contextWindow: 8192, ramGB: 16, description: "Google Gemma 3 27B — powerful" },
  "llama3.3": { contextWindow: 131072, ramGB: 4, description: "Meta Llama 3.3 8B — long context" },
  "qwen2.5:7b": { contextWindow: 32768, ramGB: 5, description: "Qwen 2.5 7B — multilingual" },
  "qwen2.5-coder:7b": {
    contextWindow: 32768,
    ramGB: 5,
    description: "Qwen 2.5 Coder — code specialist",
  },
  "deepseek-r1:8b": { contextWindow: 65536, ramGB: 5, description: "DeepSeek R1 8B — reasoning" },
  "mistral:7b": {
    contextWindow: 32768,
    ramGB: 5,
    description: "Mistral 7B — fast general purpose",
  },
  "phi4:14b": {
    contextWindow: 16384,
    ramGB: 9,
    description: "Microsoft Phi-4 — compact powerhouse",
  },
  "codellama:7b": {
    contextWindow: 16384,
    ramGB: 4,
    description: "Code Llama 7B — code generation",
  },
};

/**
 * Get the model profile for a given model name.
 * Matches by prefix so "gemma3:4b-q4_0" or "gemma3:4b:latest" match "gemma3:4b".
 */
export function getModelProfile(modelName: string): ModelProfile | undefined {
  // Exact match first
  if (OLLAMA_MODEL_PROFILES[modelName]) {
    const p = OLLAMA_MODEL_PROFILES[modelName];
    return { name: modelName, ...p };
  }

  // Prefix match: find the longest key that is a prefix of modelName
  // The model name must match key exactly or key followed by a separator (-, :, .)
  let bestKey: string | undefined;
  for (const key of Object.keys(OLLAMA_MODEL_PROFILES)) {
    if (modelName.startsWith(key) && modelName.length > key.length) {
      const nextChar = modelName[key.length];
      if (nextChar === "-" || nextChar === ":" || nextChar === ".") {
        if (!bestKey || key.length > bestKey.length) {
          bestKey = key;
        }
      }
    }
  }

  if (bestKey) {
    const p = OLLAMA_MODEL_PROFILES[bestKey];
    return { name: bestKey, ...p };
  }

  return undefined;
}

/**
 * Recommend models that fit in the given RAM budget, sorted by ramGB descending (most capable first).
 */
export function recommendModelsForRam(availableRamGB: number): ModelProfile[] {
  return Object.entries(OLLAMA_MODEL_PROFILES)
    .filter(([, p]) => p.ramGB <= availableRamGB)
    .map(([name, p]) => ({ name, ...p }))
    .toSorted((a, b) => b.ramGB - a.ramGB || b.contextWindow - a.contextWindow);
}

/**
 * Get usable system RAM in GB (total minus ~2GB for OS overhead).
 */
export async function getSystemRam(): Promise<number> {
  const totalGB = os.totalmem() / 1024 ** 3;
  return Math.max(0, totalGB - 2);
}
