export type MSTeamsMonitorLogger = {
  debug?: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

/**
 * Callback invoked once the msteams webhook HTTP server has successfully bound
 * to its port and is ready to accept incoming connections. This fires before
 * `monitorMSTeamsProvider` suspends waiting for the abort signal, giving
 * callers a clean hook to report the "provider is running" status without
 * racing against the server's actual bind.
 */
export type MSTeamsOnListeningCallback = () => void;
