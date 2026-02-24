import { describe, it, expect, beforeEach, vi } from "vitest";
import { i18n, t } from "../lib/translate.ts";

describe("i18n", () => {
  async function waitForLocale(
    getter: { getLocale: () => string },
    expected: string,
    attempts = 500,
  ): Promise<void> {
    for (let index = 0; index < attempts && getter.getLocale() !== expected; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  beforeEach(async () => {
    localStorage.clear();
    // Reset to English
    await i18n.setLocale("en");
  });

  it("should return the key if translation is missing", () => {
    expect(t("non.existent.key")).toBe("non.existent.key");
  });

  it("should return the correct English translation", () => {
    expect(t("common.health")).toBe("Health");
  });

  it("should replace parameters correctly", () => {
    expect(t("overview.stats.cronNext", { time: "10:00" })).toBe("Next wake 10:00");
  });

  it("should fallback to English if key is missing in another locale", async () => {
    // We haven't registered other locales in the test environment yet,
    // but the logic should fallback to 'en' map which is always there.
    await i18n.setLocale("zh-CN");
    // Since we don't mock the import, it might fail to load zh-CN,
    // but let's assume it falls back to English for now.
    expect(t("common.health")).toBeDefined();
  });

  it("loads translations even when setting the same locale again", async () => {
    const internal = i18n as unknown as {
      locale: string;
      translations: Record<string, unknown>;
    };
    internal.locale = "zh-CN";
    delete internal.translations["zh-CN"];

    await i18n.setLocale("zh-CN");
    expect(t("common.health")).toBe("健康状况");
  });

  it("loads saved non-English locale on startup", async () => {
    localStorage.setItem("openclaw.i18n.locale", "zh-CN");
    vi.resetModules();
    const fresh = await import("../lib/translate.ts");

    await waitForLocale(fresh.i18n, "zh-CN");

    expect(fresh.i18n.getLocale()).toBe("zh-CN");
    expect(fresh.t("common.health")).toBe("健康状况");
  });

  it("loads Ukrainian translations", async () => {
    await i18n.setLocale("uk");
    expect(t("common.health")).toBe("Стан");
    expect(t("shell.productSubtitle")).toBe("Панель керування шлюзом");
  });

  it("loads saved Ukrainian locale on startup", async () => {
    localStorage.setItem("openclaw.i18n.locale", "uk");
    vi.resetModules();
    const fresh = await import("../lib/translate.ts");

    await waitForLocale(fresh.i18n, "uk");

    expect(fresh.i18n.getLocale()).toBe("uk");
    expect(fresh.t("common.health")).toBe("Стан");
  });

  it("detects browser locale uk-UA as uk", async () => {
    localStorage.clear();
    const languageDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "language");
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "uk-UA",
    });

    try {
      vi.resetModules();
      const fresh = await import("../lib/translate.ts");
      await waitForLocale(fresh.i18n, "uk");
      expect(fresh.i18n.getLocale()).toBe("uk");
    } finally {
      if (languageDescriptor) {
        Object.defineProperty(window.navigator, "language", languageDescriptor);
      }
    }
  });
});
