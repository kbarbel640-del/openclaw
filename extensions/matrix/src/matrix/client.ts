import type { createMatrixClient as CreateMatrixClientFn } from "./client/create-client.js";

export type { MatrixAuth, MatrixResolvedConfig } from "./client/types.js";
export { isBunRuntime } from "./client/runtime.js";
export {
  resolveMatrixConfig,
  resolveMatrixConfigForAccount,
  resolveMatrixAuth,
} from "./client/config.js";

export async function createMatrixClient(
  ...args: Parameters<CreateMatrixClientFn>
): ReturnType<CreateMatrixClientFn> {
  const mod = await import("./client/create-client.js");
  return mod.createMatrixClient(...args);
}

export {
  resolveSharedMatrixClient,
  waitForMatrixSync,
  stopSharedClient,
  stopSharedClientForAccount,
} from "./client/shared.js";
