import path from "node:path";
import type { AudioTranscriptionRequest, AudioTranscriptionResult } from "../../types.js";
import { assertOkOrThrowHttpError, fetchWithTimeoutGuarded, normalizeBaseUrl } from "../shared.js";

const DEFAULT_AZURE_AUDIO_BASE_URL = "https://models.inference.ai.azure.com";
const DEFAULT_AZURE_AUDIO_MODEL = "whisper-large-v3-turbo";
const AZURE_API_VERSION = "2024-12-01-preview";

function resolveModel(model?: string): string {
  const trimmed = model?.trim();
  return trimmed || DEFAULT_AZURE_AUDIO_MODEL;
}

export async function transcribeAzureAudio(
  params: AudioTranscriptionRequest,
): Promise<AudioTranscriptionResult> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(params.baseUrl, DEFAULT_AZURE_AUDIO_BASE_URL);
  const allowPrivate = Boolean(params.baseUrl?.trim());

  const model = resolveModel(params.model);
  const url = new URL(
    `${baseUrl}/openai/deployments/${encodeURIComponent(model)}/audio/transcriptions`,
  );
  url.searchParams.set("api-version", AZURE_API_VERSION);

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
  // Azure AI uses api-key header instead of Authorization: Bearer.
  headers.set("api-key", params.apiKey);
  // Remove any Bearer auth that may have been set by the caller.
  headers.delete("authorization");

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
