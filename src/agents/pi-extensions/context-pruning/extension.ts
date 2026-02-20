import type { ContextEvent, ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { pruneContextMessages } from "./pruner.js";
import { getContextPruningRuntime } from "./runtime.js";

export default function contextPruningExtension(api: ExtensionAPI): void {
  api.on("context", (event: ContextEvent, ctx: ExtensionContext) => {
    const runtime = getContextPruningRuntime(ctx.sessionManager);
    if (!runtime) {
      return undefined;
    }

    if (runtime.settings.mode === "cache-ttl") {
      const ttlMs = runtime.settings.ttlMs;
      if (ttlMs <= 0) {
        return undefined;
      }
      const lastTouch = runtime.lastCacheTouchAt ?? null;
      // If lastTouch is null (no prior Anthropic call recorded, e.g. after a gateway
      // restart that wrote a zero-timestamp entry), allow pruning immediately — the
      // cache is effectively cold and there is no TTL window to respect.
      if (lastTouch !== null && Date.now() - lastTouch < ttlMs) {
        return undefined;
      }
    }

    const next = pruneContextMessages({
      messages: event.messages,
      settings: runtime.settings,
      ctx,
      isToolPrunable: runtime.isToolPrunable,
      contextWindowTokensOverride: runtime.contextWindowTokens ?? undefined,
    });

    if (next === event.messages) {
      return undefined;
    }

    if (runtime.settings.mode === "cache-ttl") {
      runtime.lastCacheTouchAt = Date.now();
    }

    return { messages: next };
  });
}
