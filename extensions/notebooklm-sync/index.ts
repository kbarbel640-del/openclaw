/**
 * NotebookLM Sync — OpenClaw extension plugin.
 *
 * Registers:
 * 1. A `knowledge_ingest` agent tool to fetch and save knowledge sources
 * 2. (Optional) A Google OAuth provider for Drive/Docs API access
 *
 * For private Google pages (NotebookLM, etc.), the tool automatically uses
 * the user's Chrome browser via OpenClaw Browser Relay — no separate OAuth
 * setup required. The user just needs to be logged into Google in Chrome.
 */

import path from "node:path";
import { Type } from "@sinclair/typebox";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import type { OpenClawPluginApi } from "../../src/plugins/types.js";
import {
  loginGoogleDrive,
  refreshAccessToken,
  PROVIDER_ID,
  PROFILE_PREFIX,
} from "./src/google-auth.js";
import { ingestSources, type IngestResult } from "./src/ingest.js";

function resolveMemoryDir(api: OpenClawPluginApi): string {
  const stateDir = api.runtime.state.resolveStateDir();
  // Resolve workspace dir from config: agents.defaults.memorySearch is where
  // the memory system reads its workspace. Fall back to state dir.
  const cfg = api.config as Record<string, unknown>;
  const agents = cfg?.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const memSearch = defaults?.memorySearch as Record<string, unknown> | undefined;
  const workspaceDir = memSearch?.workspaceDir as string | undefined;
  if (workspaceDir && typeof workspaceDir === "string") {
    return path.join(workspaceDir, "memory");
  }
  return path.join(stateDir, "memory");
}

type AuthProfileEntry = {
  type: string;
  provider: string;
  access?: string;
  refresh?: string;
  expires?: number;
};

type AuthProfileStore = {
  version?: number;
  profiles: Record<string, AuthProfileEntry>;
  order?: Record<string, string[]>;
  lastGood?: Record<string, string>;
  usageStats?: Record<string, unknown>;
};

/** Lazy-load the auth profile store module (ESM-safe) */
async function loadAuthStore(): Promise<{
  ensureAuthProfileStore: (agentDir?: string) => AuthProfileStore;
  saveAuthProfileStore: (store: AuthProfileStore, agentDir?: string) => void;
} | null> {
  try {
    const mod = await import("../../src/agents/auth-profiles/store.js");
    return {
      ensureAuthProfileStore: mod.ensureAuthProfileStore as (agentDir?: string) => AuthProfileStore,
      saveAuthProfileStore: mod.saveAuthProfileStore as (
        store: AuthProfileStore,
        agentDir?: string,
      ) => void,
    };
  } catch {
    return null;
  }
}

/** Try to read (and refresh if needed) the stored Google OAuth access token */
async function resolveAccessToken(
  pluginConfig?: Record<string, unknown>,
): Promise<string | undefined> {
  const storeMod = await loadAuthStore();
  if (!storeMod) return undefined;

  try {
    const store = storeMod.ensureAuthProfileStore(undefined);
    for (const [profileId, cred] of Object.entries(store.profiles)) {
      if (
        profileId.startsWith(PROFILE_PREFIX) &&
        cred.type === "oauth" &&
        cred.provider === PROVIDER_ID &&
        cred.access
      ) {
        // Token still valid
        if (typeof cred.expires === "number" && Date.now() < cred.expires) {
          return cred.access;
        }

        // Token expired — try to refresh
        if (cred.refresh) {
          try {
            const refreshed = await refreshAccessToken(cred.refresh, pluginConfig);
            // Persist refreshed tokens back to the store
            store.profiles[profileId] = {
              ...cred,
              access: refreshed.access,
              refresh: refreshed.refresh,
              expires: refreshed.expires,
            };
            storeMod.saveAuthProfileStore(store, undefined);
            return refreshed.access;
          } catch {
            // Refresh failed — token is unusable
          }
        }
      }
    }
  } catch {
    // Auth store not available or read error
  }
  return undefined;
}

const KnowledgeIngestSchema = Type.Object({
  urls: Type.Array(Type.String({ description: "URL of the knowledge source to ingest" }), {
    description:
      "List of URLs to ingest into the knowledge base. " +
      "Supported: web pages, PDF links, Google Docs links, YouTube video links.",
    minItems: 1,
  }),
});

