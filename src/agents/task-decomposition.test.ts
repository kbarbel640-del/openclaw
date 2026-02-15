/**
 * Test suite for task decomposition engine.
 *
 * Covers:
 * - topologicalSort: linear, parallel, cycles, empty
 * - validateDag: valid DAG, duplicate IDs, missing refs, cycles
 * - computeExecutionPhases: independent tasks, dependencies, chains
 * - assignAgentsToSubtasks: capability matching
 * - analyzeTaskForDecomposition: trivial vs complex
 * - processDecomposition: valid DAG, invalid DAG, phases
 */

import { describe, it, expect, vi } from "vitest";
import {
  topologicalSort,
  validateDag,
  computeExecutionPhases,
  assignAgentsToSubtasks,
  analyzeTaskForDecomposition,
  processDecomposition,
  type SubtaskNode,
} from "./task-decomposition.js";

// Mock capabilities registry and task classifier
vi.mock("./capabilities-registry.js", () => ({
  findBestAgentForTask: vi.fn((task: string) => {
    if (task.toLowerCase().includes("code")) {
      return { agentId: "coder", confidence: 0.8, reason: "coding match" };
    }
    if (task.toLowerCase().includes("research")) {
      return { agentId: "researcher", confidence: 0.7, reason: "research match" };
    }
    if (task.toLowerCase().includes("test")) {
      return { agentId: "tester", confidence: 0.6, reason: "testing match" };
    }
    return null;
  }),
  findTopAgentsForTask: vi.fn((task: string, _limit: number) => {
    if (task.toLowerCase().includes("complex")) {
      return [
        { agentId: "agent1", confidence: 0.8 },
        { agentId: "agent2", confidence: 0.7 },
      ];
    }
    return [{ agentId: "agent1", confidence: 0.5 }];
  }),
}));

vi.mock("./task-classifier.js", () => ({
  classifyComplexity: vi.fn((task: string) => {
    if (task.toLowerCase().includes("trivial")) {
      return "trivial";
    }
    if (task.toLowerCase().includes("moderate")) {
      return "moderate";
    }
    return "complex";
  }),
  classifyTask: vi.fn((task: string) => {
    if (task.toLowerCase().includes("code")) {
      return "coding";
    }
    if (task.toLowerCase().includes("research")) {
      return "research";
    }
    return "general";
  }),
}));

describe("topologicalSort", () => {
  it("should sort simple linear dependencies (A→B→C)", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "C",
        description: "Third task",
        dependencies: ["B"],
        requiredCapabilities: [],
      },
      {
        id: "A",
        description: "First task",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Second task",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
    ];

    const result = topologicalSort(subtasks);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);

    // Verify ordering: A must come before B, B must come before C
    const ids = result!.map((node) => node.id);
    const indexA = ids.indexOf("A");
    const indexB = ids.indexOf("B");
    const indexC = ids.indexOf("C");

    expect(indexA).toBeLessThan(indexB);
    expect(indexB).toBeLessThan(indexC);
  });

  it("should handle parallel tasks (no dependencies)", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "C",
        description: "Task C",
        dependencies: [],
        requiredCapabilities: [],
      },
    ];

    const result = topologicalSort(subtasks);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);

    // All tasks should be present
    const ids = new Set(result!.map((node) => node.id));
    expect(ids.has("A")).toBe(true);
    expect(ids.has("B")).toBe(true);
    expect(ids.has("C")).toBe(true);
  });

  it("should return null on cycle detection (A→B→C→A)", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: ["C"],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
      {
        id: "C",
        description: "Task C",
        dependencies: ["B"],
        requiredCapabilities: [],
      },
    ];

    const result = topologicalSort(subtasks);

    expect(result).toBeNull();
  });

  it("should return null on self-referencing cycle (A→A)", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
    ];

    const result = topologicalSort(subtasks);

    expect(result).toBeNull();
  });

  it("should handle empty input", () => {
    const result = topologicalSort([]);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(0);
  });

  it("should handle diamond dependency (A→B,C; B,C→D)", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "D",
        description: "Task D",
        dependencies: ["B", "C"],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
      {
        id: "C",
        description: "Task C",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
    ];

    const result = topologicalSort(subtasks);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(4);

    const ids = result!.map((node) => node.id);
    const indexA = ids.indexOf("A");
    const indexB = ids.indexOf("B");
    const indexC = ids.indexOf("C");
    const indexD = ids.indexOf("D");

    // A must come before B and C
    expect(indexA).toBeLessThan(indexB);
    expect(indexA).toBeLessThan(indexC);

    // B and C must come before D
    expect(indexB).toBeLessThan(indexD);
    expect(indexC).toBeLessThan(indexD);
  });
});

