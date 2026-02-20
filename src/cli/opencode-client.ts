import { spawn } from "child_process";

interface BridgeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  view?: string;
}

interface BridgeContext {
  channel?: string;
  isAdmin?: boolean;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class OpenClawClient {
  constructor(private binPath: string = process.env.OPENCLAW_BIN || "openclaw") {}

  async execute<T>(
    action: string,
    args: Record<string, unknown> = {},
    options: { context?: BridgeContext; timeout?: number } = {},
  ): Promise<BridgeResponse<T>> {
    const isTsFile = this.binPath.endsWith(".ts");
    const isJsFile = this.binPath.endsWith(".js");
    const cmd = isTsFile ? "npx" : isJsFile ? "node" : this.binPath;
    const cmdArgs = isTsFile
      ? ["tsx", this.binPath, "bridge"]
      : isJsFile
        ? [this.binPath, "bridge"]
        : ["bridge"];

    const timeoutMs = options.timeout ?? 10000;

    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        action,
        args,
        context: {
          channel: "opencode-client",
          isAdmin: true, // Default to true for backward compatibility/ease of use, but overridable
          ...options.context,
        },
      });

      const child = spawn(cmd, cmdArgs, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          try {
            const errResponse = JSON.parse(stdout);
            resolve(errResponse);
          } catch {
            reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
          }
          return;
        }

        try {
          const response = JSON.parse(stdout);
          resolve(response);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          reject(new Error(`Failed to parse response: ${errorMsg}\nOutput: ${stdout}`));
        }
      });

      child.stdin.write(payload);
      child.stdin.end();
    });
  }
}

// Example usage if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new OpenClawClient();
  console.log("Fetching agents...");
  client.execute("agents.list").then(console.log).catch(console.error);
}