function createKnowledgeIngestTool(api: OpenClawPluginApi) {
  const memoryDir = resolveMemoryDir(api);

  return {
    name: "knowledge_ingest",
    label: "Knowledge Ingest",
    description:
      "Ingest knowledge sources (web pages, PDFs, Google Docs, YouTube videos) into the local knowledge base. " +
      "Fetches content from the given URLs, converts to Markdown, and saves to the memory directory " +
      "so it becomes searchable via memory_search. " +
      "Use this when the user wants to add external content to their knowledge base. " +
      "For private Google pages (NotebookLM, etc.), the tool automatically uses the Chrome Browser Relay " +
      "to access content with the user's existing Google login session.",
    parameters: KnowledgeIngestSchema,
    async execute(_id: string, params: Record<string, unknown>) {
      const urls = Array.isArray(params.urls)
        ? (params.urls as unknown[]).map((u) => String(u)).filter(Boolean)
        : [];
      if (urls.length === 0) {
        throw new Error("At least one URL is required");
      }

      // OAuth token is optional — used for Google Docs API access if available.
      // For private Google web pages (NotebookLM), the browser fallback handles auth.
      const accessToken = await resolveAccessToken(
        api.pluginConfig as Record<string, unknown> | undefined,
      );

      const results = await ingestSources({
        urls,
        memoryDir,
        accessToken,
      });

      return formatIngestResults(results);
    },
  };
}

function formatIngestResults(results: IngestResult[]) {
  const succeeded = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);

  const summary: Record<string, unknown> = {
    total: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
  };

  if (succeeded.length > 0) {
    summary.ingested = succeeded.map((r) => ({
      title: r.title,
      source: r.source,
      type: r.sourceType,
      chars: r.charCount,
    }));
  }

  if (failed.length > 0) {
    summary.errors = failed.map((r) => ({
      source: r.source,
      type: r.sourceType,
      error: r.error,
    }));
  }

  summary.note =
    succeeded.length > 0
      ? "Content saved to knowledge base. It will be available via memory_search after the next sync."
      : "No content was ingested. Check the errors above.";

  return {
    content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
    details: summary,
  };
}

const notebooklmSyncPlugin = {
  id: "notebooklm-sync",
  name: "NotebookLM Sync",
  description:
    "Sync knowledge sources (web, PDF, Google Docs, YouTube) into OpenClaw memory. " +
    "Enables using NotebookLM notebook sources as an OpenClaw knowledge base.",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // Register the knowledge_ingest tool for the AI agent
    api.registerTool(createKnowledgeIngestTool(api));

    // Register Google OAuth provider for Drive/Docs access
    api.registerProvider({
      id: PROVIDER_ID,
      label: "NotebookLM Sync (Google Drive)",
      docsPath: "/tools/notebooklm-sync",
      aliases: ["notebooklm", "nbsync"],
      auth: [
        {
          id: "oauth",
          label: "Google OAuth (Drive read-only)",
          hint: "PKCE + localhost callback — grants read-only access to Google Drive/Docs",
          kind: "oauth",
          run: async (ctx) => {
            const spin = ctx.prompter.progress("Starting Google Drive OAuth…");
            try {
              const result = await loginGoogleDrive({
                isRemote: ctx.isRemote,
                openUrl: ctx.openUrl,
                prompt: async (message) => String(await ctx.prompter.text({ message })),
                note: ctx.prompter.note,
                log: (message) => ctx.runtime.log(message),
                progress: spin,
                pluginConfig: api.pluginConfig as Record<string, unknown> | undefined,
              });

              const profileId = `${PROFILE_PREFIX}${result.email ?? "default"}`;
              return {
                profiles: [
                  {
                    profileId,
                    credential: {
                      type: "oauth" as const,
                      provider: PROVIDER_ID,
                      access: result.access,
                      refresh: result.refresh,
                      expires: result.expires,
                      email: result.email,
                    },
                  },
                ],
                notes: [
                  "Google Drive read-only access authorized.",
                  "You can now ingest Google Docs into your knowledge base.",
                  "Scope: drive.readonly (no write access to your files).",
                ],
              };
            } catch (err) {
              spin.stop("Google Drive OAuth failed");
              throw err;
            }
          },
        },
      ],
    });
  },
};

export default notebooklmSyncPlugin;