describe("validateDag", () => {
  it("should return valid=true for valid DAG", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
    ];

    const result = validateDag(subtasks);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should detect duplicate IDs", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "A",
        description: "Duplicate Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
    ];

    const result = validateDag(subtasks);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Duplicate subtask ID: A");
  });

  it("should detect missing dependency references", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: ["B"],
        requiredCapabilities: [],
      },
    ];

    const result = validateDag(subtasks);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Subtask "A" depends on unknown subtask "B"');
  });

  it("should detect cycles", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: ["B"],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
    ];

    const result = validateDag(subtasks);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Dependency cycle detected");
  });

  it("should validate empty DAG", () => {
    const result = validateDag([]);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should detect multiple missing dependencies", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: ["X", "Y"],
        requiredCapabilities: [],
      },
    ];

    const result = validateDag(subtasks);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('depends on unknown subtask "X"');
  });
});

describe("computeExecutionPhases", () => {
  it("should group independent tasks into same phase", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "C",
        description: "Task C",
        dependencies: [],
        requiredCapabilities: [],
      },
    ];

    const phases = computeExecutionPhases(subtasks);

    expect(phases).toHaveLength(1);
    expect(phases[0]).toHaveLength(3);

    const ids = new Set(phases[0].map((node) => node.id));
    expect(ids.has("A")).toBe(true);
    expect(ids.has("B")).toBe(true);
    expect(ids.has("C")).toBe(true);
  });

  it("should put dependent tasks in later phases", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
      {
        id: "C",
        description: "Task C",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
    ];

    const phases = computeExecutionPhases(subtasks);

    expect(phases).toHaveLength(2);

    // Phase 0 should only have A
    expect(phases[0]).toHaveLength(1);
    expect(phases[0][0].id).toBe("A");

    // Phase 1 should have B and C (parallel)
    expect(phases[1]).toHaveLength(2);
    const phase1Ids = new Set(phases[1].map((node) => node.id));
    expect(phase1Ids.has("B")).toBe(true);
    expect(phase1Ids.has("C")).toBe(true);
  });

  it("should handle single task", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
    ];

    const phases = computeExecutionPhases(subtasks);

    expect(phases).toHaveLength(1);
    expect(phases[0]).toHaveLength(1);
    expect(phases[0][0].id).toBe("A");
  });

  it("should handle chain (A→B→C) = 3 phases", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
      {
        id: "C",
        description: "Task C",
        dependencies: ["B"],
        requiredCapabilities: [],
      },
    ];

    const phases = computeExecutionPhases(subtasks);

    expect(phases).toHaveLength(3);

    expect(phases[0]).toHaveLength(1);
    expect(phases[0][0].id).toBe("A");

    expect(phases[1]).toHaveLength(1);
    expect(phases[1][0].id).toBe("B");

    expect(phases[2]).toHaveLength(1);
    expect(phases[2][0].id).toBe("C");
  });

  it("should handle diamond dependency (A→B,C→D)", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
      {
        id: "C",
        description: "Task C",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
      {
        id: "D",
        description: "Task D",
        dependencies: ["B", "C"],
        requiredCapabilities: [],
      },
    ];

    const phases = computeExecutionPhases(subtasks);

    expect(phases).toHaveLength(3);

    // Phase 0: A
    expect(phases[0]).toHaveLength(1);
    expect(phases[0][0].id).toBe("A");

    // Phase 1: B and C (parallel)
    expect(phases[1]).toHaveLength(2);
    const phase1Ids = new Set(phases[1].map((node) => node.id));
    expect(phase1Ids.has("B")).toBe(true);
    expect(phase1Ids.has("C")).toBe(true);

    // Phase 2: D
    expect(phases[2]).toHaveLength(1);
    expect(phases[2][0].id).toBe("D");
  });

  it("should handle empty input", () => {
    const phases = computeExecutionPhases([]);

    expect(phases).toHaveLength(0);
  });

  it("should fallback to single phase on cycle", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Task A",
        dependencies: ["B"],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
    ];

    const phases = computeExecutionPhases(subtasks);

    // Fallback behavior: all in one phase
    expect(phases).toHaveLength(1);
    expect(phases[0]).toHaveLength(2);
  });
});

