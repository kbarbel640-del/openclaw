/**
 * Shared mock setup for event-store tests.
 * Extracted to keep the test file under the 400-line limit (Cerberus C1).
 */
import { type Mock, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mock NATS primitives
// ─────────────────────────────────────────────────────────────────────────────

export const mockPublish: Mock = vi.fn().mockResolvedValue({ seq: 1 });
export const mockStreamInfo: Mock = vi.fn();
export const mockStreamAdd: Mock = vi.fn().mockResolvedValue({});
export const mockDrain: Mock = vi.fn().mockResolvedValue(undefined);
export const mockClose: Mock = vi.fn().mockResolvedValue(undefined);
export const mockIsClosed: Mock = vi.fn().mockReturnValue(false);
export const mockJetstream: Mock = vi.fn().mockReturnValue({ publish: mockPublish });
export const mockJetstreamManager: Mock = vi.fn().mockResolvedValue({
  streams: { info: mockStreamInfo, add: mockStreamAdd },
});

/** Async iterator that never yields (for nc.status()) */
export const emptyAsyncIter = {
  [Symbol.asyncIterator]: () => ({
    next: () => new Promise<{ done: true; value: undefined }>(() => {}),
  }),
};

export const mockConnection: Record<string, Mock | typeof emptyAsyncIter> = {
  jetstream: mockJetstream,
  jetstreamManager: mockJetstreamManager,
  isClosed: mockIsClosed,
  drain: mockDrain,
  close: mockClose,
  status: vi.fn().mockReturnValue(emptyAsyncIter),
};

// ─────────────────────────────────────────────────────────────────────────────
// Default test config
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = {
  enabled: true,
  natsUrl: "nats://localhost:4222",
  streamName: "test-events",
  subjectPrefix: "test.events",
} as const;

/** Captured listener from the onAgentEvent mock */
export let capturedListener: ((evt: unknown) => void) | null = null;

export function setCapturedListener(cb: ((evt: unknown) => void) | null): void {
  capturedListener = cb;
}
