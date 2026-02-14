import type { IncomingMessage } from "node:http";
import { describe, it, expect } from "vitest";
import { validateSessionKeyOwnership } from "./http-utils.js";

function fakeReq(sessionKey?: string): IncomingMessage {
  return {
    headers: sessionKey ? { "x-openclaw-session-key": sessionKey } : {},
  } as IncomingMessage;
}

describe("validateSessionKeyOwnership (CWE-639 IDOR prevention)", () => {
  it("denies access when user tries to access another user's openai session", () => {
    const req = fakeReq("agent:main:openai-user:bob");
    expect(validateSessionKeyOwnership(req, "alice")).not.toBeNull();
  });

  it("denies access when user tries to access another user's openresponses session", () => {
    const req = fakeReq("agent:main:openresponses-user:bob");
    expect(validateSessionKeyOwnership(req, "alice")).not.toBeNull();
  });

  it("denies access to plain user-scoped sessions belonging to another user", () => {
    const req = fakeReq("agent:main:user:bob");
    expect(validateSessionKeyOwnership(req, "alice")).not.toBeNull();
  });

  it("denies cross-user access across different agents", () => {
    const req = fakeReq("agent:workspace1:openai-user:bob");
    expect(validateSessionKeyOwnership(req, "alice")).not.toBeNull();
  });

  it("allows access when user accesses their own session", () => {
    expect(
      validateSessionKeyOwnership(fakeReq("agent:main:openai-user:alice"), "alice"),
    ).toBeNull();
    expect(
      validateSessionKeyOwnership(fakeReq("agent:main:openresponses-user:alice"), "alice"),
    ).toBeNull();
    expect(validateSessionKeyOwnership(fakeReq("agent:main:user:alice"), "alice")).toBeNull();
  });

  it("handles case-insensitive user comparison", () => {
    expect(
      validateSessionKeyOwnership(fakeReq("agent:main:openai-user:Alice"), "alice"),
    ).toBeNull();
    expect(
      validateSessionKeyOwnership(fakeReq("agent:main:openai-user:alice"), "ALICE"),
    ).toBeNull();
  });

  it("allows access when no explicit session key is provided", () => {
    expect(validateSessionKeyOwnership(fakeReq(), "alice")).toBeNull();
    expect(validateSessionKeyOwnership(fakeReq(""), "alice")).toBeNull();
  });

  it("allows access for token/password auth (no user identity)", () => {
    expect(
      validateSessionKeyOwnership(fakeReq("agent:main:openai-user:bob"), undefined),
    ).toBeNull();
  });

  it("allows access to non-user-scoped sessions", () => {
    expect(validateSessionKeyOwnership(fakeReq("agent:main:main"), "alice")).toBeNull();
    expect(validateSessionKeyOwnership(fakeReq("agent:main:openai:abc-123"), "alice")).toBeNull();
  });

  it("skips validation for malformed session keys", () => {
    expect(validateSessionKeyOwnership(fakeReq("not-a-valid-key"), "alice")).toBeNull();
  });

  it("handles user IDs with special characters", () => {
    const user = "user+test@example-corp.com";
    expect(validateSessionKeyOwnership(fakeReq(`agent:main:openai-user:${user}`), user)).toBeNull();
    expect(
      validateSessionKeyOwnership(fakeReq(`agent:main:openai-user:${user}`), "other"),
    ).not.toBeNull();
  });
});
