import { describe, expect, it, vi } from "vitest";
import type { WizardPrompter } from "../wizard/prompts.js";
import { applyAuthChoiceApiProviders } from "./auth-choice.apply.api-providers.js";

const mocks = vi.hoisted(() => ({
  setZaiApiKey: vi.fn(async () => {}),
  resolveAuthStorePathForDisplay: vi.fn(() => "/tmp/auth-profiles.json"),
}));

vi.mock("../agents/auth-profiles.js", async (importActual) => {
  const actual = await importActual<typeof import("../agents/auth-profiles.js")>();
  return {
    ...actual,
    resolveAuthStorePathForDisplay: mocks.resolveAuthStorePathForDisplay,
  };
});

vi.mock("./onboard-auth.js", async (importActual) => {
  const actual = await importActual<typeof import("./onboard-auth.js")>();
  return {
    ...actual,
    setZaiApiKey: mocks.setZaiApiKey,
  };
});

describe("applyAuthChoiceApiProviders (zai)", () => {
  it("notes where the Z.AI API key is stored after prompting", async () => {
    const notes: Array<{ message: string; title?: string }> = [];

    const prompter: WizardPrompter = {
      text: vi.fn(async () => "zai-test-key"),
      confirm: vi.fn(async () => false),
      note: vi.fn(async (message, title) => {
        notes.push({ message: String(message), title: title ? String(title) : undefined });
      }),
      select: vi.fn(async () => "global"),
    } as unknown as WizardPrompter;

    await applyAuthChoiceApiProviders({
      authChoice: "zai-coding-cn",
      config: {},
      prompter,
      runtime: { log: vi.fn(), error: vi.fn(), exit: vi.fn() },
      setDefaultModel: true,
    });

    expect(mocks.setZaiApiKey).toHaveBeenCalledWith("zai-test-key", undefined);
    expect(
      notes.some(
        (n) => n.title === "Credentials saved" && n.message.includes("Saved Z.AI API key"),
      ),
    ).toBe(true);
    expect(notes.some((n) => n.message.includes("/tmp/auth-profiles.json"))).toBe(true);
  });
});
