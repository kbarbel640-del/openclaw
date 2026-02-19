import type { MatrixClient } from "@vector-im/matrix-bot-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearActiveMatrixClient,
  getActiveMatrixClient,
  setActiveMatrixClient,
} from "./active-client.js";

describe("active matrix client registry", () => {
  beforeEach(() => {
    clearActiveMatrixClient("acct-1");
    clearActiveMatrixClient("acct-2");
  });

  it("returns the client that was set for an account", () => {
    const client = { stop: vi.fn() } as unknown as MatrixClient;

    setActiveMatrixClient("acct-1", client);

    expect(getActiveMatrixClient("acct-1")).toBe(client);
  });

  it("keeps account clients isolated", () => {
    const client1 = { stop: vi.fn() } as unknown as MatrixClient;
    const client2 = { stop: vi.fn() } as unknown as MatrixClient;

    setActiveMatrixClient("acct-1", client1);
    setActiveMatrixClient("acct-2", client2);

    expect(getActiveMatrixClient("acct-1")).toBe(client1);
    expect(getActiveMatrixClient("acct-2")).toBe(client2);
  });

  it("clear removes only the targeted account", () => {
    const client1 = { stop: vi.fn() } as unknown as MatrixClient;
    const client2 = { stop: vi.fn() } as unknown as MatrixClient;

    setActiveMatrixClient("acct-1", client1);
    setActiveMatrixClient("acct-2", client2);
    clearActiveMatrixClient("acct-1");

    expect(getActiveMatrixClient("acct-1")).toBeNull();
    expect(getActiveMatrixClient("acct-2")).toBe(client2);
  });
});
