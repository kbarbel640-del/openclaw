import { OLLAMA_BASE_URL } from "./ollama-shared.js";

export interface OfflineCapabilities {
  canInfer: boolean;
  canPullModels: boolean;
  canUseCloudProviders: boolean;
  status: "full" | "local-only" | "no-models" | "no-ollama";
  message: string;
}

export interface ConnectivityStatus {
  online: boolean;
  ollama: boolean;
  internet: boolean;
}

async function probe(url: string, method = "GET", timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(url, { method, signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkConnectivity(): Promise<ConnectivityStatus> {
  const [ollama, internet] = await Promise.all([
    probe(`${OLLAMA_BASE_URL}/api/version`),
    probe("https://1.1.1.1", "HEAD", 2000),
  ]);
  return { online: ollama || internet, ollama, internet };
}

export function getOfflineCapabilities(
  ollamaAvailable: boolean,
  modelsLoaded: string[],
): OfflineCapabilities {
  if (!ollamaAvailable) {
    return {
      canInfer: false, canPullModels: false, canUseCloudProviders: false,
      status: "no-ollama",
      message: "Ollama is not running. Start it with `ollama serve` to enable local inference.",
    };
  }
  if (modelsLoaded.length === 0) {
    return {
      canInfer: false, canPullModels: true, canUseCloudProviders: false,
      status: "no-models",
      message: "Ollama is running but no models are loaded. Pull a model with `ollama pull <model>`.",
    };
  }
  const s = modelsLoaded.length === 1 ? "" : "s";
  return {
    canInfer: true, canPullModels: true, canUseCloudProviders: false,
    status: "full",
    message: `Local inference ready with ${modelsLoaded.length} model${s}: ${modelsLoaded.join(", ")}`,
  };
}

export async function getStatus(modelsLoaded: string[]): Promise<OfflineCapabilities> {
  const conn = await checkConnectivity();
  const caps = getOfflineCapabilities(conn.ollama, modelsLoaded);

  if (conn.ollama && modelsLoaded.length > 0 && !conn.internet) {
    const s = modelsLoaded.length === 1 ? "" : "s";
    return {
      ...caps,
      canPullModels: false, canUseCloudProviders: false,
      status: "local-only",
      message: `Offline but fully functional with ${modelsLoaded.length} local model${s}: ${modelsLoaded.join(", ")}`,
    };
  }

  if (conn.internet) caps.canUseCloudProviders = true;
  return caps;
}
