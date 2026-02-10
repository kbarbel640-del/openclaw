/**
 * Browser tool — Playwright-based web automation.
 * Used for purchases, form filling, scraping, and any browser-based task.
 * Includes screenshot capture for approval flows.
 */

import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

let browserInstance: Browser | null = null;
let contextInstance: BrowserContext | null = null;

/**
 * Get or launch the managed browser instance.
 * Uses persistent context to maintain cookies/sessions across tasks.
 */
export async function getBrowser(opts?: {
  userDataDir?: string;
  headless?: boolean;
}): Promise<BrowserContext> {
  if (contextInstance) {
    return contextInstance;
  }

  const userDataDir =
    opts?.userDataDir ?? path.join(process.env.HOME ?? "/tmp", ".llm-router-browser");

  await fs.mkdir(userDataDir, { recursive: true });

  contextInstance = await chromium.launchPersistentContext(userDataDir, {
    headless: opts?.headless ?? true,
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    locale: "en-GB",
    timezoneId: "Europe/London",
  });

  return contextInstance;
}

/**
 * Navigate to a URL with retry logic.
 */
export async function navigate(
  page: Page,
  url: string,
  opts?: {
    waitFor?: "load" | "domcontentloaded" | "networkidle";
    retries?: number;
    dismissCookies?: boolean;
  },
): Promise<void> {
  const maxRetries = opts?.retries ?? 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: opts?.waitFor ?? "domcontentloaded",
        timeout: 30_000,
      });

      // Dismiss cookie consent dialogs by default
      if (opts?.dismissCookies !== false) {
        await dismissCookieConsent(page);
      }

      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error(`Failed to navigate to ${url}`);
}

/**
 * Dismiss common cookie consent dialogs.
 * Tries multiple common patterns with short timeouts.
 */
export async function dismissCookieConsent(page: Page): Promise<boolean> {
  const consentSelectors = [
    '[id*="cookie"] button[id*="accept"]',
    '[id*="cookie"] button[id*="agree"]',
    '[class*="cookie"] button[class*="accept"]',
    '[class*="cookie"] button[class*="agree"]',
    '[id*="consent"] button[id*="accept"]',
    '[class*="consent"] button[class*="accept"]',
    '#onetrust-accept-btn-handler',
    '.cc-accept',
    '.cc-btn.cc-dismiss',
    'button[data-cookiebanner="accept_button"]',
    '[aria-label*="Accept cookies"]',
    '[aria-label*="Accept all"]',
    'button:has-text("Accept All")',
    'button:has-text("Accept Cookies")',
    'button:has-text("Accept all cookies")',
    'button:has-text("I agree")',
    'button:has-text("Got it")',
    'button:has-text("OK")',
  ];

  for (const selector of consentSelectors) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        await element.click({ timeout: 2_000 });
        await sleep(500);
        return true;
      }
    } catch {
      // Try next
    }
  }

  return false;
}

/**
 * Take a screenshot and save it.
 */
export async function screenshot(
  page: Page,
  savePath: string,
  opts?: { fullPage?: boolean },
): Promise<string> {
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await page.screenshot({
    path: savePath,
    fullPage: opts?.fullPage ?? false,
  });
  return savePath;
}

/**
 * Click an element by selector or visible text.
 */
export async function click(
  page: Page,
  target: string,
  opts?: { timeout?: number },
): Promise<void> {
  const timeout = opts?.timeout ?? 10_000;

  try {
    await page.click(target, { timeout });
    return;
  } catch {
    // Fall through to text-based click
  }

  await page.getByText(target, { exact: false }).first().click({ timeout });
}

/**
 * Type text into an input field.
 */
export async function type(
  page: Page,
  selector: string,
  text: string,
  opts?: { delay?: number; clear?: boolean },
): Promise<void> {
  if (opts?.clear) {
    await page.fill(selector, "");
  }
  await page.fill(selector, text);
}

/**
 * Extract the main content from a page, stripping navigation, footers, and ads.
 * Tries semantic selectors first, then falls back to cleaned body text.
 */
