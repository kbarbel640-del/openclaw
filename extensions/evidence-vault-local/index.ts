import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { EvidenceVault } from "./vault.js";

const evidenceVaultPlugin = {
  id: "evidence-vault-local",
  name: "Evidence Vault (Local)",
  description: "Secure local storage for digital evidence with chain of custody.",
  kind: "tool",
  configSchema: {
    type: "object",
    properties: {
      vaultPath: { type: "string" }
    }
  },
  register(api: OpenClawPluginApi) {
    let vaultPromise: Promise<EvidenceVault> | null = null;

    const getVault = (ctx: any) => {
      if (!vaultPromise) {
        const defaultPath = path.join(api.runtime.paths.resolveConfigDir(), "vault");
        const vaultRoot = ctx.pluginConfig?.vaultPath || defaultPath;
        vaultPromise = EvidenceVault.create(vaultRoot);
      }
      return vaultPromise;
    };

    api.registerTool(
      async (ctx) => {
        const vault = await getVault(ctx);
        const actor = `agent:${ctx.sessionKey}`;

        return [
          {
            name: "evidence_ingest",
            description: "Ingest a file into the local evidence vault (Append-only).",
            schema: {
              type: "object",
              properties: {
                filePath: { type: "string", description: "Absolute path to the local file." },
                caseId: { type: "string", description: "Case/Investigation ID." },
                sensitivity: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
                retention: { type: "string", description: "Retention policy (e.g., 7y).", default: "7y" }
              },
              required: ["filePath", "caseId"],
            },
            execute: async (args: any) => {
              try {
                const item = await vault.ingest({
                  filePath: args.filePath,
                  caseId: args.caseId,
                  actor: actor,
                  sensitivity: args.sensitivity,
                  retention: args.retention
                });
                return {
                  status: "success",
                  evidenceId: item.evidence_id,
                  sha256: item.sha256,
                  receivedAt: item.received_at,
                  vaultPath: item.object_path
                };
              } catch (err: any) {
                return { status: "error", message: err.message };
              }
            }
          },
          {
            name: "evidence_verify",
            description: "Verify integrity of a vaulted item via re-hash.",
            schema: {
              type: "object",
              properties: {
                evidenceId: { type: "string" }
              },
              required: ["evidenceId"]
            },
            execute: async (args: any) => {
              return await vault.verify(args.evidenceId, actor);
            }
          },
          {
            name: "evidence_manifest",
            description: "Generate/Retrieve the deterministic manifest for a case.",
            schema: {
              type: "object",
              properties: {
                caseId: { type: "string" }
              },
              required: ["caseId"]
            },
            execute: async (args: any) => {
              const manifest = await vault.getManifest(args.caseId);
              return manifest ? { status: "success", manifest } : { status: "error", message: "Case not found" };
            }
          },
          {
            name: "evidence_export",
            description: "Export all evidence items for a case into a ZIP package.",
            schema: {
              type: "object",
              properties: {
                caseId: { type: "string" }
              },
              required: ["caseId"]
            },
            execute: async (args: any) => {
              try {
                const result = await vault.exportCase(args.caseId, actor);
                return { status: "success", zipPath: result.zipPath, sha256: result.sha256 };
              } catch (err: any) {
                return { status: "error", message: err.message };
              }
            }
          }
        ];
      },
      { names: ["evidence_ingest", "evidence_verify", "evidence_manifest", "evidence_export"] }
    );
  },
};

export default evidenceVaultPlugin;
