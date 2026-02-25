import { z } from "zod";

/**
 * Docker configuration schema.
 *
 * Used when running OpenClaw inside a Docker container with volume mounts.
 * The `hostStateDir` option enables path conversion in `systemPromptReport`,
 * converting container paths to host-accessible paths.
 *
 * Example:
 * If OPENCLAW_STATE_DIR=/root/.openclaw and `docker.hostStateDir` is set to
 * C:\Users\admin\.openclaw, then `/root/.openclaw/workspace-guanguan` would be converted
 * to `C:\Users\admin\.openclaw\workspace-guanguan` in `systemPromptReport`.
 *
 * Can also be set via `OPENCLAW_HOST_STATE_DIR` environment variable.
 */
export const DockerSchema = z
  .object({
    /**
     * The host filesystem path corresponding to OPENCLAW_STATE_DIR inside the container.
     *
     * When set, paths in `systemPromptReport` (workspaceDir, injectedWorkspaceFiles[].path)
     * will be converted from container paths to host paths.
     *
     * Example: If OPENCLAW_STATE_DIR=/root/.openclaw and this is set to
     C:\Users\admin\.openclaw, then /root/.openclaw/workspace-guanguan
     * becomes C:\Users\admin\.openclaw\workspace-guanguan
     *
     * This is particularly useful when external tools running on the host
     * (like Claude Code) need to access files referenced in `systemPromptReport`.
     */
    hostStateDir: z.string().optional(),
  })
  .strict()
  .optional();
