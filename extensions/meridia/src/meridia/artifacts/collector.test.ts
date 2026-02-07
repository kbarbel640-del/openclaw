import { describe, expect, it } from "vitest";
import type { MeridiaEvent } from "../event/normalizer.js";
import { collectArtifacts } from "./collector.js";

function makeEvent(overrides: Partial<MeridiaEvent> = {}): MeridiaEvent {
  return {
    id: "test-id",
    kind: "tool_result",
    ts: new Date().toISOString(),
    session: { key: "s1" },
    tool: { name: "bash", callId: "tc-1", isError: false },
    payload: {},
    provenance: { source: "hook" },
    ...overrides,
  };
}

describe("artifacts/collector", () => {
  it("returns empty array for empty payload", () => {
    const event = makeEvent({ payload: {} });
    expect(collectArtifacts(event)).toEqual([]);
  });

  it("returns empty array for null payload", () => {
    const event = makeEvent({ payload: null });
    expect(collectArtifacts(event)).toEqual([]);
  });

  it("returns empty array for non-object payload", () => {
    const event = makeEvent({ payload: "string payload" });
    expect(collectArtifacts(event)).toEqual([]);
  });

  it("extracts file artifact from write tool args", () => {
    const event = makeEvent({
      tool: { name: "write", callId: "tc-1", isError: false },
      payload: { args: { file_path: "/home/user/test.ts", content: "console.log('hi')" } },
    });
    const artifacts = collectArtifacts(event);
    expect(artifacts.length).toBeGreaterThanOrEqual(1);
    const fileArtifact = artifacts.find((a) => a.kind === "file");
    expect(fileArtifact).toBeDefined();
    expect(fileArtifact!.uri).toBe("file:///home/user/test.ts");
  });

  it("extracts file artifact from edit tool args", () => {
    const event = makeEvent({
      tool: { name: "edit", callId: "tc-1", isError: false },
      payload: {
        args: { file_path: "/path/to/file.ts", old_string: "foo", new_string: "bar" },
      },
    });
    const artifacts = collectArtifacts(event);
    expect(artifacts.some((a) => a.kind === "file" && a.uri === "file:///path/to/file.ts")).toBe(
      true,
    );
  });

  it("extracts URL artifact from payload with url field", () => {
    const event = makeEvent({
      tool: { name: "browser", callId: "tc-1", isError: false },
      payload: { args: { url: "https://example.com/page" } },
    });
    const artifacts = collectArtifacts(event);
    const urlArtifact = artifacts.find((a) => a.kind === "link");
    expect(urlArtifact).toBeDefined();
    expect(urlArtifact!.uri).toBe("https://example.com/page");
  });

  it("extracts file from read tool", () => {
    const event = makeEvent({
      tool: { name: "read", callId: "tc-1", isError: false },
      payload: { args: { file_path: "/some/file.md" } },
    });
    const artifacts = collectArtifacts(event);
    expect(artifacts.some((a) => a.kind === "file" && a.uri === "file:///some/file.md")).toBe(true);
  });

  it("does not crash on deeply nested payload", () => {
    const event = makeEvent({
      payload: { args: { nested: { deep: { value: "no artifacts here" } } } },
    });
    const artifacts = collectArtifacts(event);
    expect(Array.isArray(artifacts)).toBe(true);
  });

  it("deduplicates artifacts by URI", () => {
    const event = makeEvent({
      tool: { name: "write", callId: "tc-1", isError: false },
      payload: {
        args: { file_path: "/same/path.ts" },
        result: { path: "/same/path.ts" },
      },
    });
    const artifacts = collectArtifacts(event);
    const uris = artifacts.map((a) => a.uri);
    const uniqueUris = [...new Set(uris)];
    expect(uris.length).toBe(uniqueUris.length);
  });

  it("sets title from filename", () => {
    const event = makeEvent({
      tool: { name: "write", callId: "tc-1", isError: false },
      payload: { args: { file_path: "/home/user/project/index.ts" } },
    });
    const artifacts = collectArtifacts(event);
    expect(artifacts[0]?.title).toBe("index.ts");
  });

  it("returns empty for unknown tool types", () => {
    const event = makeEvent({
      tool: { name: "unknown_tool", callId: "tc-1", isError: false },
      payload: { args: { file_path: "/some/file.ts" } },
    });
    expect(collectArtifacts(event)).toEqual([]);
  });

  it("ignores non-absolute file paths", () => {
    const event = makeEvent({
      tool: { name: "write", callId: "tc-1", isError: false },
      payload: { args: { file_path: "relative/path.ts" } },
    });
    expect(collectArtifacts(event)).toEqual([]);
  });

  it("handles apply_patch tool", () => {
    const event = makeEvent({
      tool: { name: "apply_patch", callId: "tc-1", isError: false },
      payload: { args: { file_path: "/home/user/patched.ts" } },
    });
    const artifacts = collectArtifacts(event);
    expect(artifacts.length).toBe(1);
    expect(artifacts[0]?.kind).toBe("file");
  });

  it("handles web_fetch tool", () => {
    const event = makeEvent({
      tool: { name: "web_fetch", callId: "tc-1", isError: false },
      payload: { args: { url: "https://api.example.com/data" } },
    });
    const artifacts = collectArtifacts(event);
    expect(artifacts.length).toBe(1);
    expect(artifacts[0]?.kind).toBe("link");
    expect(artifacts[0]?.uri).toBe("https://api.example.com/data");
  });

  it("handles missing tool info", () => {
    const event = makeEvent({ tool: undefined });
    expect(collectArtifacts(event)).toEqual([]);
  });
});
