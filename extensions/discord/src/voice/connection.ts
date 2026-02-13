import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  getVoiceConnection,
  type VoiceConnection,
  type AudioPlayer,
  type DiscordGatewayAdapterLibraryMethods,
} from "@discordjs/voice";
// Use `unknown` for gateway payloads to avoid discord-api-types version
// mismatches between root and extension node_modules.
type VoiceGatewayPayload = Record<string, unknown>;
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type {
  VoiceChannelSession,
  VoiceChannelUser,
  VoiceJoinOptions,
  VoiceConnectionState,
} from "./types.js";
import { getGateway } from "../../../../src/discord/monitor/gateway-registry.js";

type VoiceConnectionEvents = {
  stateChange: [session: VoiceChannelSession, state: VoiceConnectionState];
  userJoin: [session: VoiceChannelSession, user: VoiceChannelUser];
  userLeave: [session: VoiceChannelSession, userId: string];
  userSpeaking: [session: VoiceChannelSession, userId: string, speaking: boolean];
  error: [session: VoiceChannelSession, error: Error];
  destroy: [session: VoiceChannelSession];
};

export class DiscordVoiceConnectionManager extends EventEmitter<VoiceConnectionEvents> {
  private sessions: Map<string, VoiceChannelSession> = new Map();
  private guildSessionIndex: Map<string, string> = new Map();
  /** Stores @discordjs/voice adapter methods per guild for forwarding gateway events. */
  private adapterMethods: Map<string, DiscordGatewayAdapterLibraryMethods> = new Map();
  private accountId: string | undefined;

  constructor(accountId?: string) {
    super();
    this.accountId = accountId;
  }

