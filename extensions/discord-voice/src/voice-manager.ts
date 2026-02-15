import {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
  type VoiceConnection,
} from "@discordjs/voice";
import { EventEmitter } from "node:events";
import type { LoggerLike } from "./types.js";

const DEFAULT_JOIN_TIMEOUT_MS = 30_000;
const DEFAULT_RECONNECT_ATTEMPTS = 3;

type VoiceState = { status?: unknown };
type RejoinableVoiceConnection = VoiceConnection & {
  rejoin?: () => boolean;
  state?: VoiceState;
};

export interface VoiceManagerConfig {
  maxConcurrentChannels: number;
  allowedGuilds: string[];
  allowedChannels: string[];
  joinTimeoutMs?: number;
  reconnectAttempts?: number;
}

export interface JoinParams {
  channelId: string;
  guildId: string;
  adapterCreator: any; // DiscordGatewayAdapterCreator
  selfDeaf?: boolean;
  selfMute?: boolean;
}

export class VoiceManager extends EventEmitter {
  private connections: Map<string, VoiceConnection> = new Map();
  private config: VoiceManagerConfig;
  private logger: LoggerLike;
  private reconnectingGuilds = new Set<string>();
  private stateChangeHandlers = new Map<
    string,
    (oldState: VoiceState, newState: VoiceState) => void
  >();

  constructor(config: VoiceManagerConfig, logger: LoggerLike) {
    super();

    this.config = {
      ...config,
      joinTimeoutMs: config.joinTimeoutMs ?? DEFAULT_JOIN_TIMEOUT_MS,
      reconnectAttempts: config.reconnectAttempts ?? DEFAULT_RECONNECT_ATTEMPTS,
    };
    this.logger = logger;
  }

  async join(params: JoinParams): Promise<VoiceConnection> {
    this.ensureAllowed(params.guildId, params.channelId);

    const existing = this.connections.get(params.guildId) ?? getVoiceConnection(params.guildId);
    if (existing) {
      if (!this.connections.has(params.guildId)) {
        this.connections.set(params.guildId, existing);
        this.attachConnectionListeners(params.guildId, existing);
      }
      this.logger.info(`Using existing voice connection for guild ${params.guildId}`);
      return existing;
    }

    if (this.isAtCapacity()) {
      const message = `Cannot join guild ${params.guildId}: voice channel capacity reached (${this.config.maxConcurrentChannels})`;
      this.logger.warn(message);
      throw new Error(message);
    }

    let connection: VoiceConnection | undefined;
    try {
      this.logger.info(`Joining voice channel ${params.channelId} in guild ${params.guildId}`);
      connection = joinVoiceChannel({
        channelId: params.channelId,
        guildId: params.guildId,
        adapterCreator: params.adapterCreator,
        selfDeaf: params.selfDeaf ?? true,
        selfMute: params.selfMute ?? false,
      });

      await entersState(
        connection,
        VoiceConnectionStatus.Ready,
        this.config.joinTimeoutMs ?? DEFAULT_JOIN_TIMEOUT_MS,
      );

      this.connections.set(params.guildId, connection);
      this.attachConnectionListeners(params.guildId, connection);
      this.logger.info(`Voice connection ready for guild ${params.guildId}`);
      this.emit("connected", { guildId: params.guildId, connection, reconnected: false });
      return connection;
    } catch (error) {
      if (connection) {
        try {
          connection.destroy();
        } catch {
          // Best effort cleanup if join failed.
        }
      }

      const reason = error instanceof Error ? error.message : String(error);
      const message = `Failed to join guild ${params.guildId} channel ${params.channelId}: ${reason}`;
      this.logger.error(message);
      throw new Error(message);
    }
  }

  async leave(guildId: string): Promise<void> {
    const connection = this.connections.get(guildId) ?? getVoiceConnection(guildId);
    if (!connection) {
      this.logger.debug?.(`No voice connection found for guild ${guildId}`);
      return;
    }

    this.logger.info(`Leaving voice channel in guild ${guildId}`);
    this.cleanupConnection(guildId, connection, true);
    connection.destroy();
  }

  async leaveAll(): Promise<void> {
    const guildIds = [...this.connections.keys()];
    for (const guildId of guildIds) {
      await this.leave(guildId);
    }
  }

