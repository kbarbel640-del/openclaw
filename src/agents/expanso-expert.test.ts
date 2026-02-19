import { describe, expect, it } from "vitest";
import {
  EXPANSO_EXPERT_AGENT_ID,
  EXPANSO_EXPERT_LABEL,
  EXPANSO_EXPERT_PERSONA,
  EXPANSO_EXPERT_SYSTEM_PROMPT,
  EXPANSO_EXPERT_TAGLINE,
  type ExpansoExpertPersona,
} from "./expanso-expert.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("EXPANSO_EXPERT_AGENT_ID", () => {
  it("is a non-empty string", () => {
    expect(typeof EXPANSO_EXPERT_AGENT_ID).toBe("string");
    expect(EXPANSO_EXPERT_AGENT_ID.length).toBeGreaterThan(0);
  });

  it("is kebab-case (no spaces)", () => {
    expect(EXPANSO_EXPERT_AGENT_ID).not.toContain(" ");
  });

  it("matches expected value", () => {
    expect(EXPANSO_EXPERT_AGENT_ID).toBe("expanso-expert");
  });
});

describe("EXPANSO_EXPERT_LABEL", () => {
  it("is a non-empty string", () => {
    expect(typeof EXPANSO_EXPERT_LABEL).toBe("string");
    expect(EXPANSO_EXPERT_LABEL.length).toBeGreaterThan(0);
  });

  it("contains 'Expanso'", () => {
    expect(EXPANSO_EXPERT_LABEL).toContain("Expanso");
  });
});

describe("EXPANSO_EXPERT_TAGLINE", () => {
  it("is a non-empty string", () => {
    expect(typeof EXPANSO_EXPERT_TAGLINE).toBe("string");
    expect(EXPANSO_EXPERT_TAGLINE.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// System prompt — acceptance criteria 1: agent can explain what it can do
// ---------------------------------------------------------------------------

describe("EXPANSO_EXPERT_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof EXPANSO_EXPERT_SYSTEM_PROMPT).toBe("string");
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it("mentions build capability (AC1: agent can explain what it can do)", () => {
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT.toLowerCase()).toContain("build");
  });

  it("mentions validate capability (AC1)", () => {
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT.toLowerCase()).toContain("validate");
  });

  it("mentions fix capability (AC1)", () => {
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT.toLowerCase()).toContain("fix");
  });

  it("describes Expanso as a pipeline framework (AC1)", () => {
    const lower = EXPANSO_EXPERT_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("pipeline");
    expect(lower).toContain("yaml");
  });

  // Acceptance criteria 2: agent automatically uses the tool when asked to 'create a pipeline'
  it("instructs agent to use expanso tool when user asks to 'create a pipeline' (AC2)", () => {
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT).toContain("expanso");
    // Must mention the trigger phrase
    const lower = EXPANSO_EXPERT_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("create a pipeline");
  });

  it("instructs agent to use action: 'build' for pipeline creation (AC2)", () => {
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT).toContain("build");
    // Must describe the build action in the context of the tool
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT).toContain('action: "build"');
  });

  it("instructs agent to use action: 'validate' for YAML validation (AC2)", () => {
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT).toContain('action: "validate"');
  });

  it("instructs agent to use action: 'fix' for auto-fixing (AC2)", () => {
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT).toContain('action: "fix"');
  });

  it("explains the expanso tool parameter structure", () => {
    // The prompt should describe what fields the tool takes
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT).toContain("description");
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT).toContain("yaml");
  });

  it("mentions pipeline concepts: inputs, outputs", () => {
    const lower = EXPANSO_EXPERT_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("input");
    expect(lower).toContain("output");
  });

  it("includes examples of when to automatically invoke the tool (AC2)", () => {
    const lower = EXPANSO_EXPERT_SYSTEM_PROMPT.toLowerCase();
    // Must include trigger phrases so the LLM knows when to auto-call the tool
    expect(lower).toMatch(/build a pipeline|create a pipeline|generate a pipeline/);
  });

  it("does not exceed a reasonable length (should be concise but complete)", () => {
    // Sanity check: system prompt should be non-trivial but not enormous
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT.length).toBeGreaterThan(500);
    expect(EXPANSO_EXPERT_SYSTEM_PROMPT.length).toBeLessThan(10_000);
  });
});

// ---------------------------------------------------------------------------
// Persona object
// ---------------------------------------------------------------------------

describe("EXPANSO_EXPERT_PERSONA", () => {
  it("is an object", () => {
    expect(typeof EXPANSO_EXPERT_PERSONA).toBe("object");
    expect(EXPANSO_EXPERT_PERSONA).not.toBeNull();
  });

  it("has the correct agentId", () => {
    expect(EXPANSO_EXPERT_PERSONA.agentId).toBe(EXPANSO_EXPERT_AGENT_ID);
  });

  it("has the correct label", () => {
    expect(EXPANSO_EXPERT_PERSONA.label).toBe(EXPANSO_EXPERT_LABEL);
  });

  it("has the correct tagline", () => {
    expect(EXPANSO_EXPERT_PERSONA.tagline).toBe(EXPANSO_EXPERT_TAGLINE);
  });

  it("has the correct systemPrompt", () => {
    expect(EXPANSO_EXPERT_PERSONA.systemPrompt).toBe(EXPANSO_EXPERT_SYSTEM_PROMPT);
  });

  it("requiredTools includes 'expanso'", () => {
    expect(EXPANSO_EXPERT_PERSONA.requiredTools).toContain("expanso");
  });

  it("requiredTools is a non-empty array", () => {
    expect(Array.isArray(EXPANSO_EXPERT_PERSONA.requiredTools)).toBe(true);
    expect(EXPANSO_EXPERT_PERSONA.requiredTools.length).toBeGreaterThan(0);
  });

  it("satisfies the ExpansoExpertPersona type structure", () => {
    // Type-level check: all required fields are present and correct types
    const p: ExpansoExpertPersona = EXPANSO_EXPERT_PERSONA;
    expect(typeof p.agentId).toBe("string");
    expect(typeof p.label).toBe("string");
    expect(typeof p.tagline).toBe("string");
    expect(typeof p.systemPrompt).toBe("string");
    expect(Array.isArray(p.requiredTools)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: persona fields are consistent with each other
// ---------------------------------------------------------------------------

describe("persona consistency", () => {
  it("agentId matches pattern in systemPrompt context", () => {
    // The system prompt should be about the agent ID's domain
    const lower = EXPANSO_EXPERT_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain("expanso");
  });

  it("requiredTools matches tool names mentioned in systemPrompt", () => {
    // Every tool listed in requiredTools should be mentioned in the system prompt
    for (const tool of EXPANSO_EXPERT_PERSONA.requiredTools) {
      expect(EXPANSO_EXPERT_SYSTEM_PROMPT).toContain(tool);
    }
  });
});
