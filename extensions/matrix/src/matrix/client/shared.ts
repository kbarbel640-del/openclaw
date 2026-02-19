import type { MatrixClient } from "@vector-im/matrix-bot-sdk";
import { LogService } from "@vector-im/matrix-bot-sdk";
import type { CoreConfig } from "../types.js";
import type { MatrixAuth } from "./types.js";
import { resolveMatrixAuth } from "./config.js";
import { createMatrixClient } from "./create-client.js";
import { DEFAULT_ACCOUNT_KEY } from "./storage.js";

type SharedMatrixClientState = {
  client: MatrixClient;
  key: string;
  started: boolean;
  cryptoReady: boolean;
};

const sharedClientStates = new Map<string, SharedMatrixClientState>();
const sharedClientPromises = new Map<string, Promise<SharedMatrixClientState>>();
const sharedClientStartPromises = new Map<string, Promise<void>>();

function resolveAccountKey(accountId?: string | null): string {
  return accountId ?? DEFAULT_ACCOUNT_KEY;
}

function buildSharedClientKey(auth: MatrixAuth, accountId?: string | null): string {
  return [
    auth.homeserver,
    auth.userId,
    auth.accessToken,
    auth.encryption ? "e2ee" : "plain",
    resolveAccountKey(accountId),
  ].join("|");
}

function getSharedMatrixClientState(accountId?: string | null): SharedMatrixClientState | undefined {
  return sharedClientStates.get(resolveAccountKey(accountId));
}

function setSharedMatrixClientState(state: SharedMatrixClientState, accountId?: string | null): void {
  sharedClientStates.set(resolveAccountKey(accountId), state);
}

function clearSharedMatrixClientState(accountId?: string | null): void {
  sharedClientStates.delete(resolveAccountKey(accountId));
}

async function createSharedMatrixClient(params: {
  auth: MatrixAuth;
  timeoutMs?: number;
  accountId?: string | null;
}): Promise<SharedMatrixClientState> {
  const client = await createMatrixClient({
    homeserver: params.auth.homeserver,
    userId: params.auth.userId,
    accessToken: params.auth.accessToken,
    encryption: params.auth.encryption,
    localTimeoutMs: params.timeoutMs,
    accountId: params.accountId,
  });
  return {
    client,
    key: buildSharedClientKey(params.auth, params.accountId),
    started: false,
    cryptoReady: false,
  };
}

async function ensureSharedClientStarted(params: {
  state: SharedMatrixClientState;
  timeoutMs?: number;
  initialSyncLimit?: number;
  encryption?: boolean;
  accountId?: string | null;
}): Promise<void> {
  if (params.state.started) {
    return;
  }

  const accountKey = resolveAccountKey(params.accountId);
  const existingStart = sharedClientStartPromises.get(accountKey);
  if (existingStart) {
    await existingStart;
    return;
  }

  const startPromise = (async () => {
    const client = params.state.client;

    // Initialize crypto if enabled
    if (params.encryption && !params.state.cryptoReady) {
      try {
        const joinedRooms = await client.getJoinedRooms();
        if (client.crypto) {
          await client.crypto.prepare(joinedRooms);
          params.state.cryptoReady = true;
        }
      } catch (err) {
        LogService.warn("MatrixClientLite", "Failed to prepare crypto:", err);
      }
    }

    await client.start();
    params.state.started = true;
  })();

  sharedClientStartPromises.set(accountKey, startPromise);

  try {
    await startPromise;
  } finally {
    sharedClientStartPromises.delete(accountKey);
  }
}

export async function resolveSharedMatrixClient(
  params: {
    cfg?: CoreConfig;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    auth?: MatrixAuth;
    startClient?: boolean;
    accountId?: string | null;
  } = {},
): Promise<MatrixClient> {
  const auth = params.auth ?? (await resolveMatrixAuth({ cfg: params.cfg, env: params.env }));
  const key = buildSharedClientKey(auth, params.accountId);
  const shouldStart = params.startClient !== false;

  const existingState = getSharedMatrixClientState(params.accountId);
  if (existingState?.key === key) {
    if (shouldStart) {
      await ensureSharedClientStarted({
        state: existingState,
        timeoutMs: params.timeoutMs,
        initialSyncLimit: auth.initialSyncLimit,
        encryption: auth.encryption,
        accountId: params.accountId,
      });
    }
    return existingState.client;
  }

  const accountKey = resolveAccountKey(params.accountId);
  const existingPromise = sharedClientPromises.get(accountKey);
  if (existingPromise) {
    const pending = await existingPromise;
    if (pending.key === key) {
      if (shouldStart) {
        await ensureSharedClientStarted({
          state: pending,
          timeoutMs: params.timeoutMs,
          initialSyncLimit: auth.initialSyncLimit,
          encryption: auth.encryption,
          accountId: params.accountId,
        });
      }
      return pending.client;
    }

    pending.client.stop();
    clearSharedMatrixClientState(params.accountId);
    sharedClientPromises.delete(accountKey);
  }

  const createPromise = createSharedMatrixClient({
    auth,
    timeoutMs: params.timeoutMs,
    accountId: params.accountId,
  });
  sharedClientPromises.set(accountKey, createPromise);

  try {
    const created = await createPromise;
    setSharedMatrixClientState(created, params.accountId);
    if (shouldStart) {
      await ensureSharedClientStarted({
        state: created,
        timeoutMs: params.timeoutMs,
        initialSyncLimit: auth.initialSyncLimit,
        encryption: auth.encryption,
        accountId: params.accountId,
      });
    }
    return created.client;
  } finally {
    sharedClientPromises.delete(accountKey);
  }
}

export async function waitForMatrixSync(_params: {
  client: MatrixClient;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}): Promise<void> {
  // @vector-im/matrix-bot-sdk handles sync internally in start()
  // This is kept for API compatibility but is essentially a no-op now
}

export function stopSharedClient(accountId?: string | null): void {
  if (accountId !== undefined && accountId !== null) {
    const state = getSharedMatrixClientState(accountId);
    if (state) {
      state.client.stop();
      clearSharedMatrixClientState(accountId);
    }
    return;
  }

  for (const [key, state] of sharedClientStates.entries()) {
    state.client.stop();
    sharedClientStates.delete(key);
  }
  sharedClientPromises.clear();
  sharedClientStartPromises.clear();
}
