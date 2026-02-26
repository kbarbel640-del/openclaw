import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizeWebhookPath } from "./webhook-path.js";

export type RegisteredWebhookTarget<T> = {
  target: T;
  unregister: () => void;
};

/**
 * @description Registers a webhook target in a path-keyed map. The target's
 * `path` is normalized before insertion so that lookups are consistent. Returns
 * a handle containing the normalized target and an `unregister` callback.
 *
 * @param targetsByPath - Mutable map maintained by the channel plugin; maps
 *   normalized paths to arrays of registered targets.
 * @param target - The target object to register. Must include a `path` field.
 * @returns A `RegisteredWebhookTarget` containing the normalized target and an
 *   `unregister` function that removes it from the map.
 *
 * @example
 * ```ts
 * const registered = registerWebhookTarget(targetsByPath, {
 *   path: "/webhooks/my-bot",
 *   accountId: "default",
 * });
 * // later…
 * registered.unregister();
 * ```
 */
export function registerWebhookTarget<T extends { path: string }>(
  targetsByPath: Map<string, T[]>,
  target: T,
): RegisteredWebhookTarget<T> {
  const key = normalizeWebhookPath(target.path);
  const normalizedTarget = { ...target, path: key };
  const existing = targetsByPath.get(key) ?? [];
  targetsByPath.set(key, [...existing, normalizedTarget]);
  const unregister = () => {
    const updated = (targetsByPath.get(key) ?? []).filter((entry) => entry !== normalizedTarget);
    if (updated.length > 0) {
      targetsByPath.set(key, updated);
      return;
    }
    targetsByPath.delete(key);
  };
  return { target: normalizedTarget, unregister };
}

/**
 * @description Resolves the list of registered webhook targets for an incoming
 * HTTP request by normalizing the request's URL pathname and looking it up in
 * the target map.
 *
 * @param req - The incoming HTTP request whose `url` is inspected.
 * @param targetsByPath - Map of registered targets keyed by normalized path.
 * @returns An object with the matched `path` and its `targets` array, or
 *   `null` if no targets are registered for that path.
 */
export function resolveWebhookTargets<T>(
  req: IncomingMessage,
  targetsByPath: Map<string, T[]>,
): { path: string; targets: T[] } | null {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalizeWebhookPath(url.pathname);
  const targets = targetsByPath.get(path);
  if (!targets || targets.length === 0) {
    return null;
  }
  return { path, targets };
}

/**
 * @description Discriminated union describing the outcome of a single-target
 * webhook match operation.
 *
 * - `"none"` — no target matched the predicate.
 * - `"single"` — exactly one target matched; `.target` holds it.
 * - `"ambiguous"` — more than one target matched; the caller must decide how
 *   to handle the conflict.
 */
export type WebhookTargetMatchResult<T> =
  | { kind: "none" }
  | { kind: "single"; target: T }
  | { kind: "ambiguous" };

/**
 * @description Synchronously finds at most one target in `targets` that
 * satisfies the `isMatch` predicate. Returns `"none"` if nothing matches,
 * `"single"` when exactly one matches, or `"ambiguous"` when multiple match.
 *
 * @param targets - Array of registered webhook targets to search.
 * @param isMatch - Synchronous predicate that returns `true` for a matching
 *   target.
 * @returns A {@link WebhookTargetMatchResult} discriminated union.
 *
 * @example
 * ```ts
 * const result = resolveSingleWebhookTarget(targets, (t) => t.accountId === "main");
 * if (result.kind === "single") {
 *   handleWebhook(result.target);
 * }
 * ```
 */
export function resolveSingleWebhookTarget<T>(
  targets: readonly T[],
  isMatch: (target: T) => boolean,
): WebhookTargetMatchResult<T> {
  let matched: T | undefined;
  for (const target of targets) {
    if (!isMatch(target)) {
      continue;
    }
    if (matched) {
      return { kind: "ambiguous" };
    }
    matched = target;
  }
  if (!matched) {
    return { kind: "none" };
  }
  return { kind: "single", target: matched };
}

/**
 * @description Async variant of {@link resolveSingleWebhookTarget}. Iterates
 * targets sequentially and awaits the `isMatch` predicate for each one.
 *
 * @param targets - Array of registered webhook targets to search.
 * @param isMatch - Async predicate that resolves to `true` for a matching
 *   target.
 * @returns A promise that resolves to a {@link WebhookTargetMatchResult}.
 */
export async function resolveSingleWebhookTargetAsync<T>(
  targets: readonly T[],
  isMatch: (target: T) => Promise<boolean>,
): Promise<WebhookTargetMatchResult<T>> {
  let matched: T | undefined;
  for (const target of targets) {
    if (!(await isMatch(target))) {
      continue;
    }
    if (matched) {
      return { kind: "ambiguous" };
    }
    matched = target;
  }
  if (!matched) {
    return { kind: "none" };
  }
  return { kind: "single", target: matched };
}

/**
 * @description Responds with HTTP 405 (Method Not Allowed) and returns `true`
 * when the request is not a `POST`. Call this at the top of a webhook handler
 * to guard against non-POST requests before processing the body.
 *
 * @param req - The incoming HTTP request to inspect.
 * @param res - The server response used to send the 405 reply.
 * @returns `true` if the request was rejected (caller should stop processing),
 *   `false` if the method is `POST` and handling should continue.
 *
 * @example
 * ```ts
 * if (rejectNonPostWebhookRequest(req, res)) return;
 * // safe to process POST body here
 * ```
 */
export function rejectNonPostWebhookRequest(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method === "POST") {
    return false;
  }
  res.statusCode = 405;
  res.setHeader("Allow", "POST");
  res.end("Method Not Allowed");
  return true;
}
