import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAuthorizationGrantsForTests,
  consumeAuthorizationGrant,
  issueAuthorizationGrant,
} from "./authorization-grants.js";

describe("authorization grants", () => {
  beforeEach(() => {
    clearAuthorizationGrantsForTests();
  });

  it("issues and consumes one-time grants", () => {
    const grant = issueAuthorizationGrant({
      action: "scm_push_pr",
      issuerSessionKey: "agent:main:main",
      issuerProvenanceKind: "external_user",
      targetSessionKey: "agent:oc:main",
      ttlSeconds: 120,
      nowMsOverride: 1_000,
    });
    const consumed = consumeAuthorizationGrant({
      token: grant.token,
      requiredAction: "scm_push_pr",
      requesterSessionKey: "agent:main:main",
      targetSessionKey: "agent:oc:main",
      requiredProvenanceKind: "external_user",
      nowMsOverride: 1_500,
    });
    expect(consumed.ok).toBe(true);
    expect(consumed.status).toBe("ok");

    const replay = consumeAuthorizationGrant({
      token: grant.token,
      requiredAction: "scm_push_pr",
      requesterSessionKey: "agent:main:main",
      targetSessionKey: "agent:oc:main",
      requiredProvenanceKind: "external_user",
      nowMsOverride: 1_600,
    });
    expect(replay.ok).toBe(false);
    expect(replay.status).toBe("consumed");
  });

  it("rejects expired grants", () => {
    const grant = issueAuthorizationGrant({
      action: "scm_push_pr",
      issuerSessionKey: "agent:main:main",
      issuerProvenanceKind: "external_user",
      ttlSeconds: 30,
      nowMsOverride: 10_000,
    });
    const expired = consumeAuthorizationGrant({
      token: grant.token,
      requiredAction: "scm_push_pr",
      requesterSessionKey: "agent:main:main",
      requiredProvenanceKind: "external_user",
      nowMsOverride: 50_500,
    });
    expect(expired.ok).toBe(false);
    expect(expired.status).toBe("expired");
  });

  it("rejects issuer/target/action mismatches", () => {
    const grant = issueAuthorizationGrant({
      action: "deploy_release",
      issuerSessionKey: "agent:main:main",
      issuerProvenanceKind: "external_user",
      targetSessionKey: "agent:target:main",
      ttlSeconds: 120,
      nowMsOverride: 20_000,
    });

    const wrongIssuer = consumeAuthorizationGrant({
      token: grant.token,
      requiredAction: "deploy_release",
      requesterSessionKey: "agent:other:main",
      targetSessionKey: "agent:target:main",
      requiredProvenanceKind: "external_user",
      nowMsOverride: 20_100,
    });
    expect(wrongIssuer.ok).toBe(false);
    expect(wrongIssuer.status).toBe("issuer_mismatch");

    const wrongTarget = consumeAuthorizationGrant({
      token: grant.token,
      requiredAction: "deploy_release",
      requesterSessionKey: "agent:main:main",
      targetSessionKey: "agent:different:main",
      requiredProvenanceKind: "external_user",
      nowMsOverride: 20_100,
    });
    expect(wrongTarget.ok).toBe(false);
    expect(wrongTarget.status).toBe("target_mismatch");

    const wrongAction = consumeAuthorizationGrant({
      token: grant.token,
      requiredAction: "scm_push_pr",
      requesterSessionKey: "agent:main:main",
      targetSessionKey: "agent:target:main",
      requiredProvenanceKind: "external_user",
      nowMsOverride: 20_100,
    });
    expect(wrongAction.ok).toBe(false);
    expect(wrongAction.status).toBe("action_mismatch");
  });
});
