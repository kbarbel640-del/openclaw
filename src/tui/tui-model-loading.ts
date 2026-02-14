export function formatModelLoadingMessage(modelName: string): string {
  return `🌱 Loading ${modelName} into memory...\n   First load takes 10-30s depending on model size.`;
}

export function formatModelLoadedMessage(modelName: string, durationMs: number): string {
  const seconds = (durationMs / 1000).toFixed(1);
  return `🌿 ${modelName} loaded in ${seconds}s — ready to chat!`;
}

export function formatFirstTokenMessage(ttftMs: number): string {
  const seconds = (ttftMs / 1000).toFixed(1);
  return `⚡ First token in ${seconds}s`;
}
