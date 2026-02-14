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

export async function checkConnectivity(): Promise<ConnectivityStatus> {
  const [ollama, internet] = await Promise.all([checkOllama(), checkInternet()]);
  return { online: ollama || internet, ollama, internet };
}

async function checkOllama(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("http://127.0.0.1:11434/api/version", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function checkInternet(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("https://1.1.1.1", {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export function getOfflineCapabilities(
  ollamaAvailable: boolean,
  modelsLoaded: string[],
): OfflineCapabilities {
  const hasModels = modelsLoaded.length > 0;

  if (!ollamaAvailable) {
    return {
      canInfer: false,
      canPullModels: false,
      canUseCloudProviders: false,
      status: "no-ollama",
      message: "Ollama is not running. Start it with `ollama serve` to enable local inference.",
    };
  }

  if (!hasModels) {
    return {
      canInfer: false,
      canPullModels: true,
      canUseCloudProviders: false,
      status: "no-models",
      message:
        "Ollama is running but no models are loaded. Pull a model with `ollama pull <model>`.",
    };
  }

  // Ollama + models available — check if we also have internet
  // Note: internet status isn't passed here; this function reports local capability.
  // "full" vs "local-only" is determined by the caller combining connectivity + capabilities.
  return {
    canInfer: true,
    canPullModels: true,
    canUseCloudProviders: false,
    status: "full",
    message: `Local inference ready with ${modelsLoaded.length} model${modelsLoaded.length === 1 ? "" : "s"}: ${modelsLoaded.join(", ")}`,
  };
}

/**
 * High-level status combining connectivity and capabilities.
 */
export async function getStatus(modelsLoaded: string[]): Promise<OfflineCapabilities> {
  const conn = await checkConnectivity();
  const caps = getOfflineCapabilities(conn.ollama, modelsLoaded);

  // Refine based on internet connectivity
  if (conn.ollama && modelsLoaded.length > 0 && !conn.internet) {
    return {
      ...caps,
      canPullModels: false,
      canUseCloudProviders: false,
      status: "local-only",
      message: `Offline but fully functional with ${modelsLoaded.length} local model${modelsLoaded.length === 1 ? "" : "s"}: ${modelsLoaded.join(", ")}`,
    };
  }

  if (conn.internet) {
    caps.canUseCloudProviders = true;
  }

  return caps;
}
