/**
 * Ollama Security Utilities
 *
 * Ollama has NO built-in authentication. Anyone who can reach the Ollama port
 * can use your models, see your prompts, and consume your compute resources.
 *
 * NEVER expose Ollama to the network (0.0.0.0) without a reverse proxy that
 * handles authentication.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface OllamaSecurityStatus {
  isRunning: boolean;
  isExposedToNetwork: boolean;
  bindAddress: string | null;
  warnings: string[];
}

/**
 * Check if Ollama is running and whether it's securely configured.
 * Returns warnings if Ollama is exposed to the network.
 */
export async function checkOllamaSecurity(): Promise<OllamaSecurityStatus> {
  const status: OllamaSecurityStatus = {
    isRunning: false,
    isExposedToNetwork: false,
    bindAddress: null,
    warnings: [],
  };

  try {
    // Check listening sockets for Ollama port (11434)
    const { stdout } = await execAsync("ss -tlnp 2>/dev/null | grep 11434 || true");

    if (!stdout.trim()) {
      // Ollama not running or not listening
      return status;
    }

    status.isRunning = true;

    // Parse the bind address
    // Example output: "LISTEN 0 4096 127.0.0.1:11434 0.0.0.0:*"
    // Or dangerous:   "LISTEN 0 4096 0.0.0.0:11434 0.0.0.0:*"
    const lines = stdout.trim().split("\n");

    for (const line of lines) {
      // Check for dangerous bindings
      if (line.includes("0.0.0.0:11434")) {
        status.isExposedToNetwork = true;
        status.bindAddress = "0.0.0.0:11434";
        status.warnings.push(
          "Ollama is listening on 0.0.0.0:11434 (ALL network interfaces)",
          "Anyone on your network can access your Ollama instance",
          "This is a security risk - Ollama has no authentication",
          "Fix: Set OLLAMA_HOST=127.0.0.1:11434 and restart Ollama",
        );
      } else if (line.includes("[::]:11434")) {
        status.isExposedToNetwork = true;
        status.bindAddress = "[::]:11434";
        status.warnings.push(
          "Ollama is listening on [::]:11434 (ALL IPv6 interfaces)",
          "Anyone on your network can access your Ollama instance",
          "Fix: Set OLLAMA_HOST=127.0.0.1:11434 and restart Ollama",
        );
      } else if (line.includes("127.0.0.1:11434")) {
        status.bindAddress = "127.0.0.1:11434";
        // This is secure - localhost only
      }
    }
  } catch {
    // ss command not available or failed - can't determine status
    status.warnings.push("Could not verify Ollama network binding (ss command unavailable)");
  }

  return status;
}

/**
 * Validate that an Ollama URL is localhost-only.
 * Returns true if the URL is safe, false if it points to a non-local address.
 */
export function isOllamaUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Safe hostnames
    const safeHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];

    if (safeHosts.includes(hostname)) {
      return true;
    }

    // Check for localhost IPv6 variants
    if (hostname.startsWith("[") && hostname.includes("::1")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get a safe Ollama URL, always pointing to localhost.
 * Ignores any environment variables that might point elsewhere.
 */
export function getSafeOllamaUrl(): string {
  // Always return localhost - never trust environment variables for this
  return "http://127.0.0.1:11434";
}
