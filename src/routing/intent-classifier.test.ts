import { describe, expect, test } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  classifyIntent,
  getBestMatch,
  getMatchesAboveThreshold,
  type IntentClassificationResult,
} from "./intent-classifier.js";

describe("classifyIntent", () => {
  test("returns empty matches when no agents configured", () => {
    const cfg: OpenClawConfig = {};
    const result = classifyIntent({
      cfg,
      message: "help me with coding",
    });
    expect(result.matches).toEqual([]);
    expect(result.message).toBe("help me with coding");
  });

  test("returns empty matches when no intent-enabled agents", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "agent1",
            orchestration: {
              intents: {
                enabled: false,
                keywords: ["help"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "help",
    });
    expect(result.matches).toEqual([]);
  });

  test("matches keyword case-insensitively", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "coding-agent",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["code", "bug", "refactor"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "Help me fix a BUG in my code",
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].agentId).toBe("coding-agent");
    expect(result.matches[0].matchReason).toBe("keyword");
    expect(result.matches[0].matchedValue).toBe("bug");
    expect(result.matches[0].confidence).toBe(0.9);
  });

  test("matches category case-insensitively", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "research-agent",
            orchestration: {
              intents: {
                enabled: true,
                categories: ["research", "analysis"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "Can you do some RESEARCH on this topic?",
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].agentId).toBe("research-agent");
    expect(result.matches[0].matchReason).toBe("category");
    expect(result.matches[0].matchedValue).toBe("research");
    expect(result.matches[0].confidence).toBe(0.7);
  });

  test("keyword match takes precedence over category match", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "agent1",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["code"],
                categories: ["coding"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "help me with code",
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchReason).toBe("keyword");
    expect(result.matches[0].confidence).toBe(0.9);
  });

  test("sorts multiple matches by confidence", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "coding-agent",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["code", "bug"],
              },
            },
          },
          {
            id: "research-agent",
            orchestration: {
              intents: {
                enabled: true,
                categories: ["code"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "code review",
    });
    expect(result.matches).toHaveLength(2);
    // Keyword match (0.9) should come before category match (0.7)
    expect(result.matches[0].agentId).toBe("coding-agent");
    expect(result.matches[0].confidence).toBe(0.9);
    expect(result.matches[1].agentId).toBe("research-agent");
    expect(result.matches[1].confidence).toBe(0.7);
  });

  test("returns default supervisor when no matches", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "supervisor",
            orchestration: {
              supervisor: {
                defaultAgent: "general-agent",
              },
            },
          },
          {
            id: "coding-agent",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["code"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "hello",
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].agentId).toBe("general-agent");
    expect(result.matches[0].matchReason).toBe("default");
    expect(result.matches[0].confidence).toBe(0.3);
  });

  test("returns supervisor agent ID when no defaultAgent specified", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "supervisor",
            orchestration: {
              supervisor: true,
            },
          },
          {
            id: "coding-agent",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["code"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "hello",
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].agentId).toBe("supervisor");
    expect(result.matches[0].matchReason).toBe("default");
  });

  test("handles empty message gracefully", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "agent1",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["help"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "",
    });
    expect(result.matches).toEqual([]);
  });

  test("handles whitespace-only message gracefully", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "agent1",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["help"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "   ",
    });
    expect(result.matches).toEqual([]);
  });

  test("handles agent with empty keywords and categories", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "agent1",
            orchestration: {
              intents: {
                enabled: true,
                keywords: [],
                categories: [],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "hello",
    });
    expect(result.matches).toEqual([]);
  });

  test("matches partial keywords within message", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "coding-agent",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["debug"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "I need to debug this issue quickly",
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].agentId).toBe("coding-agent");
  });

  test("sorts agents deterministically when confidence is equal", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "zebra-agent",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["code"],
              },
            },
          },
          {
            id: "alpha-agent",
            orchestration: {
              intents: {
                enabled: true,
                keywords: ["programming"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "code and programming",
    });
    expect(result.matches).toHaveLength(2);
    // Both have 0.9 confidence, should be sorted alphabetically
    expect(result.matches[0].agentId).toBe("alpha-agent");
    expect(result.matches[1].agentId).toBe("zebra-agent");
  });

  test("does not match when intents object exists but enabled is not true", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [
          {
            id: "agent1",
            orchestration: {
              intents: {
                keywords: ["code"],
              },
            },
          },
        ],
      },
    };
    const result = classifyIntent({
      cfg,
      message: "code",
    });
    expect(result.matches).toEqual([]);
  });
});

describe("getBestMatch", () => {
  test("returns highest confidence match", () => {
    const result: IntentClassificationResult = {
      matches: [
        {
          agentId: "agent1",
          confidence: 0.9,
          matchReason: "keyword",
        },
        {
          agentId: "agent2",
          confidence: 0.7,
          matchReason: "category",
        },
      ],
      message: "test",
    };
    const best = getBestMatch(result);
    expect(best).toEqual({
      agentId: "agent1",
      confidence: 0.9,
      matchReason: "keyword",
    });
  });

  test("returns null when no matches", () => {
    const result: IntentClassificationResult = {
      matches: [],
      message: "test",
    };
    const best = getBestMatch(result);
    expect(best).toBeNull();
  });
});

describe("getMatchesAboveThreshold", () => {
  test("filters matches by threshold", () => {
    const result: IntentClassificationResult = {
      matches: [
        {
          agentId: "agent1",
          confidence: 0.9,
          matchReason: "keyword",
        },
        {
          agentId: "agent2",
          confidence: 0.7,
          matchReason: "category",
        },
        {
          agentId: "agent3",
          confidence: 0.3,
          matchReason: "default",
        },
      ],
      message: "test",
    };
    const filtered = getMatchesAboveThreshold(result, 0.5);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].agentId).toBe("agent1");
    expect(filtered[1].agentId).toBe("agent2");
  });

  test("returns empty array when no matches above threshold", () => {
    const result: IntentClassificationResult = {
      matches: [
        {
          agentId: "agent1",
          confidence: 0.3,
          matchReason: "default",
        },
      ],
      message: "test",
    };
    const filtered = getMatchesAboveThreshold(result, 0.5);
    expect(filtered).toEqual([]);
  });

  test("includes matches exactly at threshold", () => {
    const result: IntentClassificationResult = {
      matches: [
        {
          agentId: "agent1",
          confidence: 0.5,
          matchReason: "category",
        },
      ],
      message: "test",
    };
    const filtered = getMatchesAboveThreshold(result, 0.5);
    expect(filtered).toHaveLength(1);
  });
});
