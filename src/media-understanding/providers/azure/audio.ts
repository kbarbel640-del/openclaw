import path from "node:path";
import type { AudioTranscriptionRequest, AudioTranscriptionResult } from "../../types.js";
import { assertOkOrThrowHttpError, fetchWithTimeoutGuarded, normalizeBaseUrl } from "../shared.js";

const DEFAULT_AZURE_AUDIO_BASE_URL = "https://models.inference.ai.azure.com";
const DEFAULT_AZURE_AUDIO_MODEL = "whisper-large-v3-turbo";
const DEFAULT_AZURE_API_VERSION = "2024-12-01-preview";

function resolveModel(model?: string): string {
  const trimmed = model?.trim();
  return trimmed || DEFAULT_AZURE_AUDIO_MODEL;
}

/**
 * Build the transcription URL for Azure AI.
 *
 * Two forms are supported:
 *
 * 1. **Full deployment URL** (baseUrl already contains `/openai/deployments/{name}`):
 *    → append `/audio/transcriptions`
 *
 * 2. **Bare endpoint** (e.g. `https://models.inference.ai.azure.com`):
 *    → append `/openai/deployments/{model}/audio/transcriptions`
 */
function buildTranscriptionUrl(baseUrl: string, model: string): URL {
  if (/\/openai\/deployments\/[^/]+\/?$/i.test(baseUrl)) {
    // baseUrl already points to a specific deployment.
    return new URL(`${baseUrl.replace(/\/+$/, "")}/audio/transcriptions`);
  }
  return new URL(`${baseUrl}/openai/deployments/${encodeURIComponent(model)}/audio/transcriptions`);
}

export async function transcribeAzureAudio(
  params: AudioTranscriptionRequest,
): Promise<AudioTranscriptionResult> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(params.baseUrl, DEFAULT_AZURE_AUDIO_BASE_URL);
  const allowPrivate = Boolean(params.baseUrl?.trim());

  const model = resolveModel(params.model);
  const url = buildTranscriptionUrl(baseUrl, model);

  // Apply query params from providerOptions (e.g. api-version).
  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  // Ensure api-version is always present.
  if (!url.searchParams.has("api-version")) {
    url.searchParams.set("api-version", DEFAULT_AZURE_API_VERSION);
  }

  const form = new FormData();
  const fileName = params.fileName?.trim() || path.basename(params.fileName) || "audio";
  const bytes = new Uint8Array(params.buffer);
  const blob = new Blob([bytes], {
    type: params.mime ?? "application/octet-stream",
  });
  form.append("file", blob, fileName);
  form.append("model", model);
  if (params.language?.trim()) {
    form.append("language", params.language.trim());
  }
  if (params.prompt?.trim()) {
    form.append("prompt", params.prompt.trim());
  }

  const headers = new Headers(params.headers);
  // Remove any Bearer auth that may have been set by the caller.
  headers.delete("authorization");
  // Azure Cognitive Services endpoints use Ocp-Apim-Subscription-Key,
  // while Azure AI Foundry endpoints use api-key.
  if (baseUrl.includes(".cognitiveservices.azure.com")) {
    headers.set("Ocp-Apim-Subscription-Key", params.apiKey);
  } else {
    headers.set("api-key", params.apiKey);
  }

  const { response: res, release } = await fetchWithTimeoutGuarded(
    url.toString(),
    {
      method: "POST",
      headers,
      body: form,
    },
    params.timeoutMs,
    fetchFn,
    allowPrivate ? { ssrfPolicy: { allowPrivateNetwork: true } } : undefined,
  );

  try {
    await assertOkOrThrowHttpError(res, "Azure audio transcription failed");

    const payload = (await res.json()) as { text?: string };
    const text = payload.text?.trim();
    if (!text) {
      throw new Error("Azure audio transcription response missing text");
    }
    return { text, model };
  } finally {
    await release();
  }
}
