import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock NATS module
const mockPublish = vi.fn().mockResolvedValue({ seq: 1 });
const mockStreamInfo = vi.fn();
const mockStreamAdd = vi.fn().mockResolvedValue({});
const mockDrain = vi.fn().mockResolvedValue(undefined);
const mockIsClosed = vi.fn().mockReturnValue(false);
const mockJetstream = vi.fn().mockReturnValue({ publish: mockPublish });
const mockJetstreamManager = vi.fn().mockResolvedValue({
  streams: { info: mockStreamInfo, add: mockStreamAdd },
});

// Async iterator that never yields (for nc.status())
const emptyAsyncIter = {
  [Symbol.asyncIterator]: () => ({
    next: () => new Promise<{ done: true; value: undefined }>(() => {}),
  }),
};

const mockConnection = {
  jetstream: mockJetstream,
  jetstreamManager: mockJetstreamManager,
  isClosed: mockIsClosed,
  drain: mockDrain,
  status: vi.fn().mockReturnValue(emptyAsyncIter),
};

vi.mock("nats", () => ({
  connect: vi.fn().mockResolvedValue(mockConnection),
  StringCodec: vi.fn(() => ({
    encode: (s: string) => Buffer.from(s),
    decode: (b: Buffer) => b.toString(),
  })),
  RetentionPolicy: { Limits: "limits" },
  StorageType: { File: "file" },
  Events: { Reconnect: "reconnect", Disconnect: "disconnect" },
}));

// Mock agent-events to capture the listener
let capturedListener: ((evt: unknown) => void) | null = null;
vi.mock("./agent-events.js", () => ({
  onAgentEvent: vi.fn((cb: (evt: unknown) => void) => {
    capturedListener = cb;
    return () => {
      capturedListener = null;
    };
  }),
}));

const DEFAULT_CONFIG = {
  enabled: true,
  natsUrl: "nats://localhost:4222",
  streamName: "test-events",
  subjectPrefix: "test.events",
};

