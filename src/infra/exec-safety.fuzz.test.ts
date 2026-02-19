import fc from "fast-check";
/**
 * Property-based fuzz tests for exec-safety validation functions.
 *
 * Uses fast-check to generate thousands of random inputs and verify
 * that isSafeExecutableValue() and isSafePathValue() uphold their
 * security invariants under all possible inputs.
 */
import { describe, it } from "vitest";
import { isSafeExecutableValue, isSafePathValue } from "./exec-safety.js";

const SHELL_METACHARS = [";", "&", "|", "`", "$", "<", ">"];
const _CONTROL_CHARS = ["\r", "\n"];
const QUOTE_CHARS = ["'", '"'];

describe("exec-safety fuzz tests", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Property 1: Functions never throw on string inputs
  // (these functions accept string | null | undefined — NOT arbitrary types)
  // ═══════════════════════════════════════════════════════════════════════

  describe("crash resistance", () => {
    it("isSafeExecutableValue never throws on arbitrary string input", () => {
      fc.assert(
        fc.property(fc.string(), (s) => {
          const result = isSafeExecutableValue(s);
          return typeof result === "boolean";
        }),
        { numRuns: 10_000 },
      );
    });

    it("isSafePathValue never throws on arbitrary string input", () => {
      fc.assert(
        fc.property(fc.string(), (s) => {
          const result = isSafePathValue(s);
          return typeof result === "boolean";
        }),
        { numRuns: 10_000 },
      );
    });

    it("isSafeExecutableValue handles null and undefined", () => {
      fc.assert(
        fc.property(fc.constantFrom(null, undefined, ""), (input) => {
          return !isSafeExecutableValue(input);
        }),
        { numRuns: 100 },
      );
    });

    it("isSafePathValue handles null and undefined", () => {
      fc.assert(
        fc.property(fc.constantFrom(null, undefined, ""), (input) => {
          return !isSafePathValue(input);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 2: Shell metacharacters are always rejected
  // ═══════════════════════════════════════════════════════════════════════

  describe("shell metacharacter invariants", () => {
    it("any string containing a shell metachar is rejected by isSafeExecutableValue", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.constantFrom(...SHELL_METACHARS),
          fc.string({ minLength: 0, maxLength: 100 }),
          (prefix, meta, suffix) => {
            return !isSafeExecutableValue(prefix + meta + suffix);
          },
        ),
        { numRuns: 5_000 },
      );
    });

    it("any string containing a shell metachar is rejected by isSafePathValue", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.constantFrom(...SHELL_METACHARS),
          fc.string({ minLength: 0, maxLength: 100 }),
          (prefix, meta, suffix) => {
            return !isSafePathValue(prefix + meta + suffix);
          },
        ),
        { numRuns: 5_000 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 3: Control characters are always rejected
  // Use safe alphabetic prefix/suffix to isolate the control char invariant
  // ═══════════════════════════════════════════════════════════════════════

  describe("control character invariants", () => {
    // Note: JavaScript's trim() strips \r and \n from string edges.
    // The functions call trim() before the CONTROL_CHARS check, so edge-only
    // control chars get stripped. This is acceptable — the real threat is
    // embedded control chars (newline injection mid-command), not trailing whitespace.
    // These tests verify that EMBEDDED control chars are always rejected.

    it("embedded \\r or \\n is rejected by isSafeExecutableValue", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("a", "cmd", "/bin/sh", "node"),
          fc.constantFrom("\r", "\n"),
          fc.constantFrom("b", "evil", "injected"),
          (prefix, ctrl, suffix) => {
            // Control char is between two non-empty strings — not an edge
            const input = prefix + ctrl + suffix;
            return !isSafeExecutableValue(input);
          },
        ),
        { numRuns: 500 },
      );
    });

    it("embedded \\r or \\n is rejected by isSafePathValue", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("/tmp", "/var", "/home/user"),
          fc.constantFrom("\r", "\n"),
          fc.constantFrom("file", "dir", "evil"),
          (prefix, ctrl, suffix) => {
            const input = prefix + ctrl + suffix;
            return !isSafePathValue(input);
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 4: Null bytes are always rejected
  // ═══════════════════════════════════════════════════════════════════════

  describe("null byte invariants", () => {
    it("any string containing \\0 is rejected by both functions", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (prefix, suffix) => {
            const input = prefix + "\0" + suffix;
            return !isSafeExecutableValue(input) && !isSafePathValue(input);
          },
        ),
        { numRuns: 3_000 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 5: Quotes are always rejected
  // ═══════════════════════════════════════════════════════════════════════

  describe("quote invariants", () => {
    it("any string containing quotes is rejected by both functions", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.constantFrom(...QUOTE_CHARS),
          fc.string({ minLength: 0, maxLength: 100 }),
          (prefix, quote, suffix) => {
            const input = prefix + quote + suffix;
            return !isSafeExecutableValue(input) && !isSafePathValue(input);
          },
        ),
        { numRuns: 3_000 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 6: Empty/whitespace is always rejected
  // ═══════════════════════════════════════════════════════════════════════

  describe("empty/whitespace invariants", () => {
    it("whitespace-only strings are rejected by both functions", () => {
      fc.assert(
        fc.property(fc.nat({ max: 20 }), (n) => {
          const ws = " ".repeat(n);
          return !isSafeExecutableValue(ws) && !isSafePathValue(ws);
        }),
        { numRuns: 100 },
      );
    });

    it("tab-only strings are rejected by both functions", () => {
      fc.assert(
        fc.property(fc.nat({ max: 20 }), (n) => {
          const ws = "\t".repeat(n);
          return !isSafeExecutableValue(ws) && !isSafePathValue(ws);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 7: Path length limit enforced
  // ═══════════════════════════════════════════════════════════════════════

  describe("path length invariants", () => {
    it("paths longer than 4096 chars are rejected by isSafePathValue", () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 4000 }).map((n) => n + 4097),
          (len) => {
            const path = "/" + "a".repeat(len - 1);
            return !isSafePathValue(path);
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Property 8: Attack payload composition
  // ═══════════════════════════════════════════════════════════════════════

  describe("composed attack payloads", () => {
    it("command chaining patterns are always rejected", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom("; ", " && ", " || ", " | "),
          fc.string({ minLength: 1, maxLength: 50 }),
          (cmd1, separator, cmd2) => {
            const payload = cmd1 + separator + cmd2;
            return !isSafeExecutableValue(payload) && !isSafePathValue(payload);
          },
        ),
        { numRuns: 3_000 },
      );
    });

    it("subshell injection patterns are always rejected", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (cmd) => {
          const backtick = "`" + cmd + "`";
          const dollar = "$(" + cmd + ")";
          return (
            !isSafeExecutableValue(backtick) &&
            !isSafeExecutableValue(dollar) &&
            !isSafePathValue(backtick) &&
            !isSafePathValue(dollar)
          );
        }),
        { numRuns: 3_000 },
      );
    });
  });
});
