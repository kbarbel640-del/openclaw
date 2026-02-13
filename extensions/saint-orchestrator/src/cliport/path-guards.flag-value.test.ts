import { describe, expect, it } from "vitest";
import { validatePathLikeArgs } from "./path-guards.js";

describe("path-guards: --flag=value args", () => {
  it("rejects --output=../../etc/passwd style traversal", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["--output=../../etc/passwd"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
      }),
    ).toThrowError(/escapes workspace/);
  });

  it("rejects -o=../../../secret style traversal", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["-o=../../../secret"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
      }),
    ).toThrowError(/escapes workspace/);
  });

  it("rejects --config=../../memory/private when masked", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["--config=../../memory/private/file.yaml"],
        hostCwd: "/srv/workspace/data/sub",
        workspaceRoot: "/srv/workspace",
        maskedPaths: ["memory/private"],
      }),
    ).toThrowError(/masked directory/);
  });

  it("allows --output=./local-file.txt within workspace", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["--output=./local-file.txt"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
      }),
    ).not.toThrow();
  });

  it("allows flags without path-like values (no false positive)", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["--verbose=true", "--count=5"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
      }),
    ).not.toThrow();
  });

  it("rejects --output=~/escape tilde in flag-value context", () => {
    expect(() =>
      validatePathLikeArgs({
        args: ["--output=~/escape"],
        hostCwd: "/srv/workspace/data",
        workspaceRoot: "/srv/workspace",
      }),
    ).toThrowError(/tilde paths are not allowed/);
  });
});