describe("Event Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedListener = null;
    mockStreamInfo.mockRejectedValue(new Error("not found"));
    mockIsClosed.mockReturnValue(false);
  });

  afterEach(async () => {
    // Clean up state between tests
    const { shutdownEventStore } = await import("./event-store.js");
    await shutdownEventStore();
    vi.resetModules();
  });

  describe("initEventStore", () => {
    it("should not connect when disabled", async () => {
      const { connect } = await import("nats");
      const { initEventStore } = await import("./event-store.js");

      await initEventStore({ ...DEFAULT_CONFIG, enabled: false });

      expect(connect).not.toHaveBeenCalled();
    });

    it("should connect to NATS and create stream when enabled", async () => {
      const { connect } = await import("nats");
      const { initEventStore } = await import("./event-store.js");

      await initEventStore(DEFAULT_CONFIG);

      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          servers: "localhost:4222",
          reconnect: true,
          timeout: 5_000,
        }),
      );
      expect(mockStreamAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test-events",
          subjects: ["test.events.>"],
        }),
      );
    });

    it("should not create stream if it already exists", async () => {
      mockStreamInfo.mockResolvedValue({ config: {} });
      const { initEventStore } = await import("./event-store.js");

      await initEventStore(DEFAULT_CONFIG);

      expect(mockStreamAdd).not.toHaveBeenCalled();
    });

    it("should parse credentials from natsUrl without logging them", async () => {
      const { connect } = await import("nats");
      const { initEventStore } = await import("./event-store.js");

      await initEventStore({
        ...DEFAULT_CONFIG,
        natsUrl: "nats://myuser:secret@nats.example.com:4222",
      });

      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          servers: "nats.example.com:4222",
          user: "myuser",
          pass: "secret",
        }),
      );
    });

    it("should not initialize twice", async () => {
      const { connect } = await import("nats");
      const { initEventStore } = await import("./event-store.js");

      await initEventStore(DEFAULT_CONFIG);
      await initEventStore(DEFAULT_CONFIG);

      expect(connect).toHaveBeenCalledTimes(1);
    });

    it("should forward retention config to stream creation", async () => {
      const { initEventStore } = await import("./event-store.js");

      await initEventStore({
        ...DEFAULT_CONFIG,
        retention: { maxMessages: 500_000, maxBytes: 1_073_741_824, maxAgeHours: 168 },
      });

      expect(mockStreamAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          max_msgs: 500_000,
          max_bytes: 1_073_741_824,
          max_age: 168 * 3_600_000_000_000,
        }),
      );
    });
  });

  describe("event publishing", () => {
    it("should publish user messages as msg.in", async () => {
      const { initEventStore } = await import("./event-store.js");
      await initEventStore(DEFAULT_CONFIG);

      expect(capturedListener).not.toBeNull();
      await capturedListener!({
        ts: 1700000000000,
        sessionKey: "agent:main:main",
        stream: "user",
        data: { text: "Hello" },
        seq: 1,
        runId: "run-1",
      });

      // Wait for async publish
      await vi.waitFor(() => expect(mockPublish).toHaveBeenCalled());

      const [subject, data] = mockPublish.mock.calls[0];
      expect(subject).toBe("test.events.main.msg_in");
      const parsed = JSON.parse(data.toString());
      expect(parsed.type).toBe("msg.in");
      expect(parsed.agent).toBe("main");
    });

    it("should publish tool results correctly", async () => {
      const { initEventStore } = await import("./event-store.js");
      await initEventStore(DEFAULT_CONFIG);

      await capturedListener!({
        ts: 1700000000000,
        sessionKey: "viola:session:123",
        stream: "tool",
        data: { result: "done" },
        seq: 2,
        runId: "run-2",
      });

      await vi.waitFor(() => expect(mockPublish).toHaveBeenCalled());

      const [subject, data] = mockPublish.mock.calls[0];
      expect(subject).toBe("test.events.viola.tool_result");
      const parsed = JSON.parse(data.toString());
      expect(parsed.type).toBe("tool.result");
      expect(parsed.agent).toBe("viola");
    });

    it("should map lifecycle phases correctly", async () => {
      const { initEventStore } = await import("./event-store.js");
      await initEventStore(DEFAULT_CONFIG);

      await capturedListener!({
        ts: 1700000000000,
        sessionKey: "main",
        stream: "lifecycle",
        data: { phase: "end" },
        seq: 3,
        runId: "run-3",
      });

      await vi.waitFor(() => expect(mockPublish).toHaveBeenCalled());

      const parsed = JSON.parse(mockPublish.mock.calls[0][1].toString());
      expect(parsed.type).toBe("run.end");
    });
  });

  describe("shutdownEventStore", () => {
    it("should drain connection and clear state", async () => {
      const { initEventStore, shutdownEventStore, isEventStoreConnected } = await import(
        "./event-store.js"
      );

      await initEventStore(DEFAULT_CONFIG);
      expect(isEventStoreConnected()).toBe(true);

      await shutdownEventStore();
      expect(mockDrain).toHaveBeenCalled();
      expect(isEventStoreConnected()).toBe(false);
    });

    it("should be safe to call when not initialized", async () => {
      const { shutdownEventStore } = await import("./event-store.js");
      await expect(shutdownEventStore()).resolves.toBeUndefined();
    });
  });

  describe("getEventStoreStatus", () => {
    it("should report connected status", async () => {
      const { initEventStore, getEventStoreStatus } = await import("./event-store.js");

      await initEventStore(DEFAULT_CONFIG);
      const status = getEventStoreStatus();

      expect(status.connected).toBe(true);
      expect(status.stream).toBe("test-events");
    });

    it("should report disconnected when not initialized", async () => {
      const { getEventStoreStatus } = await import("./event-store.js");
      const status = getEventStoreStatus();

      expect(status.connected).toBe(false);
      expect(status.stream).toBeNull();
    });
  });
});
