import { describe, it, expect } from "vitest";
import { LogIntegrityChain } from "../../src/security/log-integrity.js";

describe("EO-004: Log Integrity Chain", () => {
  it("creates a chain and generates seals", () => {
    const chain = new LogIntegrityChain("test-secret-key");
    const seal1 = chain.seal({ message: "first entry", level: "info" });
    expect(seal1).toBeTruthy();
    expect(typeof seal1).toBe("string");
  });

  it("generates different seals for different entries", () => {
    const chain = new LogIntegrityChain("test-secret-key");
    const seal1 = chain.seal({ message: "entry 1", level: "info" });
    const seal2 = chain.seal({ message: "entry 2", level: "info" });
    expect(seal1).not.toBe(seal2);
  });

  it("verifies a valid chain", () => {
    const chain = new LogIntegrityChain("test-secret-key");
    const entries: Array<{ data: unknown; seal: string }> = [];
    entries.push({ data: { message: "entry 1" }, seal: chain.seal({ message: "entry 1" }) });
    entries.push({ data: { message: "entry 2" }, seal: chain.seal({ message: "entry 2" }) });
    const isValid = LogIntegrityChain.verify(entries, "test-secret-key");
    expect(isValid).toBe(true);
  });

  it("detects tampering", () => {
    const chain = new LogIntegrityChain("test-secret-key");
    const entries: Array<{ data: unknown; seal: string }> = [];
    entries.push({ data: { message: "entry 1" }, seal: chain.seal({ message: "entry 1" }) });
    entries.push({ data: { message: "entry 2" }, seal: chain.seal({ message: "entry 2" }) });
    // Tamper with first entry
    entries[0].data = { message: "TAMPERED" };
    const isValid = LogIntegrityChain.verify(entries, "test-secret-key");
    expect(isValid).toBe(false);
  });
});