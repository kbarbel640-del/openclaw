/**
 * Web URL content extraction → Markdown.
 * Reuses OpenClaw's existing linkedom + @mozilla/readability pipeline.
 * For Google private pages (NotebookLM, etc.), falls back to browser-based
 * extraction using the user's logged-in Chrome profile.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_CHARS = 2_000_000;
const MAX_RAW_HTML_CHARS = 10_000_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Google domains that always require browser-based access for private content */
const GOOGLE_PRIVATE_DOMAINS = ["notebooklm.google.com"];

/** Google domains where login walls may appear */
const GOOGLE_AUTH_DOMAINS = [
  "notebooklm.google.com",
  "docs.google.com",
  "drive.google.com",
  "sites.google.com",
];

function isGooglePrivateDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return GOOGLE_PRIVATE_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function isGoogleDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return GOOGLE_AUTH_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Detect if the response is a Google login/sign-in wall */
function isGoogleLoginPage(html: string, title: string): boolean {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("sign in") && lowerTitle.includes("google")) return true;
  if (lowerTitle === "sign in" || lowerTitle === "sign in - google accounts") return true;
  if (
    html.includes("accounts.google.com/ServiceLogin") ||
    html.includes("accounts.google.com/v3/signin")
  )
    return true;
  if (html.includes("identifier-shown") && html.includes("google-accounts")) return true;
  return false;
}

/**
 * Extract content from a Google private page using OpenClaw's browser tool.
 * Uses the user's Chrome profile (with existing Google login session).
 */
async function extractViaBrowser(url: string): Promise<{
  title: string;
  content: string;
  source: string;
}> {
  // Dynamically import browser client functions
  const [{ browserOpenTab, browserSnapshot, browserCloseTab, browserStatus }] = await Promise.all([
    import("../../../../src/browser/client.js"),
  ]);

  // Check if browser is available with chrome profile
  let status;
  try {
    status = await browserStatus(undefined, { profile: "chrome" });
  } catch {
    throw new Error(
      "Browser control is not available. To access private Google pages (like NotebookLM), " +
        "enable browser control in OpenClaw and make sure the Chrome Browser Relay extension is active " +
        "with a tab attached. Then retry.",
    );
  }

  if (!status.running) {
    throw new Error(
      "Chrome Browser Relay is not running. To access private Google pages (like NotebookLM):\n" +
        "1. Open Chrome and sign in to your Google account\n" +
        "2. Click the OpenClaw Browser Relay toolbar icon to attach a tab\n" +
        "3. Then retry the knowledge ingestion",
    );
  }

  // Open the URL in a new tab
  const tab = await browserOpenTab(undefined, url, { profile: "chrome" });

  try {
    // Wait for page to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Take a snapshot to get the page content
    const snapshot = await browserSnapshot(undefined, {
      format: "ai",
      targetId: tab.targetId,
      maxChars: DEFAULT_MAX_CHARS,
      profile: "chrome",
    });

    if (snapshot.format !== "ai" || !snapshot.snapshot) {
      throw new Error("Failed to get page content from browser snapshot");
    }

    const content = snapshot.snapshot.trim();
    if (!content || content.length < 100) {
      throw new Error(
        "Browser snapshot returned insufficient content. The page may still be loading.",
      );
    }

    // Extract title from the snapshot (first heading or URL)
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^(.+)$/m);
    const title = titleMatch?.[1]?.trim() || new URL(url).hostname;

    return { title, content, source: url };
  } finally {
    // Clean up: close the tab we opened
    try {
      await browserCloseTab(undefined, tab.targetId, { profile: "chrome" });
    } catch {
      // Best effort cleanup
    }
  }
}

export async function extractWebContent(
  url: string,
  options?: { accessToken?: string },
): Promise<{
  title: string;
  content: string;
  source: string;
}> {
  // For known Google private domains, go directly to browser-based extraction
  if (isGooglePrivateDomain(url)) {
    return extractViaBrowser(url);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    // For Google domains, attach OAuth Bearer token if available
    if (isGoogleDomain(url) && options?.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }

    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(`Unsupported content type: ${contentType}. Expected HTML.`);
    }

    const html = await response.text();
    if (html.length > MAX_RAW_HTML_CHARS) {
      throw new Error(
        `Page too large (${(html.length / 1_000_000).toFixed(1)}M chars raw HTML). ` +
          `Try extracting individual sections or using a more specific URL.`,
      );
    }

    // Use OpenClaw's existing Readability + linkedom pipeline
    const [{ Readability }, { parseHTML }] = await Promise.all([
      import("@mozilla/readability"),
      import("linkedom"),
    ]);

    const { document } = parseHTML(html);
    try {
      (document as { baseURI?: string }).baseURI = url;
    } catch {
      // Best-effort base URI for relative links.
    }

    const reader = new Readability(document, { charThreshold: 0 });
    const parsed = reader.parse();

    const rawTitle = parsed?.title || document.title?.trim() || new URL(url).hostname;

    // Detect Google login wall — fallback to browser-based extraction
    if (isGoogleLoginPage(html, rawTitle)) {
      try {
        return await extractViaBrowser(url);
      } catch (browserErr) {
        throw new Error(
          `This URL requires Google authentication and browser-based extraction also failed. ` +
            `To access private Google pages:\n` +
            `1. Open Chrome and sign in to your Google account\n` +
            `2. Enable the OpenClaw Browser Relay extension and attach a tab\n` +
            `3. Then retry the knowledge ingestion\n\n` +
            `Browser error: ${browserErr instanceof Error ? browserErr.message : String(browserErr)}`,
        );
      }
    }

    if (parsed?.textContent) {
      const content = parsed.textContent.slice(0, DEFAULT_MAX_CHARS).trim();
      return { title: rawTitle, content, source: url };
    }

    // Fallback: extract text from body
    const body = document.body;
    const text = body?.textContent?.trim() ?? "";
    return {
      title: rawTitle,
      content: text.slice(0, DEFAULT_MAX_CHARS),
      source: url,
    };
  } finally {
    clearTimeout(timeout);
  }
}
