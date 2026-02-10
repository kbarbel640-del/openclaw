import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import { WizardCancelledError } from "../wizard/prompts.js";
import { runInteractiveOnboarding } from "./onboard-interactive.js";

const mocks = vi.hoisted(() => ({
  createClackPrompter: vi.fn(() => ({ id: "prompter" })),
  runOnboardingWizard: vi.fn(async () => {}),
  restoreTerminalState: vi.fn(),
}));

vi.mock("../wizard/clack-prompter.js", () => ({
  createClackPrompter: mocks.createClackPrompter,
}));

vi.mock("../wizard/onboarding.js", () => ({
  runOnboardingWizard: mocks.runOnboardingWizard,
}));

vi.mock("../terminal/restore.js", () => ({
  restoreTerminalState: mocks.restoreTerminalState,
}));

function makeRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn() as unknown as RuntimeEnv["exit"],
  };
}

describe("runInteractiveOnboarding", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("restores terminal state without resuming stdin on success", async () => {
    const runtime = makeRuntime();

    await runInteractiveOnboarding({} as never, runtime);

    expect(mocks.runOnboardingWizard).toHaveBeenCalledOnce();
    expect(mocks.restoreTerminalState).toHaveBeenCalledWith("onboarding finish", {
      resumeStdin: false,
    });
  });

  it("restores terminal state without resuming stdin on cancel", async () => {
    const runtime = makeRuntime();
    mocks.runOnboardingWizard.mockRejectedValueOnce(new WizardCancelledError("cancelled"));

    await runInteractiveOnboarding({} as never, runtime);

    expect(runtime.exit).toHaveBeenCalledWith(0);
    expect(mocks.restoreTerminalState).toHaveBeenCalledWith("onboarding finish", {
      resumeStdin: false,
    });
  });
});