  getConnection(guildId: string): VoiceConnection | undefined {
    return this.connections.get(guildId);
  }

  getActiveCount(): number {
    return this.connections.size;
  }

  isAtCapacity(): boolean {
    return this.connections.size >= this.config.maxConcurrentChannels;
  }

  async destroy(): Promise<void> {
    this.logger.info("Destroying VoiceManager and all active connections");
    await this.leaveAll();
    this.reconnectingGuilds.clear();
    this.removeAllListeners();
  }

  private ensureAllowed(guildId: string, channelId: string): void {
    if (!this.isAllowed(this.config.allowedGuilds, guildId)) {
      const message = `Guild ${guildId} is not allowed for voice connections`;
      this.logger.warn(message);
      throw new Error(message);
    }

    if (!this.isAllowed(this.config.allowedChannels, channelId)) {
      const message = `Channel ${channelId} is not allowed for voice connections`;
      this.logger.warn(message);
      throw new Error(message);
    }
  }

  private isAllowed(allowedList: string[], value: string): boolean {
    return allowedList.length === 0 || allowedList.includes(value);
  }

  private attachConnectionListeners(guildId: string, connection: VoiceConnection): void {
    const stateChangeHandler = (oldState: VoiceState, newState: VoiceState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        void this.handleDisconnected(guildId, connection as RejoinableVoiceConnection);
        return;
      }

      if (newState.status === VoiceConnectionStatus.Destroyed) {
        this.logger.info(`Voice connection destroyed for guild ${guildId}`);
        this.cleanupConnection(guildId, connection, true);
        return;
      }

      this.logger.debug?.(
        `Voice state change for guild ${guildId}: ${String(oldState.status)} -> ${String(newState.status)}`,
      );
    };

    this.stateChangeHandlers.set(guildId, stateChangeHandler);
    connection.on("stateChange", stateChangeHandler);
  }

  private detachConnectionListeners(guildId: string, connection: VoiceConnection): void {
    const handler = this.stateChangeHandlers.get(guildId);
    if (!handler) {
      return;
    }

    this.stateChangeHandlers.delete(guildId);
    if (typeof connection.off === "function") {
      connection.off("stateChange", handler);
    } else {
      connection.removeListener("stateChange", handler);
    }
  }

  private cleanupConnection(
    guildId: string,
    connection: VoiceConnection,
    emitDestroyed: boolean,
  ): boolean {
    const current = this.connections.get(guildId);
    if (!current || current !== connection) {
      return false;
    }

    this.detachConnectionListeners(guildId, connection);
    this.connections.delete(guildId);
    this.reconnectingGuilds.delete(guildId);

    if (emitDestroyed) {
      this.emit("destroyed", { guildId, connection });
    }

    return true;
  }

  private async handleDisconnected(
    guildId: string,
    connection: RejoinableVoiceConnection,
  ): Promise<void> {
    if (this.reconnectingGuilds.has(guildId)) {
      return;
    }

    this.reconnectingGuilds.add(guildId);
    const attempts = this.config.reconnectAttempts ?? DEFAULT_RECONNECT_ATTEMPTS;
    const timeoutMs = this.config.joinTimeoutMs ?? DEFAULT_JOIN_TIMEOUT_MS;

    try {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        this.logger.warn(
          `Voice disconnected in guild ${guildId}; reconnect attempt ${attempt}/${attempts}`,
        );

        try {
          connection.rejoin?.();
          await entersState(connection, VoiceConnectionStatus.Ready, timeoutMs);
          this.logger.info(`Voice reconnected in guild ${guildId}`);
          this.emit("connected", {
            guildId,
            connection,
            reconnected: true,
            attempt,
          });
          return;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Reconnect attempt ${attempt}/${attempts} failed for guild ${guildId}: ${reason}`,
          );
        }
      }

      this.logger.error(`Failed to reconnect voice in guild ${guildId} after ${attempts} attempts`);
      this.emit("disconnected", { guildId, connection });
      connection.destroy();
      this.cleanupConnection(guildId, connection, true);
    } finally {
      this.reconnectingGuilds.delete(guildId);
    }
  }
}
