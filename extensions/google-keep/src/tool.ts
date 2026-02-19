import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { jsonResult } from "openclaw/plugin-sdk";
import { extractUncheckedItems } from "./dom.js";
import { isAuthUrl, KeepAuthError, type KeepSession } from "./session.js";

type KeepPluginConfig = {
  listUrl?: string;
  timeoutMs?: number;
};

export function createKeepTool(api: OpenClawPluginApi, session: KeepSession) {
  return {
    name: "google_keep_list",
    label: "Google Keep List",
    description:
      "Fetch unchecked items from a Google Keep shared list note. Returns a JSON array of item texts.",
    parameters: Type.Object({
      listUrl: Type.Optional(
        Type.String({
          description:
            "Google Keep note URL (e.g. https://keep.google.com/#NOTE_ID). Defaults to the configured listUrl.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of items to return. Returns all if omitted.",
        }),
      ),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const cfg = (api.pluginConfig ?? {}) as KeepPluginConfig;
      const urlParam = typeof params.listUrl === "string" ? params.listUrl.trim() : undefined;
      const url = urlParam || cfg.listUrl?.trim();

      if (!url) {
        throw new Error(
          "No Google Keep note URL provided. Pass listUrl parameter or set listUrl in plugin config.",
        );
      }

      const limit =
        typeof params.limit === "number" && params.limit > 0 ? Math.floor(params.limit) : undefined;

      const timeoutMs = cfg.timeoutMs ?? 15_000;

      const page = await session.getPage();
      await page.goto(url, { timeout: timeoutMs, waitUntil: "domcontentloaded" });

      const currentUrl = page.url();
      if (isAuthUrl(currentUrl)) {
        throw new KeepAuthError();
      }

      const allItems = await extractUncheckedItems(page);
      const items = limit !== undefined ? allItems.slice(0, limit) : allItems;

      return jsonResult({ items, count: items.length, url });
    },
  };
}
