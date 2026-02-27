/**
 * Runner abort check. Catches any abort-related message for embedded runners.
 * Keep this strict enough to avoid swallowing non-abort failures.
 */
export function isRunnerAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const name = "name" in err ? String(err.name) : "";
  if (name === "AbortError") {
    return true;
  }
  const code = "code" in err ? String(err.code) : "";
  if (code === "ABORT_ERR") {
    return true;
  }
  const message =
    "message" in err && typeof err.message === "string" ? err.message.toLowerCase() : "";
  if (message === "aborted") {
    return true;
  }
  return /^(?:this|the) operation was aborted(?:[.:].*)?$/.test(message);
}