describe("assignAgentsToSubtasks", () => {
  it("should assign agents based on capabilities (mock findBestAgentForTask)", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Write code for feature X",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "B",
        description: "Research best practices",
        dependencies: [],
        requiredCapabilities: [],
      },
      {
        id: "C",
        description: "Run tests",
        dependencies: ["A"],
        requiredCapabilities: [],
      },
    ];

    const result = assignAgentsToSubtasks(subtasks);

    expect(result).toHaveLength(3);

    // Task A: code → coder
    expect(result[0].assignedAgent).toBe("coder");
    expect(result[0].assignmentConfidence).toBe(0.8);

    // Task B: research → researcher
    expect(result[1].assignedAgent).toBe("researcher");
    expect(result[1].assignmentConfidence).toBe(0.7);

    // Task C: test → tester
    expect(result[2].assignedAgent).toBe("tester");
    expect(result[2].assignmentConfidence).toBe(0.6);
  });

  it("should leave unassigned when no good match", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Generic task with no keywords",
        dependencies: [],
        requiredCapabilities: [],
      },
    ];

    const result = assignAgentsToSubtasks(subtasks);

    expect(result).toHaveLength(1);
    expect(result[0].assignedAgent).toBeUndefined();
    expect(result[0].assignmentConfidence).toBeUndefined();
  });

  it("should handle empty input", () => {
    const result = assignAgentsToSubtasks([]);

    expect(result).toHaveLength(0);
  });

  it("should not assign when confidence is too low", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Test low confidence match",
        dependencies: [],
        requiredCapabilities: [],
      },
    ];

    // Mock will return 0.6 confidence for "test" keyword
    const result = assignAgentsToSubtasks(subtasks);

    // Since 0.6 > 0.3 threshold, it should assign
    expect(result[0].assignedAgent).toBe("tester");
    expect(result[0].assignmentConfidence).toBe(0.6);
  });

  it("should preserve original node properties", () => {
    const subtasks: SubtaskNode[] = [
      {
        id: "A",
        description: "Write code",
        dependencies: ["B"],
        requiredCapabilities: ["coding", "typescript"],
      },
    ];

    const result = assignAgentsToSubtasks(subtasks);

    expect(result[0].id).toBe("A");
    expect(result[0].description).toBe("Write code");
    expect(result[0].dependencies).toEqual(["B"]);
    expect(result[0].requiredCapabilities).toEqual(["coding", "typescript"]);
  });
});

describe("analyzeTaskForDecomposition", () => {
  it("should return decomposed=false for trivial tasks", () => {
    const result = analyzeTaskForDecomposition("trivial task");

    expect(result.decomposed).toBe(false);
    expect(result.complexity).toBe("trivial");
    expect(result.subtasks).toHaveLength(0);
    expect(result.phases).toHaveLength(0);
    expect(result.reason).toContain("trivial");
    expect(result.reason).toContain("no decomposition needed");
  });

  it("should return decomposed=true for complex tasks", () => {
    const result = analyzeTaskForDecomposition("complex task");

    expect(result.decomposed).toBe(true);
    expect(result.complexity).toBe("complex");
    expect(result.subtasks).toHaveLength(0);
    expect(result.phases).toHaveLength(0);
    expect(result.reason).toContain("complex");
    expect(result.reason).toContain("LLM decomposition recommended");
  });

  it("should return decomposed=false for moderate tasks with single-agent coverage", () => {
    const result = analyzeTaskForDecomposition("moderate simple task");

    expect(result.decomposed).toBe(false);
    expect(result.complexity).toBe("moderate");
    expect(result.subtasks).toHaveLength(0);
    expect(result.phases).toHaveLength(0);
    expect(result.reason).toContain("moderate complexity");
    expect(result.reason).toContain("single-agent coverage");
  });

  it("should return decomposed=true for moderate tasks with multi-agent potential", () => {
    const result = analyzeTaskForDecomposition("moderate complex task");

    expect(result.decomposed).toBe(true);
    expect(result.complexity).toBe("moderate");
    expect(result.subtasks).toHaveLength(0);
    expect(result.phases).toHaveLength(0);
    expect(result.reason).toContain("moderate");
    expect(result.reason).toContain("LLM decomposition recommended");
  });

  it("should classify task type correctly", () => {
    const result = analyzeTaskForDecomposition("complex code refactoring");

    expect(result.reason).toContain("coding");
  });
});

