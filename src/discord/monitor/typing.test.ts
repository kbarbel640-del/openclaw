import type { Client } from "@buape/carbon";
import { describe, it, expect, vi } from "vitest";
import { sendTyping } from "./typing.js";

describe("sendTyping", () => {
  const makeMockClient = (triggerTyping: () => Promise<void>) =>
    ({
      fetchChannel: vi
        .fn<(id: string) => Promise<{ triggerTyping: () => Promise<void> } | null>>()
        .mockResolvedValue({
          triggerTyping,
        }),
    }) as unknown as Client;

  it("calls triggerTyping on the fetched channel", async () => {
    const trigger = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const client = makeMockClient(trigger);
    await sendTyping({ client, channelId: "123" });
    expect(trigger).toHaveBeenCalledOnce();
  });

  it("skips triggerTyping when channel is null", async () => {
    const client = {
      fetchChannel: vi.fn<(id: string) => Promise<null>>().mockResolvedValue(null),
    } as unknown as Client;
    // Should not throw
    await sendTyping({ client, channelId: "123" });
  });

  it("returns immediately when signal is already aborted", async () => {
    const trigger = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const client = makeMockClient(trigger);
    const ac = new AbortController();
    ac.abort();
    await sendTyping({ client, channelId: "123", signal: ac.signal });
    expect(
      (client as unknown as { fetchChannel: ReturnType<typeof vi.fn> }).fetchChannel,
    ).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
  });

  it("returns without calling triggerTyping when signal aborts after fetchChannel", async () => {
    const trigger = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const ac = new AbortController();
    const client = {
      fetchChannel: vi
        .fn<(id: string) => Promise<{ triggerTyping: () => Promise<void> }>>()
        .mockImplementation(async () => {
          ac.abort();
          return { triggerTyping: trigger };
        }),
    } as unknown as Client;
    await sendTyping({ client, channelId: "123", signal: ac.signal });
    expect(trigger).not.toHaveBeenCalled();
  });

  it("rejects with AbortError when signal aborts during triggerTyping", async () => {
    const ac = new AbortController();
    // Use a barrier that never resolves to simulate a long-running HTTP request
    const trigger = vi
      .fn<() => Promise<void>>()
      .mockImplementation(() => new Promise<void>(() => {}));
    const client = makeMockClient(trigger);

    const promise = sendTyping({ client, channelId: "123", signal: ac.signal });

    // Give the Promise.race a microtask to set up
    await Promise.resolve();
    ac.abort();

    await expect(promise).rejects.toThrow("The operation was aborted.");
  });

  it("resolves normally when triggerTyping completes before abort", async () => {
    const trigger = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const client = makeMockClient(trigger);
    const ac = new AbortController();
    await sendTyping({ client, channelId: "123", signal: ac.signal });
    expect(trigger).toHaveBeenCalledOnce();
  });

  it("works without signal (backwards compatible)", async () => {
    const trigger = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const client = makeMockClient(trigger);
    await sendTyping({ client, channelId: "123" });
    expect(trigger).toHaveBeenCalledOnce();
  });
});
