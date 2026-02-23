import { loadConfig } from "../config/config.js";
import {
  loadSessionStore,
  resolveStorePath,
  type SessionEntry,
  updateSessionStore,
} from "../config/sessions.js";
import type { RuntimeEnv } from "../runtime.js";
import { DEFAULT_AGENT_ID } from "../routing/session-key.js";
import { applyModelOverrideToSessionEntry } from "../sessions/model-overrides.js";

type SessionsResetOptions = {
  key?: string;
  agent?: string;
  model?: boolean;
  auth?: boolean;
  all?: boolean;
  json?: boolean;
};

type SessionsResetResult = {
  ok: true;
  sessionKey: string;
  changed: boolean;
  cleared: {
    model: boolean;
    auth: boolean;
  };
  storePath: string;
};

function clearAuthProfileOverrides(entry: SessionEntry): boolean {
  let changed = false;
  if (entry.authProfileOverride !== undefined) {
    delete entry.authProfileOverride;
    changed = true;
  }
  if (entry.authProfileOverrideSource !== undefined) {
    delete entry.authProfileOverrideSource;
    changed = true;
  }
  if (entry.authProfileOverrideCompactionCount !== undefined) {
    delete entry.authProfileOverrideCompactionCount;
    changed = true;
  }
  if (changed) {
    entry.updatedAt = Date.now();
  }
  return changed;
}

export async function sessionsResetCommand(
  opts: SessionsResetOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const sessionKey = opts.key?.trim();
  if (!sessionKey) {
    runtime.error("--key is required");
    runtime.exit(1);
    return;
  }

  const cfg = loadConfig();
  const agentId = opts.agent?.trim() || DEFAULT_AGENT_ID;
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  const currentStore = loadSessionStore(storePath);
  if (!currentStore[sessionKey]) {
    runtime.error(`Session not found: ${sessionKey}`);
    runtime.exit(1);
    return;
  }

  const clearAllByDefault = !opts.model && !opts.auth;
  const clearAll = Boolean(opts.all) || clearAllByDefault;
  const clearModel = clearAll || Boolean(opts.model);
  const clearAuth = clearAll || Boolean(opts.auth) || clearModel;

  const result = await updateSessionStore(storePath, (store) => {
    const entry = store[sessionKey];
    if (!entry) {
      return { found: false, changed: false };
    }

    let changed = false;
    if (clearModel) {
      const applied = applyModelOverrideToSessionEntry({
        entry,
        selection: {
          provider: "default",
          model: "default",
          isDefault: true,
        },
      });
      changed = applied.updated || changed;
    } else if (clearAuth) {
      changed = clearAuthProfileOverrides(entry) || changed;
    }

    if (changed) {
      store[sessionKey] = entry;
    }
    return { found: true, changed };
  });

  if (!result.found) {
    runtime.error(`Session not found: ${sessionKey}`);
    runtime.exit(1);
    return;
  }

  const payload: SessionsResetResult = {
    ok: true,
    sessionKey,
    changed: result.changed,
    cleared: {
      model: clearModel,
      auth: clearAuth,
    },
    storePath,
  };

  if (opts.json) {
    runtime.log(JSON.stringify(payload, null, 2));
    return;
  }

  const changedText = payload.changed ? "yes" : "no";
  runtime.log(`Reset session overrides for ${sessionKey}`);
  runtime.log(`Changed: ${changedText}`);
  runtime.log(`Cleared model overrides: ${payload.cleared.model ? "yes" : "no"}`);
  runtime.log(`Cleared auth overrides: ${payload.cleared.auth ? "yes" : "no"}`);
  runtime.log(`Session store: ${storePath}`);
}
