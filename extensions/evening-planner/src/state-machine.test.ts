import { describe, expect, it } from "vitest";
import {
  applyShubhamReply,
  applyTimeoutFallback,
  createPlannerSession,
  markPromptSent,
  recommendedSeats,
} from "./state-machine.js";

describe("evening planner state machine", () => {
  it("resolves yes + eta and recommends two seats", () => {
    const now = Date.now();
    const created = createPlannerSession({
      id: "s1",
      conversationId: "telegram:group:1",
      nowMs: now,
      timeoutSec: 120,
      maxTurns: 3,
      shubham: {
        displayName: "Shubham",
      },
    });
    const result = applyShubhamReply(created, "yes bro, 25 min late", now + 1000);
    expect(result.resolved).toBe(true);
    expect(result.state.status).toBe("awaiting_confirmation");
    expect(result.state.shubham.availability).toBe("yes");
    expect(result.state.shubham.etaMinutes).toBe(25);
    expect(recommendedSeats(result.state)).toBe(2);
  });

  it("requests follow-up when response is ambiguous", () => {
    const now = Date.now();
    const created = createPlannerSession({
      id: "s2",
      conversationId: "telegram:group:2",
      nowMs: now,
      timeoutSec: 120,
      maxTurns: 2,
      shubham: {
        displayName: "Shubham",
      },
    });
    const result = applyShubhamReply(created, "dekhta hu", now + 1000);
    expect(result.resolved).toBe(false);
    expect(result.nextPrompt).toBeTruthy();
    const prompted = markPromptSent(result.state, result.nextPrompt ?? "", now + 1200);
    expect(prompted.shubham.followUpsAsked).toBe(1);
  });

  it("does not count initial outreach against follow-up budget", () => {
    const now = Date.now();
    const created = createPlannerSession({
      id: "s4",
      conversationId: "telegram:group:4",
      nowMs: now,
      timeoutSec: 120,
      maxTurns: 1,
      shubham: {
        displayName: "Shubham",
      },
    });
    const initial = markPromptSent(created, "aa rahe ho?", now + 100, false);
    expect(initial.shubham.followUpsAsked).toBe(0);
    const reply = applyShubhamReply(initial, "haan", now + 200);
    expect(reply.resolved).toBe(false);
    expect(reply.nextPrompt).toBeTruthy();
  });

  it("falls back when maybe response stays unresolved until turn limit", () => {
    const now = Date.now();
    const created = createPlannerSession({
      id: "s5",
      conversationId: "telegram:group:5",
      nowMs: now,
      timeoutSec: 120,
      maxTurns: 1,
      shubham: {
        displayName: "Shubham",
      },
    });
    const first = applyShubhamReply(created, "dekhta hu", now + 100);
    const prompted = markPromptSent(first.state, first.nextPrompt ?? "", now + 200);
    const second = applyShubhamReply(prompted, "shayad", now + 300);
    expect(second.resolved).toBe(true);
    expect(second.state.status).toBe("timed_out");
    expect(second.state.shubham.availability).toBe("no");
  });

  it("falls back to solo booking on timeout", () => {
    const now = Date.now();
    const created = createPlannerSession({
      id: "s3",
      conversationId: "telegram:group:3",
      nowMs: now,
      timeoutSec: 30,
      maxTurns: 2,
      shubham: {
        displayName: "Shubham",
      },
    });
    const timeout = applyTimeoutFallback(created, now + 31_000);
    expect(timeout.changed).toBe(true);
    expect(timeout.state.status).toBe("timed_out");
    expect(timeout.state.shubham.availability).toBe("no");
    expect(recommendedSeats(timeout.state)).toBe(1);
  });
});
