import type { OpenClawConfig } from "../config/config.js";
import type { MemoryMongoDBDeploymentProfile } from "../config/types.memory.js";
import type { WizardPrompter } from "./prompts.js";

/**
 * Interactive memory backend selection for the onboarding wizard.
 * Only shown in advanced mode. Returns updated config with memory backend settings.
 */
export async function setupMemoryBackend(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  const backend = await prompter.select({
    message: "Memory backend",
    options: [
      {
        value: "builtin" as const,
        label: "Built-in (SQLite)",
        hint: "Default. Works everywhere, no setup needed.",
      },
      {
        value: "mongodb" as const,
        label: "MongoDB",
        hint: "Scalable. Requires MongoDB 8.0+ connection.",
      },
      {
        value: "qmd" as const,
        label: "QMD",
        hint: "Advanced. Local semantic search with qmd binary.",
      },
    ],
    initialValue: config.memory?.backend ?? "builtin",
  });

  if (backend === "builtin") {
    return config;
  }

  if (backend === "mongodb") {
    return setupMongoDBMemory(config, prompter);
  }

  // QMD — set backend, existing QMD config flow handles the rest
  return {
    ...config,
    memory: { ...config.memory, backend: "qmd" },
  };
}

async function setupMongoDBMemory(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  const uri = await prompter.text({
    message: "MongoDB connection URI",
    placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/",
    validate: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return "URI is required for MongoDB backend";
      }
      if (!trimmed.startsWith("mongodb://") && !trimmed.startsWith("mongodb+srv://")) {
        return "URI must start with mongodb:// or mongodb+srv://";
      }
      return undefined;
    },
  });

  // Auto-detect deployment profile based on URI
  const trimmedUri = uri.trim();
  const isAtlas = trimmedUri.includes(".mongodb.net");
  const suggestedProfile: MemoryMongoDBDeploymentProfile = isAtlas
    ? "atlas-default"
    : "community-mongot";

  const profile = await prompter.select<MemoryMongoDBDeploymentProfile>({
    message: "Deployment profile",
    options: [
      {
        value: "atlas-default",
        label: "Atlas (standard)",
        hint: "Full Atlas Search + Vector Search",
      },
      {
        value: "atlas-m0",
        label: "Atlas (free tier M0)",
        hint: "Limited to 3 search indexes total",
      },
      {
        value: "community-mongot",
        label: "Community + mongot",
        hint: "Self-hosted with mongot search engine",
      },
      {
        value: "community-bare",
        label: "Community (bare)",
        hint: "No mongot. Keyword search via $text only",
      },
    ],
    initialValue: suggestedProfile,
  });

  return {
    ...config,
    memory: {
      ...config.memory,
      backend: "mongodb",
      mongodb: {
        ...config.memory?.mongodb,
        uri: trimmedUri,
        deploymentProfile: profile,
      },
    },
  };
}
