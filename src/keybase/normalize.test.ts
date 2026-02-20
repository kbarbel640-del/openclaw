import { describe, expect, it } from "vitest";
import {
  looksLikeKeybaseTargetId,
  normalizeKeybaseMessagingTarget,
} from "../channels/plugins/normalize/keybase.js";

describe("normalizeKeybaseMessagingTarget", () => {
  it("returns lowercase username", () => {
    expect(normalizeKeybaseMessagingTarget("alice")).toBe("alice");
    expect(normalizeKeybaseMessagingTarget("ALICE")).toBe("alice");
  });

  it("strips keybase: prefix", () => {
    expect(normalizeKeybaseMessagingTarget("keybase:alice")).toBe("alice");
    expect(normalizeKeybaseMessagingTarget("Keybase:ALICE")).toBe("alice");
  });

  it("handles team: targets", () => {
    expect(normalizeKeybaseMessagingTarget("team:myteam")).toBe("team:myteam");
    expect(normalizeKeybaseMessagingTarget("keybase:team:myteam")).toBe("team:myteam");
  });

  it("returns undefined for empty input", () => {
    expect(normalizeKeybaseMessagingTarget("")).toBe(undefined);
    expect(normalizeKeybaseMessagingTarget("  ")).toBe(undefined);
    expect(normalizeKeybaseMessagingTarget("keybase:")).toBe(undefined);
  });
});

describe("looksLikeKeybaseTargetId", () => {
  it("recognizes keybase: prefixed targets", () => {
    expect(looksLikeKeybaseTargetId("keybase:alice")).toBe(true);
    expect(looksLikeKeybaseTargetId("keybase:team:myteam")).toBe(true);
  });

  it("recognizes team: targets", () => {
    expect(looksLikeKeybaseTargetId("team:myteam")).toBe(true);
  });

  it("recognizes valid usernames", () => {
    expect(looksLikeKeybaseTargetId("alice")).toBe(true);
    expect(looksLikeKeybaseTargetId("a_user_1")).toBe(true);
  });

  it("rejects strings that don't look like keybase targets", () => {
    expect(looksLikeKeybaseTargetId("+15555550123")).toBe(false);
    expect(looksLikeKeybaseTargetId("")).toBe(false);
  });
});
