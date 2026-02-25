// Stored message row from SQLite
export type StoredMessage = {
  id: number;
  conversation_id: string;
  sender: string;
  sender_name: string | null;
  content: string;
  timestamp: number; // ms epoch
  direction: "inbound" | "outbound";
  channel_id: string;
};

// Plugin configuration with defaults
export type PluginConfig = {
  ollamaUrl: string;
  model: string;
  debounceMs: number;
  cooldownMs: number;
  contextMessageLimit: number;
  dbPath: string;
  outputDir: string;
};

// Default configuration values
export const DEFAULT_CONFIG: PluginConfig = {
  ollamaUrl: "http://localhost:11434",
  model: "llama3.1:8b",
  debounceMs: 5000,
  cooldownMs: 300000,
  contextMessageLimit: 20,
  dbPath: "passive/messages.db",
  outputDir: "passive",
};
