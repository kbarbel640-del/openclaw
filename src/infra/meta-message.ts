export const META_MESSAGE_PREFIX = "🤖";

export function prefixMetaMessage(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return normalized;
  }
  if (normalized.startsWith(META_MESSAGE_PREFIX)) {
    return normalized;
  }
  return `${META_MESSAGE_PREFIX} ${normalized}`;
}
