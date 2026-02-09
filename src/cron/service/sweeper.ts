/** Regex for per-run cron session keys: `...:cron:<jobId>:run:<uuid>` */
const CRON_RUN_KEY_RE = /:cron:[^:]+:run:[^:]+$/;

/** True if the session key matches the `:run:` pattern. Exported for testing. */
export function isCronRunSessionKey(key: string): boolean {
  return CRON_RUN_KEY_RE.test(key);
}