export async function extractMainContent(page: Page): Promise<string> {
  const contentSelectors = [
    "article",
    "main",
    '[role="main"]',
    ".post-content",
    ".article-content",
    ".entry-content",
    ".content",
    "#content",
    ".post-body",
    ".story-body",
  ];

  for (const selector of contentSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.innerText();
        if (text.trim().length > 200) {
          return cleanExtractedText(text);
        }
      }
    } catch {
      // Try next
    }
  }

  // Fallback: strip noise elements then get body text
  return page.evaluate(() => {
    const noiseSelectors = [
      "nav", "header", "footer",
      "[role='navigation']", "[role='banner']", "[role='contentinfo']",
      ".nav", ".navbar", ".header", ".footer",
      ".sidebar", ".side-bar", "#sidebar",
      ".ad", ".ads", ".advertisement",
      ".cookie", ".consent", ".popup", ".modal",
      "script", "style", "noscript",
    ];

    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const sel of noiseSelectors) {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    }

    return clone.innerText;
  }).then(cleanExtractedText);
}

/**
 * Extract text content from the page. Uses smart extraction by default.
 */
export async function extractText(page: Page, selector?: string): Promise<string> {
  if (selector) {
    const element = await page.$(selector);
    return (await element?.textContent()) ?? "";
  }
  return extractMainContent(page);
}

/**
 * Extract structured data from a page using a CSS selector pattern.
 */
export async function extractAll(
  page: Page,
  selector: string,
  fields: Record<string, string>,
): Promise<Record<string, string>[]> {
  return page.$$eval(
    selector,
    (elements, fieldMap) => {
      return elements.map((el) => {
        const result: Record<string, string> = {};
        for (const [key, sel] of Object.entries(fieldMap)) {
          const child = el.querySelector(sel as string);
          result[key] = child?.textContent?.trim() ?? "";
        }
        return result;
      });
    },
    fields,
  );
}

/**
 * Extract links from the page, optionally filtered by a URL pattern.
 */
export async function extractLinks(
  page: Page,
  opts?: { selector?: string; urlPattern?: RegExp; limit?: number },
): Promise<Array<{ text: string; url: string }>> {
  const selector = opts?.selector ?? "a[href]";
  const limit = opts?.limit ?? 50;

  const links = await page.$$eval(
    selector,
    (elements) =>
      elements.map((el) => ({
        text: el.textContent?.trim() ?? "",
        url: (el as HTMLAnchorElement).href ?? "",
      })),
  );

  let filtered = links.filter((l) => l.url && l.text);

  if (opts?.urlPattern) {
    filtered = filtered.filter((l) => opts.urlPattern!.test(l.url));
  }

  return filtered.slice(0, limit);
}

/**
 * Wait for a specific condition.
 */
export async function waitFor(
  page: Page,
  selectorOrText: string,
  opts?: { timeout?: number; state?: "visible" | "attached" | "hidden" },
): Promise<void> {
  const timeout = opts?.timeout ?? 15_000;

  try {
    await page.waitForSelector(selectorOrText, {
      timeout,
      state: opts?.state ?? "visible",
    });
  } catch {
    await page.getByText(selectorOrText, { exact: false })
      .first()
      .waitFor({ timeout, state: opts?.state ?? "visible" });
  }
}

/**
 * Scroll the page to trigger lazy loading content.
 */
export async function scrollToBottom(
  page: Page,
  opts?: { maxScrolls?: number; delayMs?: number },
): Promise<void> {
  const maxScrolls = opts?.maxScrolls ?? 5;
  const delayMs = opts?.delayMs ?? 500;

  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await sleep(delayMs);

    const atBottom = await page.evaluate(
      () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 100,
    );
    if (atBottom) break;
  }
}

/**
 * Get a new page in the managed browser context.
 */
export async function newPage(): Promise<Page> {
  const context = await getBrowser();
  return context.newPage();
}

/**
 * Close the managed browser.
 */
export async function closeBrowser(): Promise<void> {
  if (contextInstance) {
    await contextInstance.close();
    contextInstance = null;
  }
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanExtractedText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => {
      if (line === "" && i > 0 && arr[i - 1] === "") return false;
      return true;
    })
    .join("\n")
    .trim();
}