describe("processDecomposition", () => {
  it("should process valid subtask list", () => {
    const rawSubtasks = [
      {
        id: "A",
        description: "Write code",
        dependencies: [],
        requiredCapabilities: ["coding"],
      },
      {
        id: "B",
        description: "Run tests",
        dependencies: ["A"],
        requiredCapabilities: ["testing"],
      },
    ];

    const result = processDecomposition(rawSubtasks);

    expect(result.decomposed).toBe(true);
    expect(result.complexity).toBe("complex");
    expect(result.subtasks).toHaveLength(2);
    expect(result.phases).toHaveLength(2);
    expect(result.reason).toContain("2 subtasks");
    expect(result.reason).toContain("2 execution phases");

    // Verify agent assignment
    expect(result.subtasks[0].assignedAgent).toBe("coder");
    expect(result.subtasks[1].assignedAgent).toBe("tester");
  });

  it("should reject invalid DAG (cycle)", () => {
    const rawSubtasks = [
      {
        id: "A",
        description: "Task A",
        dependencies: ["B"],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: ["A"],
      },
    ];

    const result = processDecomposition(rawSubtasks);

    expect(result.decomposed).toBe(false);
    expect(result.complexity).toBe("complex");
    expect(result.subtasks).toHaveLength(0);
    expect(result.phases).toHaveLength(0);
    expect(result.reason).toContain("Invalid decomposition");
    expect(result.reason).toContain("cycle");
  });

  it("should reject duplicate IDs", () => {
    const rawSubtasks = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
      },
      {
        id: "A",
        description: "Duplicate A",
        dependencies: [],
      },
    ];

    const result = processDecomposition(rawSubtasks);

    expect(result.decomposed).toBe(false);
    expect(result.reason).toContain("Invalid decomposition");
    expect(result.reason).toContain("Duplicate subtask ID");
  });

  it("should reject missing dependency references", () => {
    const rawSubtasks = [
      {
        id: "A",
        description: "Task A",
        dependencies: ["B"],
      },
    ];

    const result = processDecomposition(rawSubtasks);

    expect(result.decomposed).toBe(false);
    expect(result.reason).toContain("Invalid decomposition");
    expect(result.reason).toContain("unknown subtask");
  });

  it("should compute execution phases correctly", () => {
    const rawSubtasks = [
      {
        id: "A",
        description: "Task A",
        dependencies: [],
      },
      {
        id: "B",
        description: "Task B",
        dependencies: [],
      },
      {
        id: "C",
        description: "Code the feature",
        dependencies: ["A", "B"],
      },
    ];

    const result = processDecomposition(rawSubtasks);

    expect(result.decomposed).toBe(true);
    expect(result.phases).toHaveLength(2);

    // Phase 0: A and B (parallel)
    expect(result.phases[0]).toHaveLength(2);

    // Phase 1: C (depends on A and B)
    expect(result.phases[1]).toHaveLength(1);
    expect(result.phases[1][0].id).toBe("C");
    expect(result.phases[1][0].assignedAgent).toBe("coder");
  });

  it("should handle optional fields", () => {
    const rawSubtasks = [
      {
        id: "A",
        description: "Task A",
        // Missing dependencies and requiredCapabilities
      },
    ];

    const result = processDecomposition(rawSubtasks);

    expect(result.decomposed).toBe(true);
    expect(result.subtasks).toHaveLength(1);
    expect(result.subtasks[0].dependencies).toEqual([]);
    expect(result.subtasks[0].requiredCapabilities).toEqual([]);
  });

  it("should handle empty subtask list", () => {
    const result = processDecomposition([]);

    expect(result.decomposed).toBe(true);
    expect(result.subtasks).toHaveLength(0);
    expect(result.phases).toHaveLength(0);
    expect(result.reason).toContain("0 subtasks");
    expect(result.reason).toContain("0 execution phases");
  });

  it("should preserve all subtask properties", () => {
    const rawSubtasks = [
      {
        id: "A",
        description: "Research best practices",
        dependencies: [],
        requiredCapabilities: ["research", "analysis"],
      },
    ];

    const result = processDecomposition(rawSubtasks);

    expect(result.decomposed).toBe(true);
    expect(result.subtasks[0].id).toBe("A");
    expect(result.subtasks[0].description).toBe("Research best practices");
    expect(result.subtasks[0].dependencies).toEqual([]);
    expect(result.subtasks[0].requiredCapabilities).toEqual(["research", "analysis"]);
    expect(result.subtasks[0].assignedAgent).toBe("researcher");
    expect(result.subtasks[0].assignmentConfidence).toBe(0.7);
  });
});
