import type { AgentResponse, LoggerLike } from "./types.js";

const DEFAULT_RESPONSE_TIMEOUT_MS = 30_000;

export interface AgentBridgeConfig {
  responseTimeoutMs?: number;
}

export type MessageHandler = (params: {
  text: string;
  sessionKey: string;
  userId: string;
  userName: string;
  channelId: string;
  guildId: string;
}) => Promise<{ text: string } | null>;

export class AgentBridge {
  private config: Required<AgentBridgeConfig>;
  private logger: LoggerLike;
  private messageHandler: MessageHandler | null = null;

  constructor(config: AgentBridgeConfig, logger: LoggerLike) {
    this.config = {
      responseTimeoutMs: config.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS,
    };
    this.logger = logger;
  }

  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  static getSessionKey(guildId: string, channelId: string): string {
    return `discord:voice:${guildId}:${channelId}`;
  }

  async processUtterance(params: {
    text: string;
    userId: string;
    userName: string;
    guildId: string;
    channelId: string;
  }): Promise<AgentResponse | null> {
    const rawText = params.text ?? "";
    const normalizedText = rawText.trim();

    if (!normalizedText) {
      return null;
    }

    if (!this.messageHandler) {
      this.logger.warn("AgentBridge message handler is not set");
      return null;
    }

    const formattedText = `[Voice] ${params.userName}: ${normalizedText}`;
    const sessionKey = AgentBridge.getSessionKey(params.guildId, params.channelId);

    const timeoutController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const response = await Promise.race([
        this.messageHandler({
          text: formattedText,
          sessionKey,
          userId: params.userId,
          userName: params.userName,
          channelId: params.channelId,
          guildId: params.guildId,
        }),
        new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => {
            timeoutController.abort();
            resolve(null);
          }, this.config.responseTimeoutMs);
        }),
      ]);

      if (!response || timeoutController.signal.aborted) {
        if (timeoutController.signal.aborted) {
          this.logger.warn(
            `AgentBridge response timed out after ${this.config.responseTimeoutMs}ms`,
          );
        }
        return null;
      }

      return {
        text: response.text,
        sessionKey,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`AgentBridge failed to process utterance: ${reason}`);
      return null;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
