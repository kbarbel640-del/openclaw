import { describe, expect, it } from "vitest";
import {
  formatKeybasePairingIdLine,
  formatKeybaseSenderDisplay,
  formatKeybaseSenderId,
  isKeybaseGroupAllowed,
  isKeybaseSenderAllowed,
  resolveKeybasePeerId,
  resolveKeybaseRecipient,
  resolveKeybaseSender,
} from "./identity.js";

describe("resolveKeybaseSender", () => {
  it("returns sender from username", () => {
    const sender = resolveKeybaseSender({ username: "alice" });
    expect(sender).toEqual({ kind: "username", username: "alice" });
  });

  it("lowercases username", () => {
    const sender = resolveKeybaseSender({ username: "AlIcE" });
    expect(sender).toEqual({ kind: "username", username: "alice" });
  });

  it("returns null for empty username", () => {
    expect(resolveKeybaseSender({ username: "" })).toBe(null);
    expect(resolveKeybaseSender({ username: null })).toBe(null);
    expect(resolveKeybaseSender({ username: undefined })).toBe(null);
  });
});

describe("formatKeybaseSenderId", () => {
  it("returns username", () => {
    expect(formatKeybaseSenderId({ kind: "username", username: "alice" })).toBe("alice");
  });
});

describe("formatKeybaseSenderDisplay", () => {
  it("returns username", () => {
    expect(formatKeybaseSenderDisplay({ kind: "username", username: "alice" })).toBe("alice");
  });
});

describe("formatKeybasePairingIdLine", () => {
  it("formats pairing line", () => {
    expect(formatKeybasePairingIdLine({ kind: "username", username: "alice" })).toBe(
      "Your Keybase username: alice",
    );
  });
});

describe("resolveKeybaseRecipient", () => {
  it("returns username", () => {
    expect(resolveKeybaseRecipient({ kind: "username", username: "alice" })).toBe("alice");
  });
});

describe("resolveKeybasePeerId", () => {
  it("returns username", () => {
    expect(resolveKeybasePeerId({ kind: "username", username: "alice" })).toBe("alice");
  });
});

describe("isKeybaseSenderAllowed", () => {
  const sender = { kind: "username" as const, username: "alice" };

  it("returns false for empty allowFrom", () => {
    expect(isKeybaseSenderAllowed(sender, [])).toBe(false);
  });

  it("allows wildcard", () => {
    expect(isKeybaseSenderAllowed(sender, ["*"])).toBe(true);
  });

  it("allows matching username", () => {
    expect(isKeybaseSenderAllowed(sender, ["alice"])).toBe(true);
  });

  it("strips keybase: prefix", () => {
    expect(isKeybaseSenderAllowed(sender, ["keybase:alice"])).toBe(true);
  });

  it("rejects non-matching username", () => {
    expect(isKeybaseSenderAllowed(sender, ["someone_else"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isKeybaseSenderAllowed(sender, ["ALICE"])).toBe(true);
  });
});

describe("isKeybaseGroupAllowed", () => {
  const sender = { kind: "username" as const, username: "alice" };

  it("disabled blocks all", () => {
    expect(isKeybaseGroupAllowed({ groupPolicy: "disabled", allowFrom: ["alice"], sender })).toBe(
      false,
    );
  });

  it("open allows all", () => {
    expect(isKeybaseGroupAllowed({ groupPolicy: "open", allowFrom: [], sender })).toBe(true);
  });

  it("allowlist checks allowFrom", () => {
    expect(isKeybaseGroupAllowed({ groupPolicy: "allowlist", allowFrom: ["alice"], sender })).toBe(
      true,
    );
    expect(isKeybaseGroupAllowed({ groupPolicy: "allowlist", allowFrom: ["other"], sender })).toBe(
      false,
    );
  });

  it("allowlist with empty list blocks", () => {
    expect(isKeybaseGroupAllowed({ groupPolicy: "allowlist", allowFrom: [], sender })).toBe(false);
  });
});
