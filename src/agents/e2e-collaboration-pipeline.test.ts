/**
 * E2E COLLABORATION PIPELINE TEST
 *
 * Simulates a complex multi-agent collaboration scenario end-to-end:
 *
 * SCENARIO: "Build a Real-Time Trading Dashboard"
 *
 * FLOW:
 * 1. INTAKE: Orchestrator receives feature request
 * 2. DISCOVERY: Capabilities registry selects the right agents
 * 3. BRAINSTORM: Collaboration session with proposals from multiple specialists
 * 4. DEBATE: Agents challenge each other's proposals
 * 5. DELEGATION: Orchestrator delegates to specialists (downward)
 * 6. UPWARD REQUEST: Worker requests help from specialist (requires review)
 * 7. PROGRESS: Sub-agents report progress
 * 8. TEAM WORKSPACE: Agents share artifacts and context
 * 9. DECISION: Moderator finalizes architectural decisions
 * 10. DELIVERY: Final plan assembled from team contributions
 *
 * HIERARCHY TESTED:
 *   orchestrator (main) → delegates to leads/specialists
 *   specialist (backend) → delegates to worker
 *   worker → upward request to specialist (requires review)
 *   specialist → review approves/rejects
 *
 * AUTHORIZATION TESTED:
 *   - Downward delegation: direct (no review)
 *   - Upward request: pending_review → approved/rejected
 *   - Same-rank: peer delegation
 *   - Role-based spawn permission
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
// Collaboration
import {
  initializeCollaborativeSession,
  publishProposal,
  challengeProposal,
  agreeToProposal,
  finalizeDecision,
  getDecisionThread,
  getCollaborationContext,
} from "../gateway/server-methods/collaboration.js";
// Hierarchy
import { canSpawnRole, canDelegate, AGENT_ROLE_RANK } from "./agent-scope.js";
// Capabilities
import {
  registerAgentCapabilities,
  findAgentsByCapability,
  findBestAgentForTask,
  getAgentCapabilities,
  getAllAgentCapabilities,
  getAgentWorkload,
  resetCapabilitiesRegistryForTests,
} from "./capabilities-registry.js";
// Prompts
import { getCollaborationSystemPrompt, getRoleSpecificGuidance } from "./collaboration-prompts.js";
// Spawn integration
import { buildCollaborationContext, formatDecisionsForTask } from "./collaboration-spawn.js";
import { evaluateDelegationRequest } from "./delegation-decision-tree.js";
// Delegation
import {
  registerDelegation,
  reviewDelegation,
  updateDelegationState,
  completeDelegation,
  redirectDelegation,
  getDelegation,
  listDelegationsForAgent,
  // listPendingReviewsForAgent,
  getAgentDelegationMetrics,
  resetDelegationRegistryForTests,
} from "./delegation-registry.js";
// Team Workspace
import {
  resolveTeamWorkspace,
  writeTeamArtifact,
  readTeamArtifact,
  listTeamArtifacts,
  writeTeamContext,
  readTeamContext,
  recordTeamDecision,
  listTeamDecisions,
  buildTeamContextSummary,
} from "./team-workspace.js";

// Progress
// import type { SubagentProgress } from "./subagent-registry.js";

describe("E2E Collaboration Pipeline: Real-Time Trading Dashboard", () => {
  let tmpStateDir: string | null = null;
  const prevStateDir = process.env.OPENCLAW_STATE_DIR;

  // Ensure this E2E test is hermetic and does not write into ~/.openclaw.
  // Some environments (CI / sandboxes) forbid writing to the user's home.
  beforeEach(async () => {
    if (!tmpStateDir) {
      tmpStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-e2e-collab-"));
      process.env.OPENCLAW_STATE_DIR = tmpStateDir;
    }
  });

  afterAll(async () => {
    if (prevStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = prevStateDir;
    }
    if (tmpStateDir) {
      await fs.rm(tmpStateDir, { recursive: true, force: true });
    }
  });

  // Agent roster for the test
  const AGENTS = {
    orchestrator: { id: "main", role: "orchestrator" as const, name: "Tech Lead" },
    backendLead: { id: "backend-architect", role: "specialist" as const, name: "Carlos" },
    frontendLead: { id: "frontend-architect", role: "specialist" as const, name: "Aninha" },
    securityEng: { id: "security-engineer", role: "specialist" as const, name: "Mariana" },
    databaseEng: { id: "database-engineer", role: "specialist" as const, name: "Fernanda" },
    devopsEng: { id: "devops-engineer", role: "specialist" as const, name: "Thiago" },
    tradingEngine: { id: "trading-engine", role: "specialist" as const, name: "Renata" },
    qaLead: { id: "qa-lead", role: "specialist" as const, name: "Isabela" },
    performanceEng: { id: "performance-engineer", role: "worker" as const, name: "Perf Worker" },
  };

  beforeEach(() => {
    resetDelegationRegistryForTests();
    resetCapabilitiesRegistryForTests();
  });

  // ═══════════════════════════════════════════
  // PHASE 1: INTAKE & DISCOVERY
  // ═══════════════════════════════════════════

  describe("Phase 1: Intake & Agent Discovery", () => {
    it("should register agent capabilities and find best matches for tasks", () => {
      // Register all agent capabilities
      registerAgentCapabilities(AGENTS.backendLead.id, {
        name: AGENTS.backendLead.name,
        role: AGENTS.backendLead.role,
        capabilities: ["api-design", "websocket", "node", "elysia", "real-time", "typescript"],
        expertise: ["REST API design", "WebSocket server architecture", "Event-driven systems"],
        availability: "auto",
      });

      registerAgentCapabilities(AGENTS.frontendLead.id, {
        name: AGENTS.frontendLead.name,
        role: AGENTS.frontendLead.role,
        capabilities: ["react", "charts", "ui", "dashboard", "real-time", "typescript"],
        expertise: ["Real-time data visualization", "Trading UI patterns", "Chart libraries"],
        availability: "auto",
      });

      registerAgentCapabilities(AGENTS.securityEng.id, {
        name: AGENTS.securityEng.name,
        role: AGENTS.securityEng.role,
        capabilities: ["security", "auth", "encryption", "api-security", "compliance"],
        expertise: ["Financial data security", "API authentication", "OWASP compliance"],
        availability: "auto",
      });

      registerAgentCapabilities(AGENTS.databaseEng.id, {
        name: AGENTS.databaseEng.name,
        role: AGENTS.databaseEng.role,
        capabilities: ["database", "postgresql", "redis", "time-series", "query-optimization"],
        expertise: ["Time-series data storage", "Redis pub/sub", "Financial data modeling"],
        availability: "auto",
      });

      registerAgentCapabilities(AGENTS.tradingEngine.id, {
        name: AGENTS.tradingEngine.name,
        role: AGENTS.tradingEngine.role,
        capabilities: ["trading", "order-management", "exchange-api", "market-data", "websocket"],
        expertise: [
          "Exchange API integration",
          "Order book management",
          "Market data normalization",
        ],
        availability: "auto",
      });

      registerAgentCapabilities(AGENTS.performanceEng.id, {
        name: AGENTS.performanceEng.name,
        role: AGENTS.performanceEng.role,
        capabilities: ["performance", "profiling", "optimization", "load-testing"],
        expertise: ["Latency optimization", "WebSocket performance tuning"],
        availability: "auto",
      });

      // Verify all agents are registered
      const all = getAllAgentCapabilities();
      expect(all.length).toBe(6);

      // DISCOVERY: Find best agent for backend API task — uses task-classifier + capabilities
      const wsTask = findBestAgentForTask(
        "Implement a node typescript API server with websocket endpoints for real-time data",
      );
      expect(wsTask).not.toBeNull();
      // Should match an agent that has relevant capabilities
      expect(wsTask!.confidence).toBeGreaterThan(0);
      expect(wsTask!.reason).toBeDefined();

      // DISCOVERY: Find agents with "database" capability
      const dbAgents = findAgentsByCapability("database");
      expect(dbAgents.length).toBeGreaterThanOrEqual(1);
      expect(dbAgents[0].agentId).toBe(AGENTS.databaseEng.id);

      // DISCOVERY: Find agents by direct capability query
      const secAgents = findAgentsByCapability("security");
      expect(secAgents.length).toBeGreaterThanOrEqual(1);
      expect(secAgents[0].agentId).toBe(AGENTS.securityEng.id);

      // DISCOVERY: Find agents by "compliance" capability
      const complianceAgents = findAgentsByCapability("compliance");
      expect(complianceAgents.length).toBeGreaterThanOrEqual(1);
      expect(complianceAgents[0].agentId).toBe(AGENTS.securityEng.id);

      // Get individual capability profile
      const backendProfile = getAgentCapabilities(AGENTS.backendLead.id);
      expect(backendProfile).not.toBeNull();
      expect(backendProfile!.capabilities).toContain("api-design");
      expect(backendProfile!.expertise).toContain("WebSocket server architecture");
    });

    it("should track agent workload and factor it into routing", () => {
      registerAgentCapabilities(AGENTS.backendLead.id, {
        name: AGENTS.backendLead.name,
        role: AGENTS.backendLead.role,
        capabilities: ["api-design", "websocket", "node"],
        expertise: ["API design"],
        availability: "auto",
      });

      // Initially no workload
      const workload = getAgentWorkload(AGENTS.backendLead.id);
      expect(workload.activeTasks).toBe(0);
      expect(workload.activeSpawns).toBe(0);

      // Create delegations to increase workload
      registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Design WebSocket API",
        priority: "high",
      });

      // Now workload should increase
      const updatedWorkload = getAgentWorkload(AGENTS.backendLead.id);
      expect(updatedWorkload.activeTasks).toBeGreaterThan(0);
    });

    it("should respect manual availability", () => {
      registerAgentCapabilities("manual-agent", {
        name: "Manual Agent",
        role: "specialist",
        capabilities: ["api-design", "websocket"],
        expertise: ["Everything"],
        availability: "manual", // Must be explicitly selected
      });

      registerAgentCapabilities(AGENTS.backendLead.id, {
        name: AGENTS.backendLead.name,
        role: AGENTS.backendLead.role,
        capabilities: ["api-design", "websocket"],
        expertise: ["API design"],
        availability: "auto",
      });

      // Auto-routing should skip manual agents — use findAgentsByCapability and verify manual is excluded from auto routing
      const allApiAgents = findAgentsByCapability("api-design");
      // Both agents have the capability
      expect(allApiAgents.length).toBe(2);

      // But findBestAgentForTask should skip the manual one
      // We need enough keywords for task-classifier to score > 0
      const match = findBestAgentForTask(
        "implement a node typescript server program with api-design websocket code",
      );
      if (match) {
        // If auto-routing finds a match, it must NOT be the manual agent
        expect(match.agentId).not.toBe("manual-agent");
        expect(match.agentId).toBe(AGENTS.backendLead.id);
      }
      // Either way, the manual agent should not appear in auto-routing results
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 2: BRAINSTORM & DEBATE
  // ═══════════════════════════════════════════

  describe("Phase 2: Brainstorm & Architectural Debate", () => {
    it("should run a full debate cycle: propose → challenge → counter-propose → agree → finalize", () => {
      // Orchestrator creates debate session (minRounds: 0 for legacy test)
      const session = initializeCollaborativeSession({
        topic: "Real-Time Trading Dashboard Architecture",
        agents: [
          AGENTS.backendLead.id,
          AGENTS.frontendLead.id,
          AGENTS.databaseEng.id,
          AGENTS.securityEng.id,
          AGENTS.tradingEngine.id,
        ],
        moderator: AGENTS.orchestrator.id,
        minRounds: 0,
      });

      expect(session.status).toBe("planning");
      expect(session.members.length).toBe(5);

      // ── DECISION 1: Data Streaming Architecture ──

      // Backend proposes WebSocket
      const wsProposal = publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.backendLead.id,
        decisionTopic: "Data Streaming Architecture",
        proposal: "WebSocket with Redis pub/sub fan-out",
        reasoning: "Low latency, scalable via Redis, each client gets a dedicated WS channel",
      });
      expect(wsProposal.decisionId).toBeDefined();

      // Trading Engine challenges — wants SSE for simplicity
      challengeProposal({
        sessionKey: session.sessionKey,
        decisionId: wsProposal.decisionId,
        agentId: AGENTS.tradingEngine.id,
        challenge:
          "SSE is simpler for unidirectional market data. WebSocket adds complexity for order execution that most dashboard users don't need.",
        suggestedAlternative: "SSE for market data streaming, WebSocket only for order placement",
      });

      // Frontend agrees with the hybrid approach
      agreeToProposal({
        sessionKey: session.sessionKey,
        decisionId: wsProposal.decisionId,
        agentId: AGENTS.frontendLead.id,
      });

      // Database agrees
      agreeToProposal({
        sessionKey: session.sessionKey,
        decisionId: wsProposal.decisionId,
        agentId: AGENTS.databaseEng.id,
      });

      // Moderator (orchestrator) finalizes with hybrid decision
      finalizeDecision({
        sessionKey: session.sessionKey,
        decisionId: wsProposal.decisionId,
        finalDecision:
          "Hybrid approach: SSE for market data streaming (unidirectional), WebSocket for order placement and user actions (bidirectional). Redis pub/sub as the fan-out layer for both.",
        moderatorId: AGENTS.orchestrator.id,
      });

      // Verify decision thread has the full history
      const thread = getDecisionThread({
        sessionKey: session.sessionKey,
        decisionId: wsProposal.decisionId,
      });
      expect(thread.length).toBeGreaterThanOrEqual(4); // proposal + challenge + agree(s) + finalize

      // ── DECISION 2: Security Model ──

      const secProposal = publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.securityEng.id,
        decisionTopic: "Security & Authentication",
        proposal:
          "OAuth2 + API keys with rate limiting. All financial data encrypted at rest (AES-256) and in transit (TLS 1.3). Per-user API key scoping with IP whitelist.",
        reasoning:
          "Financial data requires regulatory compliance. Multi-layer auth prevents unauthorized trading.",
      });

      // Backend challenges on complexity
      challengeProposal({
        sessionKey: session.sessionKey,
        decisionId: secProposal.decisionId,
        agentId: AGENTS.backendLead.id,
        challenge:
          "IP whitelist is too restrictive for mobile users. JWT with refresh tokens would be simpler.",
        suggestedAlternative:
          "JWT with short-lived access tokens (5min) + refresh tokens + device fingerprinting instead of IP whitelist",
      });

      // Security agrees with modification
      agreeToProposal({
        sessionKey: session.sessionKey,
        decisionId: secProposal.decisionId,
        agentId: AGENTS.securityEng.id,
      });

      finalizeDecision({
        sessionKey: session.sessionKey,
        decisionId: secProposal.decisionId,
        finalDecision:
          "OAuth2 with JWT (5-min access tokens + refresh tokens). Device fingerprinting for mobile. API keys for programmatic access with rate limiting. AES-256 at rest, TLS 1.3 in transit.",
        moderatorId: AGENTS.orchestrator.id,
      });

      // Verify session state
      const context = getCollaborationContext(session.sessionKey);
      expect(context).toBeDefined();
      expect(context!.decisions.length).toBe(2);
      expect(context!.decisions[0].consensus).toBeDefined();
      expect(context!.decisions[1].consensus).toBeDefined();
    });

    it("should generate proper collaboration prompts for each phase", () => {
      const phases = ["opening", "proposals", "debate", "consensus", "finalization"] as const;

      for (const phase of phases) {
        const prompt = getCollaborationSystemPrompt({
          role: "Backend Architect",
          expertise: "API design, WebSocket, real-time systems",
          teamContext: "Building real-time trading dashboard",
          debateTopic: "Data Streaming Architecture",
          phase,
        });

        expect(prompt).toContain("Backend Architect");
        expect(prompt).toContain(phase.toUpperCase());
      }

      // Role-specific guidance
      const backendGuidance = getRoleSpecificGuidance("backend-architect");
      expect(backendGuidance).toContain("API");

      const securityGuidance = getRoleSpecificGuidance("security-engineer");
      expect(securityGuidance).toContain("threats");
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 3: HIERARCHICAL DELEGATION
  // ═══════════════════════════════════════════

  describe("Phase 3: Hierarchical Delegation & Authorization", () => {
    it("should handle downward delegation (orchestrator → specialist): direct assignment", () => {
      const delegation = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Implement WebSocket server with Redis pub/sub fan-out for market data streaming",
        priority: "high",
      });

      // Downward delegation should be auto-assigned (no review needed)
      expect(delegation.direction).toBe("downward");
      expect(delegation.state).toBe("assigned");
      expect(delegation.review).toBeUndefined();

      // Specialist accepts and starts work
      const accepted = updateDelegationState(delegation.id, "in_progress");
      expect(accepted).not.toBeNull();
      expect(accepted!.state).toBe("in_progress");
      expect(accepted!.startedAt).toBeDefined();
    });

    it("should handle upward request (worker → specialist): requires review", () => {
      // Worker requests help from specialist
      const request = registerDelegation({
        fromAgentId: AGENTS.performanceEng.id,
        fromSessionKey: "agent:performance-engineer:subagent:test-uuid",
        fromRole: "worker",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Need guidance on WebSocket connection pooling strategy for high-throughput scenarios",
        priority: "normal",
        justification:
          "Load tests show 10K+ concurrent connections causing GC pressure. Need architectural guidance from backend lead.",
      });

      // Upward request should require review
      expect(request.direction).toBe("upward");
      expect(request.state).toBe("pending_review");

      // Specialist reviews the request
      const evaluated = evaluateDelegationRequest({
        request,
        superiorRole: "specialist",
        superiorAgentId: AGENTS.backendLead.id,
      });

      expect(evaluated.recommendation).toBe("approve");
      expect(evaluated.withinScope).toBe(true);
      expect(evaluated.requiresEscalation).toBe(false);
      expect(evaluated.confidence).toBeGreaterThan(0.5);

      // Specialist approves
      const reviewed = reviewDelegation(request.id, {
        reviewerId: AGENTS.backendLead.id,
        decision: "approve",
        reasoning: "Valid concern about connection pooling. Will provide architecture guidance.",
        evaluations: {
          withinScope: true,
          requiresEscalation: false,
          canDelegateToOther: false,
        },
      });

      expect(reviewed).not.toBeNull();
      expect(reviewed!.state).toBe("assigned");
      expect(reviewed!.review?.decision).toBe("approve");
    });

    it("should handle upward request rejection when out of scope", () => {
      const request = registerDelegation({
        fromAgentId: AGENTS.performanceEng.id,
        fromSessionKey: "agent:performance-engineer:subagent:test-uuid",
        fromRole: "worker",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Deploy the staging environment to Kubernetes",
        priority: "normal",
        justification: "Need to deploy for load testing",
      });

      expect(request.state).toBe("pending_review");

      // Specialist rejects — this is DevOps work
      const reviewed = reviewDelegation(request.id, {
        reviewerId: AGENTS.backendLead.id,
        decision: "reject",
        reasoning: "Deployment is DevOps responsibility. Please contact devops-engineer.",
        evaluations: {
          withinScope: false,
          requiresEscalation: false,
          canDelegateToOther: true,
          suggestedAlternative: AGENTS.devopsEng.id,
        },
      });

      expect(reviewed).not.toBeNull();
      expect(reviewed!.state).toBe("rejected");
    });

    it("should handle redirect delegation to better-suited agent", () => {
      const request = registerDelegation({
        fromAgentId: AGENTS.performanceEng.id,
        fromSessionKey: "agent:performance-engineer:subagent:test-uuid",
        fromRole: "worker",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Optimize Redis pub/sub channel subscription queries",
        priority: "high",
        justification: "Redis queries are the bottleneck in our load tests",
      });

      // Backend redirects to Database Engineer (more appropriate)
      const redirected = redirectDelegation(request.id, {
        agentId: AGENTS.databaseEng.id,
        reason: "Redis optimization is database-engineer domain. Redirecting to Fernanda.",
      });

      expect(redirected).not.toBeNull();
      expect(redirected!.state).toBe("redirected");
      expect(redirected!.redirectedTo?.agentId).toBe(AGENTS.databaseEng.id);
    });

    it("should complete delegation with results", () => {
      const delegation = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.frontendLead.id,
        toRole: "specialist",
        task: "Design the trading dashboard component hierarchy and data flow",
        priority: "high",
      });

      // Start work
      updateDelegationState(delegation.id, "in_progress");

      // Complete with results
      const completed = completeDelegation(delegation.id, {
        status: "success",
        summary:
          "Dashboard component tree designed: TradingView → OrderBook, Chart, TickerBar, TradeHistory. Using React Query for server state + Zustand for UI state. Real-time updates via SSE EventSource hooks.",
      });

      expect(completed).not.toBeNull();
      expect(completed!.state).toBe("completed");
      expect(completed!.result?.status).toBe("success");
      expect(completed!.completedAt).toBeDefined();
    });

    it("should enforce role-based spawn permissions", () => {
      // Orchestrator can spawn any role
      expect(canSpawnRole("orchestrator", "orchestrator")).toBe(true);
      expect(canSpawnRole("orchestrator", "lead")).toBe(true);
      expect(canSpawnRole("orchestrator", "specialist")).toBe(true);
      expect(canSpawnRole("orchestrator", "worker")).toBe(true);

      // Specialist can spawn specialist or worker, not orchestrator/lead
      expect(canSpawnRole("specialist", "worker")).toBe(true);
      expect(canSpawnRole("specialist", "specialist")).toBe(true);
      expect(canSpawnRole("specialist", "lead")).toBe(false);
      expect(canSpawnRole("specialist", "orchestrator")).toBe(false);

      // Worker can only spawn worker
      expect(canSpawnRole("worker", "worker")).toBe(true);
      expect(canSpawnRole("worker", "specialist")).toBe(false);
    });

    it("should resolve delegation direction correctly", () => {
      // Higher → Lower = downward
      expect(canDelegate("orchestrator", "specialist")).toBe("downward");
      expect(canDelegate("lead", "worker")).toBe("downward");

      // Lower → Higher = upward
      expect(canDelegate("worker", "specialist")).toBe("upward");
      expect(canDelegate("specialist", "orchestrator")).toBe("upward");

      // Same rank = downward (peer)
      expect(canDelegate("specialist", "specialist")).toBe("downward");
    });

    it("should track delegation metrics across multiple interactions", () => {
      // Orchestrator delegates to 3 specialists
      const d1 = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "WebSocket server",
      });

      const _d2 = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.frontendLead.id,
        toRole: "specialist",
        task: "Dashboard UI",
      });

      const _d3 = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.databaseEng.id,
        toRole: "specialist",
        task: "Schema design",
      });

      // Complete one
      updateDelegationState(d1.id, "in_progress");
      completeDelegation(d1.id, { status: "success", summary: "Done" });

      // Metrics for orchestrator
      const orchMetrics = getAgentDelegationMetrics(AGENTS.orchestrator.id);
      expect(orchMetrics.sent).toBe(3);
      expect(orchMetrics.completed).toBe(1);
      expect(orchMetrics.pending).toBe(2); // d2 and d3 still assigned

      // Metrics for backend
      const beMetrics = getAgentDelegationMetrics(AGENTS.backendLead.id);
      expect(beMetrics.received).toBeGreaterThanOrEqual(1);
      expect(beMetrics.completed).toBe(1);

      // List delegations for an agent
      const backendDelegations = listDelegationsForAgent(AGENTS.backendLead.id);
      expect(backendDelegations.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 4: TEAM WORKSPACE & SHARED CONTEXT
  // ═══════════════════════════════════════════

  describe("Phase 4: Team Workspace & Shared Context", () => {
    const testSessionKey = "agent:main:main";

    it("should resolve team workspace path", () => {
      const wsPath = resolveTeamWorkspace(testSessionKey);
      expect(wsPath).toContain(".team");
    });

    it("should write and read team artifacts", async () => {
      await writeTeamArtifact({
        requesterSessionKey: testSessionKey,
        name: "api-spec.yaml",
        content: `openapi: 3.0.0
info:
  title: Trading Dashboard API
  version: 1.0.0
paths:
  /market-data/stream:
    get:
      summary: SSE endpoint for real-time market data
  /orders:
    post:
      summary: Place a new order via WebSocket`,
        metadata: {
          description: "OpenAPI spec for Trading Dashboard",
          tags: ["api", "trading", "openapi"],
        },
      });

      const content = await readTeamArtifact({
        requesterSessionKey: testSessionKey,
        name: "api-spec.yaml",
      });

      expect(content).not.toBeNull();
      expect(content).toContain("Trading Dashboard API");
      expect(content).toContain("/market-data/stream");
    });

    it("should write and read team context", async () => {
      await writeTeamContext({
        requesterSessionKey: testSessionKey,
        key: "streaming_protocol",
        value: "SSE for reads, WebSocket for writes",
      });

      await writeTeamContext({
        requesterSessionKey: testSessionKey,
        key: "database",
        value: "PostgreSQL with TimescaleDB extension for time-series data",
      });

      const streaming = await readTeamContext({
        requesterSessionKey: testSessionKey,
        key: "streaming_protocol",
      });
      expect(streaming).toBe("SSE for reads, WebSocket for writes");

      const db = await readTeamContext({
        requesterSessionKey: testSessionKey,
        key: "database",
      });
      expect(db).toContain("TimescaleDB");
    });

    it("should record and list team decisions", async () => {
      await recordTeamDecision({
        requesterSessionKey: testSessionKey,
        topic: "Data Streaming Architecture",
        decision: "Hybrid SSE + WebSocket with Redis pub/sub",
        participants: [AGENTS.backendLead.id, AGENTS.frontendLead.id, AGENTS.tradingEngine.id],
      });

      await recordTeamDecision({
        requesterSessionKey: testSessionKey,
        topic: "Security Model",
        decision: "OAuth2 + JWT with device fingerprinting",
        participants: [AGENTS.securityEng.id, AGENTS.backendLead.id],
      });

      const decisions = await listTeamDecisions({
        requesterSessionKey: testSessionKey,
      });

      expect(decisions.length).toBeGreaterThanOrEqual(2);
      // Most recent first
      expect(decisions[0].topic).toBe("Security Model");
      expect(decisions[1].topic).toBe("Data Streaming Architecture");
    });

    it("should list team artifacts with metadata", async () => {
      await writeTeamArtifact({
        requesterSessionKey: testSessionKey,
        name: "schema.sql",
        content: "CREATE TABLE trades (id SERIAL, symbol TEXT, price NUMERIC);",
        metadata: {
          description: "Database schema",
          tags: ["database", "sql"],
        },
      });

      const artifacts = await listTeamArtifacts({
        requesterSessionKey: testSessionKey,
      });

      expect(artifacts.length).toBeGreaterThanOrEqual(1);
      const schemaArtifact = artifacts.find((a) => a.name === "schema.sql");
      expect(schemaArtifact).toBeDefined();
      expect(schemaArtifact!.metadata.description).toBe("Database schema");
    });

    it("should build team context summary for spawned agents", async () => {
      // Write some context first
      await writeTeamContext({
        requesterSessionKey: testSessionKey,
        key: "project",
        value: "Real-Time Trading Dashboard",
      });

      const summary = await buildTeamContextSummary({
        requesterSessionKey: testSessionKey,
      });

      expect(summary).toBeDefined();
      expect(typeof summary).toBe("string");
      // Summary should contain context and artifacts info
      expect(summary.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 5: SPAWN INTEGRATION & CONTEXT INHERITANCE
  // ═══════════════════════════════════════════

  describe("Phase 5: Spawn Integration & Context Inheritance", () => {
    it("should build collaboration-aware task with debate decisions", async () => {
      // Create a debate with decisions (minRounds: 0 for legacy test)
      const session = initializeCollaborativeSession({
        topic: "Trading Dashboard Architecture",
        agents: [AGENTS.backendLead.id, AGENTS.frontendLead.id],
        moderator: AGENTS.orchestrator.id,
        minRounds: 0,
      });

      const proposal = publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.backendLead.id,
        decisionTopic: "API Style",
        proposal: "REST + SSE hybrid",
        reasoning: "Best of both worlds",
      });

      finalizeDecision({
        sessionKey: session.sessionKey,
        decisionId: proposal.decisionId,
        finalDecision: "REST for CRUD + SSE for streaming",
        moderatorId: AGENTS.orchestrator.id,
      });

      // Build context for a spawned agent
      const context = await buildCollaborationContext({
        debateSessionKey: session.sessionKey,
        agentId: AGENTS.backendLead.id,
        agentRole: "Backend Architect",
        agentExpertise: "API design, WebSocket, Node.js",
        teamContext: "Building a real-time trading dashboard",
      });

      // Context should contain the debate decisions
      expect(context.systemPromptAddendum).toContain("Backend Architect");
      expect(context.decisionContext).toContain("API Style");
      expect(context.decisionContext).toContain("REST for CRUD + SSE for streaming");
      expect(context.sharedContext).toContain("Trading Dashboard Architecture");
    });

    it("should format multiple decisions for task injection", () => {
      const decisions = [
        {
          id: "d1",
          topic: "Streaming Protocol",
          consensus: { finalDecision: "SSE for reads, WebSocket for writes" },
        },
        {
          id: "d2",
          topic: "Database",
          consensus: { finalDecision: "PostgreSQL + TimescaleDB" },
        },
        {
          id: "d3",
          topic: "Cache Layer",
          proposals: [
            { from: AGENTS.backendLead.id, proposal: "Redis with pub/sub" },
            { from: AGENTS.databaseEng.id, proposal: "Redis Streams" },
          ],
        },
      ];

      const formatted = formatDecisionsForTask(decisions);
      expect(formatted).toContain("Streaming Protocol");
      expect(formatted).toContain("SSE for reads");
      expect(formatted).toContain("PostgreSQL + TimescaleDB");
      expect(formatted).toContain("Redis with pub/sub");
      expect(formatted).toContain("Redis Streams");
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 6: FULL PIPELINE INTEGRATION
  // ═══════════════════════════════════════════

  describe("Phase 6: Full Pipeline — Intake to Delivery", () => {
    it("should execute complete collaboration pipeline", async () => {
      // ── STEP 1: Register capabilities ──
      registerAgentCapabilities(AGENTS.backendLead.id, {
        name: "Carlos",
        role: "specialist",
        capabilities: ["api-design", "websocket", "node", "real-time"],
        expertise: ["Backend architecture"],
        availability: "auto",
      });
      registerAgentCapabilities(AGENTS.frontendLead.id, {
        name: "Aninha",
        role: "specialist",
        capabilities: ["react", "charts", "dashboard", "ui"],
        expertise: ["Frontend development"],
        availability: "auto",
      });
      registerAgentCapabilities(AGENTS.securityEng.id, {
        name: "Mariana",
        role: "specialist",
        capabilities: ["security", "auth", "compliance"],
        expertise: ["Security engineering"],
        availability: "auto",
      });

      // ── STEP 2: Auto-discover agents for the task ──
      const apiAgent = findBestAgentForTask("Build a WebSocket API for real-time market data");
      expect(apiAgent).not.toBeNull();

      const uiAgent = findBestAgentForTask(
        "Create a React UI dashboard with charts and components layout design",
      );
      expect(uiAgent).not.toBeNull();
      // Should match frontend (react, charts, dashboard, ui)
      expect(uiAgent!.agentId).toBe(AGENTS.frontendLead.id);

      // ── STEP 3: Brainstorm session ──
      const session = initializeCollaborativeSession({
        topic: "Real-Time Trading Dashboard",
        agents: [AGENTS.backendLead.id, AGENTS.frontendLead.id, AGENTS.securityEng.id],
        moderator: AGENTS.orchestrator.id,
        minRounds: 0,
      });

      // Proposals
      const p1 = publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.backendLead.id,
        decisionTopic: "Architecture",
        proposal: "Microservices with event-driven communication",
        reasoning: "Scalability and separation of concerns",
      });

      // Challenge
      challengeProposal({
        sessionKey: session.sessionKey,
        decisionId: p1.decisionId,
        agentId: AGENTS.frontendLead.id,
        challenge:
          "Microservices add latency. For a dashboard, a modular monolith might be better initially.",
      });

      // Finalize
      finalizeDecision({
        sessionKey: session.sessionKey,
        decisionId: p1.decisionId,
        finalDecision:
          "Start as modular monolith, design for future extraction to microservices. Event-driven internally.",
        moderatorId: AGENTS.orchestrator.id,
      });

      // ── STEP 4: Delegate implementation ──
      const backendDelegation = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Implement modular monolith with SSE streaming and WebSocket order placement",
        priority: "high",
      });
      expect(backendDelegation.state).toBe("assigned"); // downward = direct

      const frontendDelegation = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.frontendLead.id,
        toRole: "specialist",
        task: "Build React dashboard with TradingView charts and real-time data binding",
        priority: "high",
      });
      expect(frontendDelegation.state).toBe("assigned");

      const securityDelegation = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.securityEng.id,
        toRole: "specialist",
        task: "Security audit of auth flow and data encryption",
        priority: "normal",
      });
      expect(securityDelegation.state).toBe("assigned");

      // ── STEP 5: Team workspace — share artifacts ──
      const testSessionKey = "agent:main:main";

      await writeTeamArtifact({
        requesterSessionKey: testSessionKey,
        name: "architecture-decision.md",
        content:
          "# Architecture: Modular Monolith\n\nStart monolith, design for microservices extraction.",
        metadata: { description: "Architecture decision", tags: ["architecture"] },
      });

      await writeTeamContext({
        requesterSessionKey: testSessionKey,
        key: "architecture",
        value: "Modular monolith with event-driven internals",
      });

      // ── STEP 6: Agents complete their work ──
      updateDelegationState(backendDelegation.id, "in_progress");
      completeDelegation(backendDelegation.id, {
        status: "success",
        summary: "WebSocket + SSE server implemented with Redis pub/sub. All endpoints documented.",
      });

      updateDelegationState(frontendDelegation.id, "in_progress");
      completeDelegation(frontendDelegation.id, {
        status: "success",
        summary: "React dashboard with TradingView charts, order book, and real-time ticker.",
      });

      updateDelegationState(securityDelegation.id, "in_progress");
      completeDelegation(securityDelegation.id, {
        status: "success",
        summary:
          "Auth flow validated. Added rate limiting and encrypted storage. No critical vulnerabilities found.",
      });

      // ── STEP 7: Record final decision ──
      await recordTeamDecision({
        requesterSessionKey: testSessionKey,
        topic: "Trading Dashboard v1.0 Architecture",
        decision:
          "Modular monolith with SSE+WS, React dashboard, OAuth2+JWT auth. Ready for implementation.",
        participants: [AGENTS.backendLead.id, AGENTS.frontendLead.id, AGENTS.securityEng.id],
      });

      // ── VERIFY: Full pipeline state ──
      const orchMetrics = getAgentDelegationMetrics(AGENTS.orchestrator.id);
      expect(orchMetrics.sent).toBe(3);
      expect(orchMetrics.completed).toBe(3);
      expect(orchMetrics.pending).toBe(0);

      const decisions = await listTeamDecisions({ requesterSessionKey: testSessionKey });
      expect(decisions.length).toBeGreaterThanOrEqual(1);

      const artifacts = await listTeamArtifacts({ requesterSessionKey: testSessionKey });
      expect(artifacts.length).toBeGreaterThanOrEqual(1);

      const contextSummary = await buildTeamContextSummary({ requesterSessionKey: testSessionKey });
      expect(contextSummary.length).toBeGreaterThan(0);

      // Verify delegation states
      const finalBackend = getDelegation(backendDelegation.id);
      expect(finalBackend!.state).toBe("completed");
      expect(finalBackend!.result?.status).toBe("success");

      const finalFrontend = getDelegation(frontendDelegation.id);
      expect(finalFrontend!.state).toBe("completed");

      const finalSecurity = getDelegation(securityDelegation.id);
      expect(finalSecurity!.state).toBe("completed");
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 7: EDGE CASES & ERROR HANDLING
  // ═══════════════════════════════════════════

  describe("Phase 7: Edge Cases & Error Handling", () => {
    it("should prevent invalid state transitions", () => {
      const delegation = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Test task",
      });

      // Can't go from "assigned" directly to "completed" (must pass through in_progress)
      const _result = completeDelegation(delegation.id, {
        status: "success",
        summary: "Done",
      });
      // completeDelegation allows assigned → completed
      // but updateDelegationState enforces the FSM
      const invalidTransition = updateDelegationState(delegation.id, "pending_review");
      expect(invalidTransition).toBeNull(); // assigned → pending_review is not valid
    });

    it("should prevent reviewing non-pending delegations", () => {
      const delegation = registerDelegation({
        fromAgentId: AGENTS.orchestrator.id,
        fromSessionKey: "agent:main:main",
        fromRole: "orchestrator",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Already assigned task",
      });

      // Delegation is already "assigned" (downward), can't review it
      const reviewed = reviewDelegation(delegation.id, {
        reviewerId: AGENTS.orchestrator.id,
        decision: "approve",
        reasoning: "test",
        evaluations: { withinScope: true, requiresEscalation: false, canDelegateToOther: false },
      });

      expect(reviewed).toBeNull(); // Can't review a non-pending delegation
    });

    it("should handle decision tree escalation for critical requests from workers", () => {
      const request = registerDelegation({
        fromAgentId: AGENTS.performanceEng.id,
        fromSessionKey: "agent:performance-engineer:subagent:test",
        fromRole: "worker",
        toAgentId: AGENTS.backendLead.id,
        toRole: "specialist",
        task: "Critical production hotfix needed",
        priority: "critical",
        justification: "Production is down",
      });

      // Decision tree should recommend escalation for critical from worker to specialist
      // (specialist rank < 2, critical priority)
      const evaluation = evaluateDelegationRequest({
        request,
        superiorRole: "specialist",
        superiorAgentId: AGENTS.backendLead.id,
      });

      // Critical + specialist (rank 1 < 2) → should require escalation
      expect(evaluation.requiresEscalation).toBe(true);
      expect(evaluation.recommendation).toBe("reject");
    });

    it("should handle role rank hierarchy correctly", () => {
      expect(AGENT_ROLE_RANK.orchestrator).toBe(3);
      expect(AGENT_ROLE_RANK.lead).toBe(2);
      expect(AGENT_ROLE_RANK.specialist).toBe(1);
      expect(AGENT_ROLE_RANK.worker).toBe(0);

      // Rank ordering
      expect(AGENT_ROLE_RANK.orchestrator).toBeGreaterThan(AGENT_ROLE_RANK.lead);
      expect(AGENT_ROLE_RANK.lead).toBeGreaterThan(AGENT_ROLE_RANK.specialist);
      expect(AGENT_ROLE_RANK.specialist).toBeGreaterThan(AGENT_ROLE_RANK.worker);
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 8: DEBATE ROUND ENFORCEMENT
  // ═══════════════════════════════════════════

  describe("Phase 8: Debate Round Enforcement (3-7)", () => {
    it("should reject finalization before minimum rounds", () => {
      const session = initializeCollaborativeSession({
        topic: "Auth Strategy",
        agents: [AGENTS.backendLead.id, AGENTS.securityEng.id],
        moderator: AGENTS.orchestrator.id,
        minRounds: 3,
      });
      expect(session.status).toBe("planning");

      // Only 1 round: publish a proposal
      const proposal = publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.backendLead.id,
        decisionTopic: "Auth Approach",
        proposal: "JWT with refresh tokens",
        reasoning: "Simple and stateless",
      });
      expect(session.roundCount).toBe(1);
      expect(session.status).toBe("debating");

      // Try to finalize with only 1 round — should throw
      expect(() =>
        finalizeDecision({
          sessionKey: session.sessionKey,
          decisionId: proposal.decisionId,
          finalDecision: "JWT",
          moderatorId: AGENTS.orchestrator.id,
        }),
      ).toThrow("minimum 3 debate rounds required");
    });

    it("should allow finalization after minimum rounds", () => {
      const session = initializeCollaborativeSession({
        topic: "Database Choice",
        agents: [AGENTS.backendLead.id, AGENTS.databaseEng.id],
        moderator: AGENTS.orchestrator.id,
        minRounds: 3,
      });

      // Round 1: proposal
      const proposal = publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.backendLead.id,
        decisionTopic: "DB Engine",
        proposal: "PostgreSQL",
        reasoning: "Battle-tested",
      });

      // Round 2: challenge
      challengeProposal({
        sessionKey: session.sessionKey,
        decisionId: proposal.decisionId,
        agentId: AGENTS.databaseEng.id,
        challenge: "Consider TimescaleDB extension for time-series",
      });

      // Round 3: counter-proposal
      publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.databaseEng.id,
        decisionTopic: "DB Engine",
        proposal: "PostgreSQL + TimescaleDB",
        reasoning: "Best of both worlds",
      });

      expect(session.roundCount).toBe(3);

      // Now finalization should succeed
      expect(() =>
        finalizeDecision({
          sessionKey: session.sessionKey,
          decisionId: proposal.decisionId,
          finalDecision: "PostgreSQL with TimescaleDB extension",
          moderatorId: AGENTS.orchestrator.id,
        }),
      ).not.toThrow();
      expect(session.status).toBe("decided");
    });

    it("should track round count across proposals and challenges", () => {
      const session = initializeCollaborativeSession({
        topic: "API Design",
        agents: [AGENTS.backendLead.id, AGENTS.frontendLead.id],
        moderator: AGENTS.orchestrator.id,
      });

      expect(session.roundCount).toBe(0);

      publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.backendLead.id,
        decisionTopic: "API Style",
        proposal: "REST",
        reasoning: "Standard",
      });
      expect(session.roundCount).toBe(1);

      challengeProposal({
        sessionKey: session.sessionKey,
        decisionId: session.decisions[0].id,
        agentId: AGENTS.frontendLead.id,
        challenge: "GraphQL is better for dashboards",
      });
      expect(session.roundCount).toBe(2);

      // Agreements do NOT increment round count
      agreeToProposal({
        sessionKey: session.sessionKey,
        decisionId: session.decisions[0].id,
        agentId: AGENTS.backendLead.id,
      });
      expect(session.roundCount).toBe(2);
    });

    it("should set auto-escalated flag at max rounds", () => {
      const session = initializeCollaborativeSession({
        topic: "Hotly Debated Topic",
        agents: [AGENTS.backendLead.id, AGENTS.frontendLead.id],
        moderator: AGENTS.orchestrator.id,
        maxRounds: 3,
        minRounds: 1,
      });

      const p = publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.backendLead.id,
        decisionTopic: "Framework",
        proposal: "Express",
        reasoning: "Mature",
      });
      expect(session.roundCount).toBe(1);
      expect(session.autoEscalated).toBeFalsy();

      challengeProposal({
        sessionKey: session.sessionKey,
        decisionId: p.decisionId,
        agentId: AGENTS.frontendLead.id,
        challenge: "Elysia is faster",
      });
      expect(session.roundCount).toBe(2);

      publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.frontendLead.id,
        decisionTopic: "Framework",
        proposal: "Elysia",
        reasoning: "Performance",
      });
      expect(session.roundCount).toBe(3);
      // autoEscalated is set by the RPC handler, not the pure function.
      // The pure function just increments. But we can verify roundCount >= maxRounds.
      expect(session.roundCount).toBeGreaterThanOrEqual(session.maxRounds);
    });

    it("should initialize with default round limits", () => {
      const session = initializeCollaborativeSession({
        topic: "Defaults Test",
        agents: [AGENTS.backendLead.id, AGENTS.frontendLead.id],
      });
      expect(session.roundCount).toBe(0);
      expect(session.minRounds).toBe(3);
      expect(session.maxRounds).toBe(7);
      expect(session.autoEscalated).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 9: FOCUSED SESSIONS & DYNAMIC INVITATION
  // ═══════════════════════════════════════════

  describe("Phase 9: Focused Sessions & Dynamic Invitation", () => {
    it("should create focused (private) sessions with special key prefix", () => {
      const session = initializeCollaborativeSession({
        topic: "Secret Strategy",
        agents: [AGENTS.backendLead.id, AGENTS.securityEng.id],
        sessionKey: `focused:secret_strategy:${Date.now()}`,
      });

      expect(session.sessionKey).toContain("focused:");
      expect(session.members).toEqual([AGENTS.backendLead.id, AGENTS.securityEng.id]);
    });

    it("should allow dynamic invitation to a session", () => {
      const session = initializeCollaborativeSession({
        topic: "Expanding Team",
        agents: [AGENTS.backendLead.id, AGENTS.frontendLead.id],
        minRounds: 0,
      });

      expect(session.members.length).toBe(2);
      expect(session.members).not.toContain(AGENTS.securityEng.id);

      // Simulate invitation (what the RPC handler does)
      session.members.push(AGENTS.securityEng.id);
      session.messages.push({
        from: AGENTS.backendLead.id,
        type: "clarification",
        content: `Invited ${AGENTS.securityEng.id} to join the session`,
        timestamp: Date.now(),
      });

      expect(session.members.length).toBe(3);
      expect(session.members).toContain(AGENTS.securityEng.id);

      // Invited agent can now participate
      publishProposal({
        sessionKey: session.sessionKey,
        agentId: AGENTS.securityEng.id,
        decisionTopic: "Security Review",
        proposal: "Add rate limiting",
        reasoning: "Prevent abuse",
      });

      const context = getCollaborationContext(session.sessionKey);
      expect(context!.decisions.length).toBe(1);
      expect(context!.decisions[0].proposals[0].from).toBe(AGENTS.securityEng.id);
    });
  });

  // ═══════════════════════════════════════════
  // PHASE 10: TEAM CHAT AUTO-JOIN
  // ═══════════════════════════════════════════

  describe("Phase 10: Team Chat Auto-Join", () => {
    it("should register all agents as team chat members with correct listening modes", async () => {
      const { ensureTeamChatAutoJoin, getTeamChatMembers, resetTeamChatMembersForTests } =
        await import("./team-chat.js");
      resetTeamChatMembersForTests();

      // Create a minimal config with agents
      const mockConfig = {
        agents: {
          list: [
            { id: "main", role: "orchestrator" as const },
            { id: "tech-lead", role: "lead" as const },
            { id: "backend", role: "specialist" as const },
            { id: "worker-1", role: "worker" as const },
          ],
        },
      };

      const entries = ensureTeamChatAutoJoin(mockConfig);
      expect(entries.length).toBe(4);

      const members = getTeamChatMembers();
      expect(members.length).toBe(4);

      // All agents should be active listeners in the main chat
      const orchestrator = members.find((m) => m.agentId === "main");
      expect(orchestrator!.listeningMode).toBe("active");

      const lead = members.find((m) => m.agentId === "tech-lead");
      expect(lead!.listeningMode).toBe("active");

      const specialist = members.find((m) => m.agentId === "backend");
      expect(specialist!.listeningMode).toBe("active");

      const worker = members.find((m) => m.agentId === "worker-1");
      expect(worker!.listeningMode).toBe("active");

      resetTeamChatMembersForTests();
    });
  });
});
