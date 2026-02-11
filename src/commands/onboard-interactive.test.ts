import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";

const wizardMock = vi.hoisted(() => ({
  runOnboardingWizard: vi.fn(),
}));

vi.mock("../wizard/onboarding.js", () => wizardMock);

vi.mock("../terminal/restore.js", () => ({
  restoreTerminalState: vi.fn(),
}));

import { WizardCancelledError } from "../wizard/prompts.js";
import { runInteractiveOnboarding } from "./onboard-interactive.js";

const runtime: RuntimeEnv = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

describe("runInteractiveOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exits with code 1 when the wizard is cancelled", async () => {
    wizardMock.runOnboardingWizard.mockRejectedValue(new WizardCancelledError());

    await runInteractiveOnboarding({} as never, runtime);

    expect(runtime.exit).toHaveBeenCalledWith(1);
  });

  it("re-throws non-cancellation errors", async () => {
    const error = new Error("unexpected");
    wizardMock.runOnboardingWizard.mockRejectedValue(error);

    await expect(runInteractiveOnboarding({} as never, runtime)).rejects.toThrow("unexpected");
    expect(runtime.exit).not.toHaveBeenCalled();
  });
});
