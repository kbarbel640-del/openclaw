function getErrorString(error: string | Error): string {
  return error instanceof Error ? error.message : error;
}

const ERROR_PATTERNS: Array<{
  test: (msg: string) => boolean;
  message: string;
  retryable: boolean;
  recovery: string | null;
}> = [
  {
    test: (m) => /ECONNREFUSED/i.test(m),
    message: "🌿 Can't reach Ollama. Is it running?\n  Start it: ollama serve",
    retryable: true,
    recovery: "ollama serve",
  },
  {
    test: (m) => /model.*not found|not found.*model/i.test(m),
    message: "🌿 Model not available locally.\n  Pull it: ollama pull <model>",
    retryable: false,
    recovery: "ollama pull <model>",
  },
  {
    test: (m) => /GPU.*out of memory|CUDA.*out of memory|VRAM/i.test(m),
    message: "🌿 GPU memory full.\n  The model will fall back to CPU (slower but works).",
    retryable: false,
    recovery: null,
  },
  {
    test: (m) => /out of memory|OOM/i.test(m),
    message: "🌿 Not enough RAM for this model.\n  Try a smaller one: ollama pull gemma3:4b\n  Or free memory: gclaw /models to switch",
    retryable: false,
    recovery: "ollama pull gemma3:4b",
  },
  {
    test: (m) => /context length exceeded/i.test(m),
    message: "🌿 Conversation too long for model's context window.\n  Use /compact to shrink history, or switch to a model with larger context.",
    retryable: false,
    recovery: "/compact",
  },
  {
    test: (m) => /503|model.*loading|loading.*model/i.test(m),
    message: "🌿 Model is loading into memory... This takes 10-30s on first use.",
    retryable: true,
    recovery: null,
  },
  {
    test: (m) => /timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(m),
    message: "🌿 Response timed out. Local models can be slow on first token.\n  Try again — subsequent responses are faster.",
    retryable: true,
    recovery: null,
  },
];

function matchError(error: string | Error) {
  const msg = getErrorString(error);
  return ERROR_PATTERNS.find((p) => p.test(msg)) ?? null;
}

export function formatOllamaError(error: string | Error): string {
  const match = matchError(error);
  if (match) return match.message;
  return `🌿 Something went wrong: ${getErrorString(error)}`;
}

export function isRetryableError(error: string | Error): boolean {
  return matchError(error)?.retryable ?? false;
}

export function suggestRecovery(error: string | Error): string | null {
  return matchError(error)?.recovery ?? null;
}
