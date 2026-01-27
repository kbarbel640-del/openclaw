/** Per-IP auth rate limiter with exponential backoff. */
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;
const DECAY_MS = 15 * 60 * 1_000; // reset after 15min of inactivity
const CLEANUP_INTERVAL_MS = 5 * 60 * 1_000;

type Entry = {
  failures: number;
  lastFailure: number;
  blockedUntil: number;
};

export class AuthRateLimiter {
  private entries = new Map<string, Entry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  /** Returns true if the IP is currently blocked, false if allowed. */
  check(ip: string): boolean {
    const entry = this.entries.get(ip);
    if (!entry) return false;
    if (Date.now() - entry.lastFailure > DECAY_MS) {
      this.entries.delete(ip);
      return false;
    }
    return entry.blockedUntil > Date.now();
  }

  recordFailure(ip: string): void {
    const now = Date.now();
    const entry = this.entries.get(ip);
    if (entry && now - entry.lastFailure > DECAY_MS) {
      this.entries.delete(ip);
    }
    const existing = this.entries.get(ip);
    const failures = (existing?.failures ?? 0) + 1;
    const delay =
      failures >= MAX_ATTEMPTS
        ? Math.min(BASE_DELAY_MS * 2 ** (failures - MAX_ATTEMPTS), MAX_DELAY_MS)
        : 0;
    this.entries.set(ip, {
      failures,
      lastFailure: now,
      blockedUntil: now + delay,
    });
  }

  recordSuccess(ip: string): void {
    this.entries.delete(ip);
  }

  close(): void {
    clearInterval(this.cleanupTimer);
    this.entries.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.entries) {
      if (now - entry.lastFailure > DECAY_MS) {
        this.entries.delete(ip);
      }
    }
  }
}
