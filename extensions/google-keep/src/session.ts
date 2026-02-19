import type { BrowserContext, Page } from "playwright";

export class KeepAuthError extends Error {
  constructor() {
    super(
      "Google Keep: not logged in. Use the /keep login command to open a browser window and sign in.",
    );
    this.name = "KeepAuthError";
  }
}

type SessionLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
};

export type KeepSessionOptions = {
  profileDir: string;
  timeoutMs: number;
  logger: SessionLogger;
};

export class KeepSession {
  private context: BrowserContext | null = null;

  constructor(private opts: KeepSessionOptions) {}

  private async launchContext(headless: boolean): Promise<BrowserContext> {
    const { chromium } = await import("playwright");
    return chromium.launchPersistentContext(this.opts.profileDir, { headless });
  }

  async getPage(): Promise<Page> {
    if (!this.context) {
      this.opts.logger.info("google-keep: starting headless browser");
      this.context = await this.launchContext(true);
    }
    const pages = this.context.pages();
    return pages[0] ?? (await this.context.newPage());
  }

  async close(): Promise<void> {
    const ctx = this.context;
    this.context = null;
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
    }
  }

  async openLoginBrowser(): Promise<{ context: BrowserContext; page: Page }> {
    await this.close();
    this.opts.logger.info("google-keep: opening visible browser for login");
    const ctx = await this.launchContext(false);
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto("https://keep.google.com/", {
      timeout: this.opts.timeoutMs,
      waitUntil: "domcontentloaded",
    });
    return { context: ctx, page };
  }
}

export function isAuthUrl(url: string): boolean {
  return (
    url.includes("accounts.google.com") || url.includes("/ServiceLogin") || url.includes("/signin")
  );
}
