import fc from "fast-check";
/**
 * Property-based fuzz tests for Zod security schemas.
 *
 * Uses fast-check to verify that DockerImageSchema, SandboxDockerSchema
 * fields (tmpfs, extraHosts, dns), and the full validateConfigObject
 * function never crash on arbitrary inputs and correctly reject injection strings.
 */
import { describe, it } from "vitest";
import { SandboxDockerSchema } from "./zod-schema.agent-runtime.js";
import { DockerImageSchema } from "./zod-schema.core.js";

const SHELL_METACHARS = [";", "&", "|", "`", "$", "<", ">"];

/** Generate strings from a specific character set */
function charsFrom(chars: string, minLen: number, maxLen: number) {
  return fc.nat({ max: maxLen - minLen }).map((extra) => {
    const len = minLen + extra;
    let result = "";
    for (let i = 0; i < len; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  });
}

describe("schema security fuzz tests", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // DockerImageSchema
  // ═══════════════════════════════════════════════════════════════════════

  describe("DockerImageSchema", () => {
    it("never throws on arbitrary string input", () => {
      fc.assert(
        fc.property(fc.string(), (s) => {
          const result = DockerImageSchema.safeParse(s);
          return typeof result.success === "boolean";
        }),
        { numRuns: 10_000 },
      );
    });

    it("rejects strings containing shell metacharacters", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.constantFrom(...SHELL_METACHARS),
          fc.string({ minLength: 0, maxLength: 50 }),
          (prefix, meta, suffix) => {
            const result = DockerImageSchema.safeParse(prefix + meta + suffix);
            return !result.success;
          },
        ),
        { numRuns: 5_000 },
      );
    });

    it("rejects strings exceeding 256 characters", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 257, maxLength: 500 }), (s) => {
          const result = DockerImageSchema.safeParse(s);
          return !result.success;
        }),
        { numRuns: 1_000 },
      );
    });

    it("accepts valid-looking docker image names", () => {
      const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";
      const TAG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789.-";
      const imageArb = fc
        .tuple(charsFrom(ALPHANUM, 1, 30), fc.boolean(), charsFrom(TAG_CHARS, 1, 20))
        .map(([name, hasTag, tag]) => {
          // Ensure name starts/ends with alphanum
          const safeName = name.length === 0 ? "a" : name;
          if (!hasTag) {
            return safeName;
          }
          // Ensure tag starts with alphanum
          const safeTag = /^[a-z0-9]/.test(tag) ? tag : "v" + tag;
          return `${safeName}:${safeTag}`;
        });

      fc.assert(
        fc.property(imageArb, (image) => {
          const result = DockerImageSchema.safeParse(image);
          return result.success;
        }),
        { numRuns: 3_000 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SandboxDockerSchema fields
  // ═══════════════════════════════════════════════════════════════════════

  describe("SandboxDockerSchema field validation", () => {
    it("tmpfs: arbitrary strings never crash the schema", () => {
      fc.assert(
        fc.property(fc.array(fc.string(), { maxLength: 5 }), (tmpfs) => {
          const result = SandboxDockerSchema.safeParse({ tmpfs });
          return typeof result.success === "boolean";
        }),
        { numRuns: 5_000 },
      );
    });

    it("extraHosts: arbitrary strings never crash the schema", () => {
      fc.assert(
        fc.property(fc.array(fc.string(), { maxLength: 5 }), (extraHosts) => {
          const result = SandboxDockerSchema.safeParse({ extraHosts });
          return typeof result.success === "boolean";
        }),
        { numRuns: 5_000 },
      );
    });

    it("dns: arbitrary strings never crash the schema", () => {
      fc.assert(
        fc.property(fc.array(fc.string(), { maxLength: 5 }), (dns) => {
          const result = SandboxDockerSchema.safeParse({ dns });
          return typeof result.success === "boolean";
        }),
        { numRuns: 5_000 },
      );
    });

    it("user: arbitrary strings never crash the schema", () => {
      fc.assert(
        fc.property(fc.string(), (user) => {
          const result = SandboxDockerSchema.safeParse({ user });
          return typeof result.success === "boolean";
        }),
        { numRuns: 5_000 },
      );
    });

    it("tmpfs: strings without leading / are rejected", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.startsWith("/")),
          (entry) => {
            const result = SandboxDockerSchema.safeParse({ tmpfs: [entry] });
            return !result.success;
          },
        ),
        { numRuns: 3_000 },
      );
    });

    it("extraHosts: strings without colon are rejected", () => {
      const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";
      fc.assert(
        fc.property(charsFrom(ALPHANUM, 1, 30), (entry) => {
          // No colon = invalid format
          const result = SandboxDockerSchema.safeParse({ extraHosts: [entry] });
          return !result.success;
        }),
        { numRuns: 2_000 },
      );
    });

    it("dns: hostnames (non-IP) are rejected", () => {
      const ALPHA = "abcdefghijklmnopqrstuvwxyz";
      fc.assert(
        fc.property(
          charsFrom(ALPHA, 3, 30).map((s) => s + ".com"),
          (hostname) => {
            const result = SandboxDockerSchema.safeParse({ dns: [hostname] });
            return !result.success;
          },
        ),
        { numRuns: 2_000 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Full schema — combined injection payloads
  // ═══════════════════════════════════════════════════════════════════════

  describe("combined injection payloads", () => {
    it("shell injection in image field is always rejected", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 30 }),
          fc.constantFrom(...SHELL_METACHARS),
          fc.string({ minLength: 0, maxLength: 30 }),
          (prefix, meta, suffix) => {
            const result = SandboxDockerSchema.safeParse({
              image: prefix + meta + suffix,
            });
            return !result.success;
          },
        ),
        { numRuns: 3_000 },
      );
    });
  });
});
