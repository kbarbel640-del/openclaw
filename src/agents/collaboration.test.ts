/**
 * COLLABORATION SYSTEM TESTS
 */

import { beforeEach, describe, it, expect } from "vitest";
import {
  initializeCollaborativeSession,
  publishProposal,
  challengeProposal,
  agreeToProposal,
  finalizeDecision,
  getDecisionThread,
  resetCollaborationStateForTests,
} from "../gateway/server-methods/collaboration.js";
import { getCollaborationSystemPrompt, getRoleSpecificGuidance } from "./collaboration-prompts.js";
import { buildCollaborationContext, formatDecisionsForTask } from "./collaboration-spawn.js";

describe("Collaboration System", () => {
  beforeEach(() => {
    resetCollaborationStateForTests();
  });

  it("should initialize a collaborative session", () => {
    const session = initializeCollaborativeSession({
      topic: "Test Debate",
      agents: ["backend", "frontend", "security"],
      moderator: "cto",
    });

    expect(session.topic).toBe("Test Debate");
    expect(session.members).toEqual(["backend", "frontend", "security"]);
    expect(session.moderator).toBe("cto");
    expect(session.status).toBe("planning");
  });

  it("should publish a proposal", () => {
    const session = initializeCollaborativeSession({
      topic: "API Design",
      agents: ["backend", "frontend"],
    });

    const result = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "backend",
      decisionTopic: "REST Endpoints",
      proposal: "Use RESTful endpoints",
      reasoning: "Industry standard, widely understood",
    });

    expect(result.decisionId).toBeDefined();
    expect(result.sessionKey).toBe(session.sessionKey);
  });

  it("should challenge a proposal", () => {
    const session = initializeCollaborativeSession({
      topic: "API Design",
      agents: ["backend", "frontend"],
    });

    const proposal = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "backend",
      decisionTopic: "Auth Method",
      proposal: "Use JWT",
      reasoning: "Stateless",
    });

    expect(() => {
      challengeProposal({
        sessionKey: session.sessionKey,
        decisionId: proposal.decisionId,
        agentId: "frontend",
        challenge: "JWT tokens are large, bad for mobile",
        suggestedAlternative: "Use session cookies for web",
      });
    }).not.toThrow();
  });

  it("should reject challenge from non-member agent", () => {
    const session = initializeCollaborativeSession({
      topic: "API Design",
      agents: ["backend", "frontend"],
    });

    const proposal = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "backend",
      decisionTopic: "Auth Method",
      proposal: "Use JWT",
      reasoning: "Stateless",
    });

    expect(() => {
      challengeProposal({
        sessionKey: session.sessionKey,
        decisionId: proposal.decisionId,
        agentId: "random-agent",
        challenge: "I disagree",
      });
    }).toThrow(/not authorized/i);
  });

  it("should track agreement", () => {
    const session = initializeCollaborativeSession({
      topic: "Database",
      agents: ["backend", "database"],
    });

    const proposal = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "backend",
      decisionTopic: "Database Type",
      proposal: "Use PostgreSQL",
      reasoning: "Reliable and feature-rich",
    });

    agreeToProposal({
      sessionKey: session.sessionKey,
      decisionId: proposal.decisionId,
      agentId: "database",
    });

    const decision = session.decisions[0];
    expect(decision.consensus?.agreed).toContain("database");
  });

  it("should finalize a decision", () => {
    const session = initializeCollaborativeSession({
      topic: "Architecture",
      agents: ["backend", "frontend", "security"],
      moderator: "cto",
      minRounds: 0,
    });

    const proposal = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "backend",
      decisionTopic: "Security",
      proposal: "Use OAuth2 + PKCE",
      reasoning: "Most secure for all client types",
    });

    finalizeDecision({
      sessionKey: session.sessionKey,
      decisionId: proposal.decisionId,
      finalDecision: "OAuth2 Authorization Code Flow with PKCE",
      moderatorId: "cto",
    });

    const decision = session.decisions[0];
    expect(decision.consensus).toBeDefined();
    expect(decision.consensus?.finalDecision).toContain("OAuth2");
  });

  it("should reject finalization by non-moderator when moderator is set", () => {
    const session = initializeCollaborativeSession({
      topic: "Architecture",
      agents: ["backend", "frontend", "security"],
      moderator: "cto",
      minRounds: 0,
    });

    const proposal = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "backend",
      decisionTopic: "Security",
      proposal: "Use OAuth2 + PKCE",
      reasoning: "Most secure for all client types",
    });

    expect(() => {
      finalizeDecision({
        sessionKey: session.sessionKey,
        decisionId: proposal.decisionId,
        finalDecision: "OAuth2 Authorization Code Flow with PKCE",
        moderatorId: "frontend",
      });
    }).toThrow(/not authorized/i);
  });

  it("should retrieve decision thread", () => {
    const session = initializeCollaborativeSession({
      topic: "Testing",
      agents: ["qa", "backend"],
    });

    const proposal = publishProposal({
      sessionKey: session.sessionKey,
      agentId: "qa",
      decisionTopic: "Test Coverage",
      proposal: "100% coverage required",
      reasoning: "Critical systems need full coverage",
    });

    challengeProposal({
      sessionKey: session.sessionKey,
      decisionId: proposal.decisionId,
      agentId: "backend",
      challenge: "100% is impossible to maintain",
      suggestedAlternative: "90% with critical paths at 100%",
    });

    const thread = getDecisionThread({
      sessionKey: session.sessionKey,
      decisionId: proposal.decisionId,
    });

    expect(thread.length).toBeGreaterThan(0);
    expect(thread[0].type).toBe("proposal");
    expect(thread[1]?.type).toBe("challenge");
  });

  describe("Prompts", () => {
    it("should generate collaboration system prompt", () => {
      const prompt = getCollaborationSystemPrompt({
        role: "Backend",
        expertise: "API design",
        teamContext: "Building e-commerce platform",
        debateTopic: "Payment Processing",
        phase: "proposals",
      });

      expect(prompt).toContain("Backend");
      expect(prompt).toContain("proposals");
      expect(prompt).toContain("I propose");
    });

    it("should get role-specific guidance", () => {
      const guidance = getRoleSpecificGuidance("security-engineer");
      expect(guidance).toContain("Security Engineer");
      expect(guidance).toContain("threats");
    });

    it("should get backend guidance", () => {
      const guidance = getRoleSpecificGuidance("backend-architect");
      expect(guidance).toContain("API");
      expect(guidance).toContain("scalability");
    });
  });

  describe("Spawn Integration", () => {
    it("should build collaboration context", async () => {
      const session = initializeCollaborativeSession({
        topic: "Auth System",
        agents: ["backend", "frontend", "security"],
      });

      publishProposal({
        sessionKey: session.sessionKey,
        agentId: "backend",
        decisionTopic: "Flow",
        proposal: "OAuth2",
        reasoning: "Secure",
      });

      const context = await buildCollaborationContext({
        debateSessionKey: session.sessionKey,
        agentId: "backend",
        agentRole: "Backend Architect",
        agentExpertise: "API design",
      });

      expect(context.systemPromptAddendum).toContain("Backend Architect");
      expect(context.decisionContext).toBeDefined();
      expect(context.sharedContext).toContain("Auth System");
    });

    it("should format decisions for task", () => {
      const decisions = [
        {
          id: "1",
          topic: "Database",
          consensus: { finalDecision: "Use PostgreSQL" },
        },
        {
          id: "2",
          topic: "Cache",
          proposals: [
            { from: "backend", proposal: "Redis" },
            { from: "devops", proposal: "Memcached" },
          ],
        },
      ];

      const formatted = formatDecisionsForTask(decisions);

      expect(formatted).toContain("Database");
      expect(formatted).toContain("PostgreSQL");
      expect(formatted).toContain("Cache");
      expect(formatted).toContain("Redis");
    });
  });
});
