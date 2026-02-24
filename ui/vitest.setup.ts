import { beforeEach } from "vitest";
import { i18n } from "./src/i18n/index.ts";

beforeEach(async () => {
  if (typeof navigator !== "undefined") {
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "en-US",
    });
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("openclaw.i18n.locale");
  }
  await i18n.setLocale("en");
});
