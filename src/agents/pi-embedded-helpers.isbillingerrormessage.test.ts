import { describe, expect, it } from "vitest";
import { isBillingErrorMessage } from "./pi-embedded-helpers.js";
import { DEFAULT_AGENTS_FILENAME } from "./workspace.js";

const _makeFile = (overrides: Partial<WorkspaceBootstrapFile>): WorkspaceBootstrapFile => ({
  name: DEFAULT_AGENTS_FILENAME,
  path: "/tmp/AGENTS.md",
  content: "",
  missing: false,
  ...overrides,
});
describe("isBillingErrorMessage", () => {
  it("matches credit / payment failures", () => {
    const samples = [
      "Your credit balance is too low to access the Anthropic API.",
      "insufficient credits",
      "Payment Required",
      "HTTP 402 Payment Required",
      "plans & billing",
    ];
    for (const sample of samples) {
      expect(isBillingErrorMessage(sample)).toBe(true);
    }
  });
  it("ignores conversational text containing numbers (False Positives)", () => {
    const samples = [
      "Hi Robbie, testing the 402 text sanitizer bug fix",
      "My address is 402 Main Street",
      "Room 402 is available",
      "Bug 402 has been fixed",
      "Port 402 is open",
      "There are 402 items in the list",
      "Call me at 402-555-1234",
      "Section 402 of the tax code",
      "Flight 402 departs at 3pm",
    ];
    for (const sample of samples) {
      expect(isBillingErrorMessage(sample), `Expected '${sample}' NOT to be a billing error`).toBe(
        false,
      );
    }
  });
  it("ignores unrelated errors", () => {
    expect(isBillingErrorMessage("rate limit exceeded")).toBe(false);
    expect(isBillingErrorMessage("invalid api key")).toBe(false);
    expect(isBillingErrorMessage("context length exceeded")).toBe(false);
  });
});
