import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Mem0SQLite } from "./mem0.js";

const memoryMem0Plugin = {
  id: "memory-mem0",
  name: "Memory (Mem0)",
  description: "Mem0 adapter for SQLite-based token economy.",
  kind: "memory",
  configSchema: {
    type: "object",
    properties: {
      databasePath: { type: "string" }
    }
  },
  register(api: OpenClawPluginApi) {
    let mem0Promise: Promise<Mem0SQLite> | null = null;

    const getMem0 = (ctx: any) => {
      if (!mem0Promise) {
        const defaultPath = path.join(api.runtime.paths.resolveConfigDir(), "mem0.db");
        const dbPath = ctx.pluginConfig?.databasePath || defaultPath;
        mem0Promise = Mem0SQLite.create(dbPath);
      }
      return mem0Promise;
    };

    // Register Tools to interact with Mem0
    api.registerTool(
      async (ctx) => {
        const mem0 = await getMem0(ctx);
        return [
          {
            name: "memory_mem0_add",
            description: "Add a new memory to a specific layer (pref, fact, task).",
            schema: {
              type: "object",
              properties: {
                content: { type: "string" },
                layer: { type: "string", enum: ["pref", "fact", "task"], default: "fact" },
                metadata: { type: "object" }
              },
              required: ["content"]
            },
            execute: async (args: any) => {
              await mem0.addMemory(args.layer, args.content, args.metadata);
              return { status: "success", message: "Memory added." };
            }
          },
          {
            name: "memory_mem0_get",
            description: "Retrieve relevant memories for the current context.",
            schema: {
              type: "object",
              properties: {
                budget: { type: "number", default: 900 }
              }
            },
            execute: async (args: any) => {
              const context = await mem0.getContext(args.budget);
              return { status: "success", context };
            }
          }
        ];
      },
      { names: ["memory_mem0_add", "memory_mem0_get"] }
    );

    // Hook: Update session summary during compaction or end of turn
    api.registerHook("after_compaction", async (event: any, ctx: any) => {
       const mem0 = await getMem0(ctx);
       if (event.sessionFile) {
         // Read session file and extract summary for persistence
       }
       const mem0 = await getMem0(ctx);
       if (ctx.summary) {
         await mem0.updateSessionSummary(ctx.summary);
       }
    });
  },
};

export default memoryMem0Plugin;
