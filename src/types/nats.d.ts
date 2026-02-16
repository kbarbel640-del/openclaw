/**
 * Ambient module declaration for `nats` — optional peer dependency.
 *
 * Only the subset used by event-store.ts is declared here.
 * This lets `tsgo` resolve `import("nats")` without requiring
 * the package to be installed at type-check time.
 */
declare module "nats" {
  export enum RetentionPolicy {
    Limits = "limits",
    Interest = "interest",
    Workqueue = "workqueue",
  }

  export enum StorageType {
    File = "file",
    Memory = "memory",
  }

  export interface ConnectionOptions {
    servers: string | string[];
    user?: string;
    pass?: string;
    token?: string;
    reconnect?: boolean;
    maxReconnectAttempts?: number;
    timeout?: number;
  }

  export interface StreamConfig {
    name: string;
    subjects: string[];
    retention: RetentionPolicy;
    storage: StorageType;
    max_age?: number;
    max_msgs?: number;
    max_bytes?: number;
    num_replicas?: number;
  }

  export interface StreamInfo {
    config: StreamConfig;
  }

  export interface Codec<T> {
    encode(d: T): Uint8Array;
    decode(d: Uint8Array): T;
  }

  export interface JetStreamClient {
    publish(subject: string, data?: Uint8Array): Promise<unknown>;
  }

  export interface StreamAPI {
    info(name: string): Promise<StreamInfo>;
    add(cfg: StreamConfig): Promise<StreamInfo>;
  }

  export interface JetStreamManager {
    streams: StreamAPI;
  }

  export interface NatsConnection {
    jetstream(): JetStreamClient;
    jetstreamManager(): Promise<JetStreamManager>;
    close(): Promise<void>;
    drain(): Promise<void>;
    isClosed(): boolean;
    status(): AsyncIterable<{ type: string; data?: string }>;
  }

  export function connect(opts?: ConnectionOptions): Promise<NatsConnection>;
  export function StringCodec(): Codec<string>;
}
