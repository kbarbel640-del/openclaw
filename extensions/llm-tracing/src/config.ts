export type LlmTracingConfig = {
  enabled?: boolean;
  endpoint?: string;
  headers?: Record<string, string>;
  serviceName?: string;
  sampleRate?: number;
};

export function normalizeEndpoint(endpoint?: string): string | undefined {
  const trimmed = endpoint?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
}

export function resolveOtelTracesUrl(endpoint: string | undefined): string | undefined {
  if (!endpoint) {
    return undefined;
  }
  // If endpoint already contains /v1/traces, use as-is
  if (endpoint.includes("/v1/traces")) {
    return endpoint;
  }
  // Otherwise append the path
  return `${endpoint}/v1/traces`;
}
