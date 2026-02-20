import { describe, expect, it } from "vitest";
import type { Addressable } from "./resolve-agent.js";
import { tryParseRoutingPlan, matchFragmentToAgent } from "./routing-plan.js";

// ---------------------------------------------------------------------------
// tryParseRoutingPlan
// ---------------------------------------------------------------------------

describe("tryParseRoutingPlan", () => {
  it("parses a valid routing plan", () => {
    const json = JSON.stringify({
      fragments: [
        { text: "какая погода в москве", agent: "weather_forecast", confidence: 5 },
        { text: "какие новости в москве", agent: "internet_search", confidence: 5 },
      ],
      reasoning: "Two distinct queries.",
      total_confidence: 5,
    });
    const plan = tryParseRoutingPlan(json);
    expect(plan).not.toBeNull();
    expect(plan!.fragments).toHaveLength(2);
    expect(plan!.fragments[0].agent).toBe("weather_forecast");
    expect(plan!.fragments[1].text).toBe("какие новости в москве");
  });

  it("returns null for non-JSON text", () => {
    expect(tryParseRoutingPlan("Hello, world!")).toBeNull();
  });

  it("returns null for JSON without fragments", () => {
    expect(tryParseRoutingPlan('{"result": "ok"}')).toBeNull();
  });

  it("returns null for empty fragments array", () => {
    expect(tryParseRoutingPlan('{"fragments": []}')).toBeNull();
  });

  it("returns null for fragments with missing fields", () => {
    expect(tryParseRoutingPlan('{"fragments": [{"text": "hello"}]}')).toBeNull();
  });

  it("handles leading/trailing whitespace", () => {
    const json = `  {"fragments": [{"text": "q", "agent": "a", "confidence": 1}]}  `;
    expect(tryParseRoutingPlan(json)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// matchFragmentToAgent
// ---------------------------------------------------------------------------

const AGENTS: Addressable[] = [
  { id: "id-weather", name: "weather-agent", status: "RUNNING", kind: "agent" },
  { id: "id-search", name: "web-search-agent", status: "RUNNING", kind: "agent" },
  { id: "id-calc", name: "calculator", status: "RUNNING", kind: "agent" },
];

describe("matchFragmentToAgent", () => {
  it("exact name match (case-insensitive)", () => {
    const result = matchFragmentToAgent("weather-agent", AGENTS);
    expect(result?.id).toBe("id-weather");
  });

  it("matches weather_forecast to weather-agent via token overlap", () => {
    const result = matchFragmentToAgent("weather_forecast", AGENTS);
    expect(result?.id).toBe("id-weather");
  });

  it("matches internet_search to web-search-agent via token overlap", () => {
    const result = matchFragmentToAgent("internet_search", AGENTS);
    expect(result?.id).toBe("id-search");
  });

  it("matches via member role", () => {
    const roles = new Map([["id-calc", "math_calculator"]]);
    const result = matchFragmentToAgent("math_calculator", AGENTS, roles);
    expect(result?.id).toBe("id-calc");
  });

  it("returns null when no match found", () => {
    const result = matchFragmentToAgent("completely_unknown", AGENTS);
    expect(result).toBeNull();
  });

  it("returns null for empty agent list", () => {
    const result = matchFragmentToAgent("weather_forecast", []);
    expect(result).toBeNull();
  });

  it("ignores stop tokens like 'agent'", () => {
    // "agent" alone should not match anything
    const agents: Addressable[] = [
      { id: "id-foo", name: "foo-agent", status: "RUNNING", kind: "agent" },
    ];
    const result = matchFragmentToAgent("agent", agents);
    expect(result).toBeNull();
  });
});