  async joinChannel(options: VoiceJoinOptions): Promise<VoiceChannelSession> {
    const existingSessionId = this.guildSessionIndex.get(options.guildId);
    if (existingSessionId) {
      const existing = this.sessions.get(existingSessionId);
      if (existing && existing.channelId === options.channelId) {
        return existing;
      }
      await this.leaveChannel({ guildId: options.guildId });
    }

    const sessionId = randomUUID();
    const connection = joinVoiceChannel({
      guildId: options.guildId,
      channelId: options.channelId,
      selfMute: options.selfMute ?? false,
      selfDeaf: options.selfDeaf ?? false,
      adapterCreator: this.createAdapterCreator(options.guildId),
    });

    const player = createAudioPlayer();

    const session: VoiceChannelSession = {
      sessionId,
      guildId: options.guildId,
      channelId: options.channelId,
      connection,
      player,
      state: "idle",
      users: new Map(),
      startedAt: Date.now(),
      transcript: [],
    };

    this.sessions.set(sessionId, session);
    this.guildSessionIndex.set(options.guildId, sessionId);

    this.setupConnectionHandlers(session);
    this.setupPlayerHandlers(session);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Voice connection timeout"));
      }, 30000);

      connection.once(VoiceConnectionStatus.Ready, () => {
        clearTimeout(timeout);
        session.state = "listening";
        this.emit("stateChange", session, "ready");
        resolve(session);
      });

      connection.once(VoiceConnectionStatus.Disconnected, () => {
        clearTimeout(timeout);
        reject(new Error("Voice connection disconnected"));
      });

      connection.once(VoiceConnectionStatus.Destroyed, () => {
        clearTimeout(timeout);
        reject(new Error("Voice connection destroyed"));
      });
    });
  }

  async leaveChannel(options: { guildId: string; reason?: string }): Promise<void> {
    const sessionId = this.guildSessionIndex.get(options.guildId);
    if (!sessionId) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.player) {
      session.player.stop();
    }

    if (session.connection) {
      session.connection.destroy();
    }

    session.endedAt = Date.now();
    session.state = "idle";

    this.sessions.delete(sessionId);
    this.guildSessionIndex.delete(options.guildId);

    this.emit("destroy", session);
  }

  getSession(guildId: string): VoiceChannelSession | undefined {
    const sessionId = this.guildSessionIndex.get(guildId);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  getAllSessions(): VoiceChannelSession[] {
    return Array.from(this.sessions.values());
  }

  getConnectionState(session: VoiceChannelSession): VoiceConnectionState {
    if (!session.connection) return "disconnected";

    switch (session.connection.state.status) {
      case VoiceConnectionStatus.Ready:
        return "ready";
      case VoiceConnectionStatus.Connecting:
      case VoiceConnectionStatus.Signalling:
        return "connecting";
      case VoiceConnectionStatus.Connected:
        return "connected";
      case VoiceConnectionStatus.Disconnected:
        return "disconnected";
      case VoiceConnectionStatus.Destroyed:
        return "disconnected";
      default:
        return "error";
    }
  }

  private setupConnectionHandlers(session: VoiceChannelSession): void {
    if (!session.connection) return;

    session.connection.on(VoiceConnectionStatus.Ready, () => {
      this.emit("stateChange", session, "ready");
    });

    session.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(session.connection!, VoiceConnectionStatus.Signalling, 5_000),
          entersState(session.connection!, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        if (session.connection) {
          session.connection.destroy();
        }
        this.emit("stateChange", session, "disconnected");
      }
    });

    session.connection.on("error", (error) => {
      this.emit("error", session, error);
    });

    // The SpeakingMap on the receiver emits 'start'/'end' when users
    // begin/stop transmitting audio packets in the voice channel.
    const speakingMap = session.connection.receiver.speaking;

    const ensureUser = (userId: string) => {
      let user = session.users.get(userId);
      if (!user) {
        user = {
          userId,
          username: userId,
          speaking: false,
          mute: false,
          deaf: false,
          selfMute: false,
          selfDeaf: false,
        };
        session.users.set(userId, user);
      }
      return user;
    };

    speakingMap.on("start", (userId: string) => {
      const user = ensureUser(userId);
      user.speaking = true;
      this.emit("userSpeaking", session, userId, true);
    });

    speakingMap.on("end", (userId: string) => {
      const user = ensureUser(userId);
      user.speaking = false;
      this.emit("userSpeaking", session, userId, false);
    });
  }

  private setupPlayerHandlers(session: VoiceChannelSession): void {
    if (!session.player) return;

    session.player.on(AudioPlayerStatus.Idle, () => {
      if (session.state === "speaking") {
        session.state = "listening";
        this.emit("stateChange", session, "listening");
      }
    });

    session.player.on(AudioPlayerStatus.Playing, () => {
      session.state = "speaking";
      this.emit("stateChange", session, "speaking");
    });

    session.player.on("error", (error) => {
      this.emit("error", session, error);
    });

    session.connection?.subscribe(session.player);
  }

  /**
   * Forward incoming VOICE_STATE_UPDATE and VOICE_SERVER_UPDATE gateway
   * events to the @discordjs/voice adapter for a specific guild.
   */
  /**
   * Forward incoming VOICE_STATE_UPDATE and VOICE_SERVER_UPDATE gateway
   * events to the @discordjs/voice adapter for a specific guild.
   */
  onGatewayVoicePayload(guildId: string, payload: VoiceGatewayPayload): void {
    const methods = this.adapterMethods.get(guildId);
    if (!methods) {
      console.log(
        `[voice-conn] onGatewayVoicePayload guildId=${guildId} — no adapter methods stored (adapters: ${[...this.adapterMethods.keys()].join(",")})`,
      );
      return;
    }

    if ("token" in payload && "endpoint" in payload) {
      // VOICE_SERVER_UPDATE — cast through unknown to bridge discord-api-types versions
      methods.onVoiceServerUpdate(payload as never);
    } else if ("session_id" in payload) {
      // VOICE_STATE_UPDATE
      methods.onVoiceStateUpdate(payload as never);
    }
  }

  private createAdapterCreator(guildId: string) {
    return (methods: DiscordGatewayAdapterLibraryMethods) => {
      this.adapterMethods.set(guildId, methods);

      return {
        sendPayload: (payload: { op: number; d: unknown }) => {
          const gateway = getGateway(this.accountId);
          if (!gateway) {
            console.log(`[voice-conn] sendPayload: no gateway found (accountId=${this.accountId})`);
            return false;
          }
          try {
            gateway.send(payload);
            return true;
          } catch (err) {
            console.error(`[voice-conn] sendPayload: gateway.send failed:`, err);
            return false;
          }
        },
        destroy: () => {
          this.adapterMethods.delete(guildId);
        },
      };
    };
  }

  destroy(): void {
    for (const session of this.sessions.values()) {
      if (session.player) {
        session.player.stop();
      }
      if (session.connection) {
        session.connection.destroy();
      }
    }
    this.sessions.clear();
    this.guildSessionIndex.clear();
    this.adapterMethods.clear();
  }
}

function entersState(
  connection: VoiceConnection,
  status: VoiceConnectionStatus,
  timeout: number,
): Promise<VoiceConnection> {
  return new Promise((resolve, reject) => {
    if (connection.state.status === status) {
      resolve(connection);
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for state ${status}`));
    }, timeout);

    const cleanup = () => {
      clearTimeout(timer);
      connection.off(VoiceConnectionStatus.Ready, onState);
      connection.off(VoiceConnectionStatus.Connecting, onState);
      connection.off(VoiceConnectionStatus.Signalling, onState);
      connection.off(VoiceConnectionStatus.Disconnected, onState);
      connection.off(VoiceConnectionStatus.Destroyed, onState);
    };

    const onState = () => {
      if (connection.state.status === status) {
        cleanup();
        resolve(connection);
      }
    };

    connection.on(VoiceConnectionStatus.Ready, onState);
    connection.on(VoiceConnectionStatus.Connecting, onState);
    connection.on(VoiceConnectionStatus.Signalling, onState);
    connection.on(VoiceConnectionStatus.Disconnected, onState);
    connection.on(VoiceConnectionStatus.Destroyed, onState);
  });
}
