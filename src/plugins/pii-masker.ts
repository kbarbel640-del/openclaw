/**
 * Global PII Masker Registry
 *
 * Allows plugins to register synchronous PII masking functions that are applied
 * to all messages before they are persisted to session transcripts.
 *
 * Uses globalThis to ensure a truly global singleton across all module instances.
 */

type PiiMasker = (text: string) => string;

// Symbol key for global storage to avoid collisions
const PII_MASKER_KEY = Symbol.for("moltbot.piiMasker");

type GlobalWithMasker = typeof globalThis & {
  [PII_MASKER_KEY]?: PiiMasker | null;
};

/**
 * Register a PII masking function. Only one masker can be registered at a time.
 * Later registrations override earlier ones.
 */
export function registerPiiMasker(masker: PiiMasker): void {
  (globalThis as GlobalWithMasker)[PII_MASKER_KEY] = masker;
}

/**
 * Unregister the current PII masker.
 */
export function unregisterPiiMasker(): void {
  (globalThis as GlobalWithMasker)[PII_MASKER_KEY] = null;
}

/**
 * Get the registered PII masker, or null if none is registered.
 */
export function getPiiMasker(): PiiMasker | null {
  return (globalThis as GlobalWithMasker)[PII_MASKER_KEY] ?? null;
}

/**
 * Apply PII masking to text if a masker is registered.
 * Returns the original text if no masker is registered.
 */
export function maskPii(text: string): string {
  const masker = getPiiMasker();
  return masker ? masker(text) : text;
}
