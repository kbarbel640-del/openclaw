import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseAgentDefinition,
  loadAgentDefinitionsFromDir,
  loadAgentDefinitions,
} from "./loader.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-def-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("parseAgentDefinition", () => {
  it("should parse a complete agent definition", () => {
    const content = `---
name: researcher
description: Deep research specialist
model: claude-sonnet-4-5
role: specialist
tools: [web-search, web-fetch, memory]
reasoning: true
capabilities: [research, analysis]
expertise: [academic papers, technical docs]
skills: [coding-agent]
---
You are a deep research specialist focused on thorough analysis.
Always cite your sources.`;

    const result = parseAgentDefinition("/tmp/researcher.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const def = result.definition;
    expect(def.id).toBe("researcher");
    expect(def.name).toBe("researcher");
    expect(def.description).toBe("Deep research specialist");
    expect(def.model).toBe("claude-sonnet-4-5");
    expect(def.role).toBe("specialist");
    expect(def.tools).toEqual(["web-search", "web-fetch", "memory"]);
    expect(def.reasoning).toBe(true);
    expect(def.capabilities).toEqual(["research", "analysis"]);
    expect(def.expertise).toEqual(["academic papers", "technical docs"]);
    expect(def.skills).toEqual(["coding-agent"]);
    expect(def.systemPrompt).toContain("deep research specialist");
    expect(def.systemPrompt).toContain("cite your sources");
  });

  it("should derive id from filename", () => {
    const content = `---
name: My Custom Agent
---
Hello world`;

    const result = parseAgentDefinition("/tmp/my-custom-agent.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.definition.id).toBe("my-custom-agent");
    expect(result.definition.name).toBe("My Custom Agent");
  });

  it("should default role to specialist", () => {
    const content = `---
name: test
---
Test agent`;

    const result = parseAgentDefinition("/tmp/test.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.definition.role).toBe("specialist");
  });

  it("should reject invalid roles and fall back to specialist", () => {
    const content = `---
name: test
role: invalid-role
---
Test agent`;

    const result = parseAgentDefinition("/tmp/test.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.definition.role).toBe("specialist");
  });

  it("should handle all valid roles", () => {
    for (const role of ["orchestrator", "lead", "specialist", "worker"]) {
      const content = `---
role: ${role}
---
Test`;
      const result = parseAgentDefinition("/tmp/test.md", content);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.definition.role).toBe(role);
    }
  });

  it("should handle missing frontmatter", () => {
    const content = "Just a plain markdown file without frontmatter.";
    const result = parseAgentDefinition("/tmp/plain.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.definition.id).toBe("plain");
    expect(result.definition.name).toBe("plain");
    expect(result.definition.role).toBe("specialist");
    expect(result.definition.systemPrompt).toBe("Just a plain markdown file without frontmatter.");
  });

  it("should handle comma-separated tools list", () => {
    const content = `---
tools: web-search, web-fetch, memory
---
Agent`;
    const result = parseAgentDefinition("/tmp/test.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.definition.tools).toEqual(["web-search", "web-fetch", "memory"]);
  });

  it("should handle reasoning false", () => {
    const content = `---
reasoning: false
---
Agent`;
    const result = parseAgentDefinition("/tmp/test.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.definition.reasoning).toBe(false);
  });

  it("should omit optional fields when not provided", () => {
    const content = `---
name: minimal
---
Minimal agent`;
    const result = parseAgentDefinition("/tmp/minimal.md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const def = result.definition;
    expect(def.model).toBeUndefined();
    expect(def.description).toBeUndefined();
    expect(def.tools).toBeUndefined();
    expect(def.reasoning).toBeUndefined();
    expect(def.capabilities).toBeUndefined();
    expect(def.expertise).toBeUndefined();
    expect(def.skills).toBeUndefined();
  });

  it("should sanitize id from filename with special characters", () => {
    const content = `---
name: Test
---
Test`;
    const result = parseAgentDefinition("/tmp/My Agent (v2).md", content);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.definition.id).toBe("my-agent--v2-");
  });
});

describe("loadAgentDefinitionsFromDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("should load multiple definitions from a directory", () => {
    fs.writeFileSync(
      path.join(tmpDir, "researcher.md"),
      `---
name: researcher
role: specialist
---
Research agent`,
    );
    fs.writeFileSync(
      path.join(tmpDir, "coder.md"),
      `---
name: coder
role: worker
---
Coding agent`,
    );

    const result = loadAgentDefinitionsFromDir(tmpDir);
    expect(result.definitions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);

    const ids = result.definitions.map((d) => d.id).toSorted();
    expect(ids).toEqual(["coder", "researcher"]);
  });

  it("should skip non-md files", () => {
    fs.writeFileSync(path.join(tmpDir, "agent.md"), "---\nname: test\n---\nTest");
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "Not an agent");
    fs.writeFileSync(path.join(tmpDir, "config.json"), "{}");

    const result = loadAgentDefinitionsFromDir(tmpDir);
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0].id).toBe("agent");
  });

  it("should return empty for non-existent directory", () => {
    const result = loadAgentDefinitionsFromDir("/tmp/does-not-exist-12345");
    expect(result.definitions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should skip directories with .md names", () => {
    fs.writeFileSync(path.join(tmpDir, "real.md"), "---\nname: real\n---\nReal");
    fs.mkdirSync(path.join(tmpDir, "fake.md"));

    const result = loadAgentDefinitionsFromDir(tmpDir);
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0].id).toBe("real");
  });
});

describe("loadAgentDefinitions", () => {
  let stateDir: string;
  let agentDir: string;

  beforeEach(() => {
    stateDir = makeTmpDir();
    agentDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(stateDir);
    cleanup(agentDir);
  });

  it("should merge global and agent-local definitions", () => {
    const globalDir = path.join(stateDir, "definitions");
    const agentLocalDir = path.join(agentDir, "definitions");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(agentLocalDir, { recursive: true });

    fs.writeFileSync(
      path.join(globalDir, "researcher.md"),
      "---\nname: Global Researcher\nrole: specialist\n---\nGlobal prompt",
    );
    fs.writeFileSync(
      path.join(agentLocalDir, "coder.md"),
      "---\nname: Agent Coder\nrole: worker\n---\nAgent prompt",
    );

    const result = loadAgentDefinitions({ stateDir, agentDir });
    expect(result.definitions).toHaveLength(2);
    const ids = result.definitions.map((d) => d.id).toSorted();
    expect(ids).toEqual(["coder", "researcher"]);
  });

  it("should let agent-local override global on id collision", () => {
    const globalDir = path.join(stateDir, "definitions");
    const agentLocalDir = path.join(agentDir, "definitions");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(agentLocalDir, { recursive: true });

    fs.writeFileSync(
      path.join(globalDir, "researcher.md"),
      "---\nname: Global Researcher\n---\nGlobal prompt",
    );
    fs.writeFileSync(
      path.join(agentLocalDir, "researcher.md"),
      "---\nname: Local Researcher\n---\nLocal prompt",
    );

    const result = loadAgentDefinitions({ stateDir, agentDir });
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0].name).toBe("Local Researcher");
    expect(result.definitions[0].systemPrompt).toBe("Local prompt");
  });

  it("should handle missing directories gracefully", () => {
    const result = loadAgentDefinitions({
      stateDir: "/tmp/nonexistent-state-12345",
      agentDir: "/tmp/nonexistent-agent-12345",
    });
    expect(result.definitions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
