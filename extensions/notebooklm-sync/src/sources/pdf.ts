/**
 * PDF content extraction → plain text.
 * Reuses OpenClaw's existing pdfjs-dist dependency.
 */

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_MAX_CHARS = 500_000;

export async function extractPdfContent(buffer: Buffer): Promise<{
  title: string;
  content: string;
}> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // disableWorker is valid at runtime but not in strict TS typings
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  } as Parameters<typeof getDocument>[0]).promise;

  const maxPages = Math.min(pdf.numPages, DEFAULT_MAX_PAGES);
  const textParts: string[] = [];

  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ");
    if (pageText.trim()) {
      textParts.push(pageText.trim());
    }
  }

  const content = textParts.join("\n\n").slice(0, DEFAULT_MAX_CHARS);

  // Try to extract title from PDF metadata
  let title = "Untitled PDF";
  try {
    const metadata = await pdf.getMetadata();
    const info = metadata?.info as Record<string, unknown> | undefined;
    if (info?.Title && typeof info.Title === "string" && info.Title.trim()) {
      title = info.Title.trim();
    }
  } catch {
    // ignore metadata errors
  }

  return { title, content };
}

/** Fetch a PDF from a URL and extract its text content */
export async function extractPdfFromUrl(url: string): Promise<{
  title: string;
  content: string;
  source: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await extractPdfContent(buffer);

    return {
      ...result,
      source: url,
    };
  } finally {
    clearTimeout(timeout);
  }
}
