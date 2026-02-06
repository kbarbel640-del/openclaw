import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

async function writeDockerStub(binDir: string, logPath: string) {
  const stub = `#!/usr/bin/env bash
set -euo pipefail
log="$DOCKER_STUB_LOG"
if [[ "\${1:-}" == "compose" && "\${2:-}" == "version" ]]; then
  exit 0
fi
if [[ "\${1:-}" == "build" ]]; then
  echo "build $*" >>"$log"
  exit 0
fi
if [[ "\${1:-}" == "compose" ]]; then
  echo "compose $*" >>"$log"
  exit 0
fi
echo "unknown $*" >>"$log"
exit 0
`;

  await mkdir(binDir, { recursive: true });
  await writeFile(join(binDir, "docker"), stub, { mode: 0o755 });
  await writeFile(logPath, "");
}

describe("docker-setup.sh", () => {
  it("handles unset optional env vars under strict mode", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "openclaw-docker-setup-"));
    const scriptPath = join(rootDir, "docker-setup.sh");
    const dockerfilePath = join(rootDir, "Dockerfile");
    const composePath = join(rootDir, "docker-compose.yml");
    const binDir = join(rootDir, "bin");
    const logPath = join(rootDir, "docker-stub.log");

    const script = await readFile(join(repoRoot, "docker-setup.sh"), "utf8");
    await writeFile(scriptPath, script, { mode: 0o755 });
    await writeFile(dockerfilePath, "FROM scratch\n");
    await writeFile(
      composePath,
      "services:\n  openclaw-gateway:\n    image: noop\n  openclaw-cli:\n    image: noop\n",
    );
    await writeDockerStub(binDir, logPath);

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      DOCKER_STUB_LOG: logPath,
      OPENCLAW_GATEWAY_TOKEN: "test-token",
      OPENCLAW_CONFIG_DIR: join(rootDir, "config"),
      OPENCLAW_WORKSPACE_DIR: join(rootDir, "openclaw"),
    };
    delete env.OPENCLAW_DOCKER_APT_PACKAGES;
    delete env.OPENCLAW_EXTRA_MOUNTS;
    delete env.OPENCLAW_HOME_VOLUME;

    const result = spawnSync("bash", [scriptPath], {
      cwd: rootDir,
      env,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const envFile = await readFile(join(rootDir, ".env"), "utf8");
    expect(envFile).toContain("OPENCLAW_DOCKER_APT_PACKAGES=");
    expect(envFile).toContain("OPENCLAW_EXTRA_MOUNTS=");
    expect(envFile).toContain("OPENCLAW_HOME_VOLUME=");
  });

  it("plumbs OPENCLAW_DOCKER_APT_PACKAGES into .env and docker build args", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "openclaw-docker-setup-"));
    const scriptPath = join(rootDir, "docker-setup.sh");
    const dockerfilePath = join(rootDir, "Dockerfile");
    const composePath = join(rootDir, "docker-compose.yml");
    const binDir = join(rootDir, "bin");
    const logPath = join(rootDir, "docker-stub.log");

    const script = await readFile(join(repoRoot, "docker-setup.sh"), "utf8");
    await writeFile(scriptPath, script, { mode: 0o755 });
    await writeFile(dockerfilePath, "FROM scratch\n");
    await writeFile(
      composePath,
      "services:\n  openclaw-gateway:\n    image: noop\n  openclaw-cli:\n    image: noop\n",
    );
    await writeDockerStub(binDir, logPath);

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      DOCKER_STUB_LOG: logPath,
      OPENCLAW_DOCKER_APT_PACKAGES: "ffmpeg build-essential",
      OPENCLAW_GATEWAY_TOKEN: "test-token",
      OPENCLAW_CONFIG_DIR: join(rootDir, "config"),
      OPENCLAW_WORKSPACE_DIR: join(rootDir, "openclaw"),
      OPENCLAW_EXTRA_MOUNTS: "",
      OPENCLAW_HOME_VOLUME: "",
    };

    const result = spawnSync("bash", [scriptPath], {
      cwd: rootDir,
      env,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const envFile = await readFile(join(rootDir, ".env"), "utf8");
    expect(envFile).toContain("OPENCLAW_DOCKER_APT_PACKAGES=ffmpeg build-essential");

    const log = await readFile(logPath, "utf8");
    expect(log).toContain("--build-arg OPENCLAW_DOCKER_APT_PACKAGES=ffmpeg build-essential");
  });

  it("upsert_env is bash 3.2 compatible and handles missing + existing keys (#10316)", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "openclaw-docker-setup-"));
    const scriptPath = join(rootDir, "test-upsert.sh");

    // Extract upsert_env from docker-setup.sh and test it in isolation
    const script = await readFile(join(repoRoot, "docker-setup.sh"), "utf8");
    const fnMatch = script.match(/^upsert_env\(\)[\s\S]*?^\}/m);
    expect(fnMatch).not.toBeNull();

    const envFile = join(rootDir, "test.env");
    const testScript = `#!/usr/bin/env bash
set -euo pipefail
${fnMatch![0]}

export KEY_A=alpha
export KEY_B=beta
export KEY_C=gamma

# Seed .env with one existing key and a comment
printf '# header\nKEY_A=old\n' > "${envFile}"

upsert_env "${envFile}" KEY_A KEY_B KEY_C
`;

    await writeFile(scriptPath, testScript, { mode: 0o755 });

    const result = spawnSync("bash", [scriptPath], {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const content = await readFile(envFile, "utf8");
    const lines = content.split("\n").filter(Boolean);

    // Comment preserved
    expect(lines[0]).toBe("# header");
    // KEY_A updated in place
    expect(lines[1]).toBe("KEY_A=alpha");
    // KEY_B and KEY_C appended (were missing)
    expect(lines[2]).toBe("KEY_B=beta");
    expect(lines[3]).toBe("KEY_C=gamma");
    // No duplicates
    expect(lines.filter((l: string) => l.startsWith("KEY_A="))).toHaveLength(1);
  });

  it("keeps docker-compose gateway command in sync", async () => {
    const compose = await readFile(join(repoRoot, "docker-compose.yml"), "utf8");
    expect(compose).not.toContain("gateway-daemon");
    expect(compose).toContain('"gateway"');
  });
});
