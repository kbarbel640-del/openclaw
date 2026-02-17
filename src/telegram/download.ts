import { detectMime } from "../media/mime.js";
import { type SavedMedia, saveMediaBuffer } from "../media/store.js";

export type TelegramFileInfo = {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
};

// Retry helper для fetch с экспоненциальным backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelayMs = 2000,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return res;
      }
      // Если HTTP ошибка (4xx, 5xx) — retry
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      // Сетевая ошибка — retry
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // Ждём перед следующей попыткой (экспоненциальный backoff)
    if (attempt < maxRetries - 1) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries} retries`);
}

export async function getTelegramFile(
  token: string,
  fileId: string,
  timeoutMs = 30_000,
): Promise<TelegramFileInfo> {
  const res = await fetchWithRetry(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { signal: AbortSignal.timeout(timeoutMs) },
    3, // 3 retries
    1000, // начальная задержка 1с
  );

  if (!res.ok) {
    throw new Error(`getFile failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { ok: boolean; result?: TelegramFileInfo };
  if (!json.ok || !json.result?.file_path) {
    throw new Error("getFile returned no file_path");
  }
  return json.result;
}

export async function downloadTelegramFile(
  token: string,
  info: TelegramFileInfo,
  maxBytes?: number,
  timeoutMs = 60_000,
): Promise<SavedMedia> {
  if (!info.file_path) {
    throw new Error("file_path missing");
  }
  const url = `https://api.telegram.org/file/bot${token}/${info.file_path}`;

  const res = await fetchWithRetry(
    url,
    { signal: AbortSignal.timeout(timeoutMs) },
    3, // 3 retries
    2000, // начальная задержка 2с (файлы могут быть большими)
  );

  if (!res.ok || !res.body) {
    throw new Error(`Failed to download telegram file: HTTP ${res.status}`);
  }
  const array = Buffer.from(await res.arrayBuffer());
  const mime = await detectMime({
    buffer: array,
    headerMime: res.headers.get("content-type"),
    filePath: info.file_path,
  });
  // save with inbound subdir
  const saved = await saveMediaBuffer(array, mime, "inbound", maxBytes, info.file_path);
  // Ensure extension matches mime if possible
  if (!saved.contentType && mime) {
    saved.contentType = mime;
  }
  return saved;
}
