/**
 * GitHub Backup Setup — creates a private backup repository during installation.
 *
 * Flow:
 *   1. User provides a Personal Access Token (PAT) with `repo` scope
 *   2. Validate the PAT by calling the GitHub API
 *   3. Create a private repo named `openclaw-backup-<machine-hash>`
 *   4. Store encrypted PAT + repo info in electron-store
 *   5. Initialize with a README and initial commit
 */

import { createHmac } from "node:crypto";
import os from "node:os";

interface GitHubRepo {
  fullName: string;
  cloneUrl: string;
  htmlUrl: string;
}

interface GitHubUser {
  login: string;
  name: string;
}

export class GitHubBackupSetup {
  private static readonly API_BASE = "https://api.github.com";

  /**
   * Validate a PAT and return the authenticated user info.
   */
  async validatePAT(pat: string): Promise<{ ok: true; user: GitHubUser } | { ok: false; reason: string }> {
    try {
      const res = await fetch(`${GitHubBackupSetup.API_BASE}/user`, {
        headers: this.headers(pat),
      });

      if (res.status === 401) {return { ok: false, reason: "Invalid token. Ensure the PAT is valid." };}
      if (!res.ok) {return { ok: false, reason: `GitHub API error: ${res.status}` };}

      const user = await res.json() as { login: string; name: string };
      return { ok: true, user: { login: user.login, name: user.name ?? user.login } };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "Network error connecting to GitHub",
      };
    }
  }

  /**
   * Create the backup repository for the authenticated user.
   * Returns the created repo info.
   */
  async createBackupRepo(pat: string): Promise<{ ok: true; repo: GitHubRepo } | { ok: false; reason: string }> {
    const repoName = `openclaw-backup-${this.machineHash()}`;

    try {
      // Check if repo already exists
      const checkRes = await fetch(
        `${GitHubBackupSetup.API_BASE}/user/repos?type=private&per_page=100`,
        { headers: this.headers(pat) },
      );

      if (checkRes.ok) {
        const repos = await checkRes.json() as { name: string; full_name: string; clone_url: string; html_url: string }[];
        const existing = repos.find((r) => r.name === repoName);
        if (existing) {
          return {
            ok: true,
            repo: {
              fullName: existing.full_name,
              cloneUrl: existing.clone_url,
              htmlUrl: existing.html_url,
            },
          };
        }
      }

      // Create new private repo
      const res = await fetch(`${GitHubBackupSetup.API_BASE}/user/repos`, {
        method: "POST",
        headers: this.headers(pat),
        body: JSON.stringify({
          name: repoName,
          description: "OpenClaw Command Center — automated configuration backups",
          private: true,
          auto_init: true,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        return { ok: false, reason: body.message ?? `GitHub API error: ${res.status}` };
      }

      const repo = await res.json() as { full_name: string; clone_url: string; html_url: string };
      return {
        ok: true,
        repo: {
          fullName: repo.full_name,
          cloneUrl: repo.clone_url,
          htmlUrl: repo.html_url,
        },
      };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "Failed to create backup repository",
      };
    }
  }

  /** Check if a PAT has the `repo` scope. */
  async checkRepoScope(pat: string): Promise<boolean> {
    try {
      const res = await fetch(`${GitHubBackupSetup.API_BASE}/user`, {
        headers: this.headers(pat),
      });
      const scopes = res.headers.get("x-oauth-scopes") ?? "";
      return scopes.split(",").map((s) => s.trim()).some((s) => s === "repo" || s === "public_repo");
    } catch {
      return false;
    }
  }

  private headers(pat: string): Record<string, string> {
    return {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "OpenClaw-Command-Center/0.1.0",
      "Content-Type": "application/json",
    };
  }

  private machineHash(): string {
    const raw = `${os.hostname()}:${os.userInfo().username}:${os.homedir()}`;
    return createHmac("sha256", "occc-backup-key").update(raw).digest("hex").slice(0, 8);
  }
}
