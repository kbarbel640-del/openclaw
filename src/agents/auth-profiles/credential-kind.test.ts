import { describe, expect, it } from "vitest";
import type { AuthProfileCredential } from "./types.js";
import {
  credentialBillingHint,
  credentialKindDisplayLabel,
  credentialKindLabel,
  detectCredentialKindFromKey,
} from "./credential-kind.js";

describe("credentialKindLabel", () => {
  it("returns readable labels for each kind", () => {
    expect(credentialKindLabel("oauth")).toBe("OAuth");
    expect(credentialKindLabel("token")).toBe("Token");
    expect(credentialKindLabel("api_key")).toBe("API Key");
  });
});

describe("credentialBillingHint", () => {
  it('returns "Max" for Anthropic OAuth credentials', () => {
    const credential: AuthProfileCredential = {
      type: "oauth",
      provider: "anthropic",
      access: "sk-ant-oat01-test",
      refresh: "sk-ant-ort01-test",
      expires: Date.now() + 60_000,
    };
    expect(credentialBillingHint(credential)).toBe("Max");
  });

  it('returns "Max" for Anthropic token credentials', () => {
    const credential: AuthProfileCredential = {
      type: "token",
      provider: "anthropic",
      token: "sk-ant-oat01-test",
    };
    expect(credentialBillingHint(credential)).toBe("Max");
  });

  it("returns undefined for Anthropic API key credentials", () => {
    const credential: AuthProfileCredential = {
      type: "api_key",
      provider: "anthropic",
      key: "sk-ant-api03-test",
    };
    expect(credentialBillingHint(credential)).toBeUndefined();
  });

  it("returns undefined for non-Anthropic OAuth credentials", () => {
    const credential: AuthProfileCredential = {
      type: "oauth",
      provider: "openai-codex",
      access: "eyJhbGciOi-test",
      refresh: "oai-refresh-test",
      expires: Date.now() + 60_000,
    };
    expect(credentialBillingHint(credential)).toBeUndefined();
  });
});

describe("credentialKindDisplayLabel", () => {
  it('returns "OAuth (Max)" for Anthropic OAuth', () => {
    const credential: AuthProfileCredential = {
      type: "oauth",
      provider: "anthropic",
      access: "sk-ant-oat01-test",
      refresh: "sk-ant-ort01-test",
      expires: Date.now() + 60_000,
    };
    expect(credentialKindDisplayLabel(credential)).toBe("OAuth (Max)");
  });

  it('returns "Token (Max)" for Anthropic token', () => {
    const credential: AuthProfileCredential = {
      type: "token",
      provider: "anthropic",
      token: "sk-ant-oat01-test",
    };
    expect(credentialKindDisplayLabel(credential)).toBe("Token (Max)");
  });

  it('returns "API Key" for Anthropic API key', () => {
    const credential: AuthProfileCredential = {
      type: "api_key",
      provider: "anthropic",
      key: "sk-ant-api03-test",
    };
    expect(credentialKindDisplayLabel(credential)).toBe("API Key");
  });

  it('returns "OAuth" for non-Anthropic OAuth', () => {
    const credential: AuthProfileCredential = {
      type: "oauth",
      provider: "openai-codex",
      access: "eyJhbGciOi-test",
      refresh: "oai-refresh-test",
      expires: Date.now() + 60_000,
    };
    expect(credentialKindDisplayLabel(credential)).toBe("OAuth");
  });
});

describe("detectCredentialKindFromKey", () => {
  it("detects Anthropic OAuth access tokens", () => {
    const result = detectCredentialKindFromKey("anthropic", "sk-ant-oat01-ABCDEF1234567890");
    expect(result.kind).toBe("oauth");
    expect(result.billingHint).toBe("Max");
  });

  it("detects Anthropic OAuth refresh tokens", () => {
    const result = detectCredentialKindFromKey("anthropic", "sk-ant-ort01-ABCDEF1234567890");
    expect(result.kind).toBe("oauth");
    expect(result.billingHint).toBe("Max");
  });

  it("detects Anthropic API keys", () => {
    const result = detectCredentialKindFromKey(
      "anthropic",
      "sk-ant-api03-0123456789abcdefghijklmnopqrstuvwxyz",
    );
    expect(result.kind).toBe("api_key");
    expect(result.billingHint).toBeUndefined();
  });

  it("defaults to api_key for unknown providers", () => {
    const result = detectCredentialKindFromKey("openai", "sk-openai-0123456789");
    expect(result.kind).toBe("api_key");
    expect(result.billingHint).toBeUndefined();
  });

  it("handles whitespace in keys", () => {
    const result = detectCredentialKindFromKey("anthropic", "  sk-ant-oat01-test  ");
    expect(result.kind).toBe("oauth");
    expect(result.billingHint).toBe("Max");
  });
});
