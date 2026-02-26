/**
 * @description Extracts the `to` and optional `accountId` fields from a raw
 * agent tool call argument object, but only when the `action` field matches
 * `expectedAction`. Used by channel plugins to identify outbound send
 * requests from tool call payloads.
 *
 * @param args - The raw tool call argument object.
 * @param expectedAction - The action name to match against `args.action`.
 *   Defaults to `"sendMessage"`.
 * @returns An object `{ to, accountId? }` when the action matches and `to`
 *   is a non-empty string, or `null` when the call is not a matching send.
 *
 * @example
 * ```ts
 * const send = extractToolSend(toolArgs);
 * if (send) {
 *   await deliverMessage(send.to, content, send.accountId);
 * }
 * ```
 */
export function extractToolSend(
  args: Record<string, unknown>,
  expectedAction = "sendMessage",
): { to: string; accountId?: string } | null {
  const action = typeof args.action === "string" ? args.action.trim() : "";
  if (action !== expectedAction) {
    return null;
  }
  const to = typeof args.to === "string" ? args.to : undefined;
  if (!to) {
    return null;
  }
  const accountId = typeof args.accountId === "string" ? args.accountId.trim() : undefined;
  return { to, accountId };
}
