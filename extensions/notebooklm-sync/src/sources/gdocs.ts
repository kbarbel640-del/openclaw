/**
 * Google Docs content extraction via Google Drive API.
 *
 * Security:
 * - Uses OAuth access token from OpenClaw credential store
 * - Only requests drive.readonly scope (no write access)
 * - Falls back to public export URL for publicly shared docs
 * - Validates document ID format to prevent injection
 */

const DRIVE_EXPORT_BASE = "https://www.googleapis.com/drive/v3/files";
const PUBLIC_EXPORT_BASE = "https://docs.google.com/document/d";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_CHARS = 500_000;

/** Extract Google Docs document ID from various URL formats */
export function extractDocId(url: string): string | null {
  // Format: https://docs.google.com/document/d/{DOC_ID}/...
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Format: https://drive.google.com/file/d/{FILE_ID}/...
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) return driveMatch[1];

  // Format: https://drive.google.com/open?id={FILE_ID}
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("id");
    if (id && /^[a-zA-Z0-9_-]+$/.test(id)) return id;
  } catch {
    // not a valid URL
  }

  return null;
}

/** Validate document ID format (alphanumeric + hyphens + underscores only) */
function isValidDocId(docId: string): boolean {
  return /^[a-zA-Z0-9_-]{10,}$/.test(docId);
}

/** Try to fetch a publicly shared Google Doc as plain text (no auth needed) */
async function fetchPublicDoc(docId: string): Promise<string | null> {
  const url = `${PUBLIC_EXPORT_BASE}/${docId}/export?format=txt`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch a Google Doc via Drive API with OAuth token */
async function fetchAuthenticatedDoc(
  docId: string,
  accessToken: string,
): Promise<{ content: string; title: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    // First get metadata (title)
    const metaUrl = `${DRIVE_EXPORT_BASE}/${encodeURIComponent(docId)}?fields=name,mimeType`;
    const metaResponse = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });

    let title = "Untitled Google Doc";
    if (metaResponse.ok) {
      const meta = (await metaResponse.json()) as { name?: string; mimeType?: string };
      if (meta.name) title = meta.name;
    }

    // Export as plain text
    const exportUrl = `${DRIVE_EXPORT_BASE}/${encodeURIComponent(docId)}/export?mimeType=text/plain`;
    const exportResponse = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });

    if (!exportResponse.ok) {
      const errText = await exportResponse.text().catch(() => "");
      throw new Error(
        `Google Drive API ${exportResponse.status}: ${errText || exportResponse.statusText}`,
      );
    }

    const content = await exportResponse.text();
    return { content: content.slice(0, DEFAULT_MAX_CHARS), title };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractGoogleDoc(params: { url: string; accessToken?: string }): Promise<{
  title: string;
  content: string;
  source: string;
}> {
  const docId = extractDocId(params.url);
  if (!docId || !isValidDocId(docId)) {
    throw new Error(`Invalid Google Docs URL: ${params.url}`);
  }

  // Strategy 1: Try public export first (no auth needed, works for shared docs)
  const publicContent = await fetchPublicDoc(docId);
  if (publicContent) {
    return {
      title: `Google Doc ${docId.slice(0, 8)}…`,
      content: publicContent.slice(0, DEFAULT_MAX_CHARS),
      source: params.url,
    };
  }

  // Strategy 2: Use authenticated Drive API
  if (!params.accessToken) {
    throw new Error(
      "This Google Doc requires authentication. " +
        "Please run `openclaw login notebooklm-sync` to authorize Google Drive access.",
    );
  }

  const result = await fetchAuthenticatedDoc(docId, params.accessToken);
  return {
    ...result,
    source: params.url,
  };
}
