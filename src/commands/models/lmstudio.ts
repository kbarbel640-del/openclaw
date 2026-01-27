import * as clack from "@clack/prompts";

import { discoverLMStudioModels } from "../../agents/models-config.providers.js";
import { readConfig, writeConfig } from "../../config/config.js";
import type { ModelDefinitionConfig } from "../../config/types.models.js";
import type { Runtime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";

const DEFAULT_LMSTUDIO_URL = "http://127.0.0.1:1234/v1";

export interface LMStudioSetupOptions {
  url?: string;
  setDefault?: boolean;
  yes?: boolean;
}

export async function modelsLMStudioSetupCommand(
  opts: LMStudioSetupOptions,
  runtime: Runtime,
): Promise<void> {
  const config = readConfig(runtime.configPath);

  let baseUrl = opts.url ?? process.env.LMSTUDIO_BASE_URL ?? DEFAULT_LMSTUDIO_URL;

  // If no URL provided and not --yes, prompt for it
  if (!opts.url && !opts.yes) {
    const urlInput = await clack.text({
      message: "LM Studio server URL",
      placeholder: DEFAULT_LMSTUDIO_URL,
      defaultValue: DEFAULT_LMSTUDIO_URL,
      validate: (value) => {
        try {
          new URL(value);
          return undefined;
        } catch {
          return "Invalid URL";
        }
      },
    });
    if (clack.isCancel(urlInput)) {
      clack.cancel("Setup cancelled");
      return;
    }
    baseUrl = urlInput || DEFAULT_LMSTUDIO_URL;
  }

  // Discover models
  const spinner = clack.spinner();
  spinner.start(`Discovering models at ${baseUrl}...`);

  const models = await discoverLMStudioModels(baseUrl);

  if (models.length === 0) {
    spinner.stop(`${theme.error("No models found")} at ${baseUrl}`);
    console.log(theme.muted("\nMake sure LM Studio is running and has a model loaded."));
    console.log(theme.muted(`Test with: curl ${baseUrl}/models`));
    return;
  }

  spinner.stop(`Found ${models.length} model(s)`);

  // Display discovered models
  console.log();
  for (const model of models) {
    const tags: string[] = [];
    if (model.reasoning) tags.push("reasoning");
    if (model.input?.includes("image")) tags.push("vision");
    const tagStr = tags.length > 0 ? ` ${theme.muted(`(${tags.join(", ")})`)}` : "";
    console.log(`  ${theme.success("+")} ${model.id}${tagStr}`);
  }
  console.log();

  // Select default model
  let selectedModel: ModelDefinitionConfig | undefined;
  if (!opts.yes && models.length > 1) {
    const modelOptions = models.map((m) => ({
      value: m.id,
      label: m.id,
      hint: m.reasoning ? "reasoning" : undefined,
    }));

    const selected = await clack.select({
      message: "Select default model",
      options: modelOptions,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Setup cancelled");
      return;
    }

    selectedModel = models.find((m) => m.id === selected);
  } else {
    selectedModel = models[0];
  }

  // Build provider config
  const providerConfig = {
    baseUrl,
    apiKey: "lmstudio",
    api: "openai-completions" as const,
    models,
  };

  // Update config
  const nextConfig = {
    ...config,
    models: {
      ...config.models,
      mode: config.models?.mode ?? "merge",
      providers: {
        ...config.models?.providers,
        lmstudio: providerConfig,
      },
    },
  };

  // Set as default if requested
  if (opts.setDefault && selectedModel) {
    const modelId = `lmstudio/${selectedModel.id}`;
    nextConfig.agents = {
      ...nextConfig.agents,
      defaults: {
        ...nextConfig.agents?.defaults,
        model: {
          ...nextConfig.agents?.defaults?.model,
          primary: modelId,
        },
      },
    };
  }

  writeConfig(runtime.configPath, nextConfig);

  console.log(theme.success(`Updated ${runtime.configPath}`));

  if (selectedModel) {
    const modelId = `lmstudio/${selectedModel.id}`;
    if (opts.setDefault) {
      console.log(`Default model: ${theme.highlight(modelId)}`);
    } else {
      console.log(
        theme.muted(`\nTo set as default: clawdbot models set ${modelId}`),
      );
    }
  }
}

export async function modelsLMStudioDiscoverCommand(
  opts: { url?: string; json?: boolean },
  _runtime: Runtime,
): Promise<void> {
  const baseUrl = opts.url ?? process.env.LMSTUDIO_BASE_URL ?? DEFAULT_LMSTUDIO_URL;
  const models = await discoverLMStudioModels(baseUrl);

  if (opts.json) {
    console.log(JSON.stringify({ baseUrl, models }, null, 2));
    return;
  }

  if (models.length === 0) {
    console.log(theme.error(`No models found at ${baseUrl}`));
    console.log(theme.muted(`\nMake sure LM Studio is running and has a model loaded.`));
    return;
  }

  console.log(`Models at ${theme.highlight(baseUrl)}:\n`);
  for (const model of models) {
    const tags: string[] = [];
    if (model.reasoning) tags.push("reasoning");
    if (model.input?.includes("image")) tags.push("vision");
    const tagStr = tags.length > 0 ? ` ${theme.muted(`(${tags.join(", ")})`)}` : "";
    console.log(`  ${model.id}${tagStr}`);
  }
}
