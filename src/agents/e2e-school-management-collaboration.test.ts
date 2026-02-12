import { beforeEach, describe, expect, it } from "vitest";
import {
  agreeToProposal,
  challengeProposal,
  createPoll,
  finalizeDecision,
  generateStandup,
  getCollaborationContext,
  getDecisionThread,
  initializeCollaborativeSession,
  publishProposal,
  submitReview,
} from "../gateway/server-methods/collaboration.js";
import { canDelegate, canSpawnRole } from "./agent-scope.js";
import {
  findAgentsByCapability,
  findBestAgentForTask,
  registerAgentCapabilities,
  resetCapabilitiesRegistryForTests,
} from "./capabilities-registry.js";
import {
  completeDelegation,
  getAgentDelegationMetrics,
  listPendingReviewsForAgent,
  registerDelegation,
  resetDelegationRegistryForTests,
  reviewDelegation,
  updateDelegationState,
} from "./delegation-registry.js";
import {
  buildTeamContextSummary,
  listTeamArtifacts,
  listTeamDecisions,
  readTeamArtifact,
  readTeamContext,
  recordTeamDecision,
  writeTeamArtifact,
  writeTeamContext,
} from "./team-workspace.js";

describe("E2E: School Management System Multi-Agent Collaboration", () => {
  const AGENTS = {
    orchestrator: { id: "main", role: "orchestrator" as const },
    backend: { id: "backend-architect", role: "specialist" as const },
    frontend: { id: "frontend-architect", role: "specialist" as const },
    db: { id: "database-engineer", role: "specialist" as const },
    security: { id: "security-engineer", role: "specialist" as const },
    qa: { id: "qa-lead", role: "specialist" as const },
    product: { id: "product-manager", role: "specialist" as const },
    perfWorker: { id: "performance-engineer", role: "worker" as const },
  };

  const sessionKey = "agent:main:main";

  beforeEach(() => {
    resetDelegationRegistryForTests();
    resetCapabilitiesRegistryForTests();
  });

  it("should run end-to-end planning flow from intake to delivery plan", async () => {
    // 1) Intake + capability map
    registerAgentCapabilities(AGENTS.backend.id, {
      name: "Carlos",
      role: AGENTS.backend.role,
      capabilities: ["api-design", "node", "typescript", "auth", "real-time"],
      expertise: ["School APIs", "service boundaries"],
      availability: "auto",
    });
    registerAgentCapabilities(AGENTS.frontend.id, {
      name: "Aninha",
      role: AGENTS.frontend.role,
      capabilities: ["react", "ui", "dashboard", "forms", "accessibility"],
      expertise: ["Admin portals", "student/teacher UX"],
      availability: "auto",
    });
    registerAgentCapabilities(AGENTS.db.id, {
      name: "Fernanda",
      role: AGENTS.db.role,
      capabilities: ["database", "postgresql", "schema", "migrations", "reporting"],
      expertise: ["academic records", "attendance data"],
      availability: "auto",
    });
    registerAgentCapabilities(AGENTS.security.id, {
      name: "Mariana",
      role: AGENTS.security.role,
      capabilities: ["security", "auth", "rbac", "compliance", "audit-log"],
      expertise: ["LGPD", "school data privacy"],
      availability: "auto",
    });
    registerAgentCapabilities(AGENTS.qa.id, {
      name: "Isabela",
      role: AGENTS.qa.role,
      capabilities: ["testing", "integration-tests", "e2e", "quality-gates"],
      expertise: ["acceptance criteria", "regression"],
      availability: "auto",
    });

    const bestApi = findBestAgentForTask(
      "Implement node typescript backend API for enrollments and grades",
    );
    expect(bestApi).not.toBeNull();

    const dbAgents = findAgentsByCapability("database");
    expect(dbAgents.some((a) => a.agentId === AGENTS.db.id)).toBe(true);

    const secAgents = findAgentsByCapability("security");
    expect(secAgents.some((a) => a.agentId === AGENTS.security.id)).toBe(true);

    // 2) Brainstorm + debate
    const collab = initializeCollaborativeSession({
      topic: "School Management System v1 Planning",
      agents: [
        AGENTS.backend.id,
        AGENTS.frontend.id,
        AGENTS.db.id,
        AGENTS.security.id,
        AGENTS.qa.id,
        AGENTS.product.id,
      ],
      moderator: AGENTS.orchestrator.id,
      minRounds: 0,
    });

    const architecture = publishProposal({
      sessionKey: collab.sessionKey,
      agentId: AGENTS.backend.id,
      decisionTopic: "System Architecture",
      proposal:
        "Modular monolith with bounded modules: Students, Teachers, Classes, Enrollments, Attendance, Billing",
      reasoning: "Fast delivery with clean boundaries for later extraction",
    });

    challengeProposal({
      sessionKey: collab.sessionKey,
      decisionId: architecture.decisionId,
      agentId: AGENTS.frontend.id,
      challenge:
        "Need BFF endpoints to optimize dashboard payloads for principal and teacher views.",
      suggestedAlternative: "Add BFF layer inside monolith for role-specific read models",
    });

    agreeToProposal({
      sessionKey: collab.sessionKey,
      decisionId: architecture.decisionId,
      agentId: AGENTS.db.id,
    });

    finalizeDecision({
      sessionKey: collab.sessionKey,
      decisionId: architecture.decisionId,
      finalDecision:
        "Adopt modular monolith + internal BFF endpoints. Modules: Students, Teachers, Classes, Enrollments, Attendance, Grades, Billing, Notifications.",
      moderatorId: AGENTS.orchestrator.id,
    });

    const authz = publishProposal({
      sessionKey: collab.sessionKey,
      agentId: AGENTS.security.id,
      decisionTopic: "Authorization Model",
      proposal: "RBAC with roles: admin, principal, teacher, guardian, student; full audit logs",
      reasoning: "Different school actors need strict data boundaries",
    });

    challengeProposal({
      sessionKey: collab.sessionKey,
      decisionId: authz.decisionId,
      agentId: AGENTS.product.id,
      challenge: "Guardians with multiple children need aggregated cross-student view.",
      suggestedAlternative: "RBAC + relationship scope (guardian->students)",
    });

    finalizeDecision({
      sessionKey: collab.sessionKey,
      decisionId: authz.decisionId,
      finalDecision:
        "RBAC + relationship-based scoping (guardian-student links) + immutable audit logs.",
      moderatorId: AGENTS.orchestrator.id,
    });

    const thread = getDecisionThread({
      sessionKey: collab.sessionKey,
      decisionId: architecture.decisionId,
    });
    expect(thread.length).toBeGreaterThanOrEqual(3);

    const context = getCollaborationContext(collab.sessionKey);
    expect(context?.decisions.length).toBe(2);

    // 3) Poll + review + standup capabilities
    const poll = await createPoll({
      initiatorId: AGENTS.orchestrator.id,
      question: "Prioridade da primeira release?",
      options: ["Matrículas + Turmas", "Presença + Notas", "Financeiro + Comunicação"],
      voters: [], // no wait in test environment
      timeoutSeconds: 1,
    });
    expect(poll.id.startsWith("poll:")).toBe(true);

    const review = submitReview({
      submitterId: AGENTS.backend.id,
      artifact: "school-domain-model.md",
      reviewers: [AGENTS.db.id, AGENTS.security.id, AGENTS.qa.id],
      context: "Validate data integrity, privacy and testability",
    });
    expect(review.id.startsWith("review:")).toBe(true);

    const standup = generateStandup();
    expect(Array.isArray(standup.agents)).toBe(true);

    // 4) Hierarchy + permissions + delegation flows
    expect(canSpawnRole("orchestrator", "specialist")).toBe(true);
    expect(canSpawnRole("specialist", "orchestrator")).toBe(false);
    expect(canDelegate("worker", "specialist")).toBe("upward");

    const dBackend = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.backend.id,
      toRole: "specialist",
      task: "Define APIs for students/classes/enrollments/attendance/grades",
      priority: "high",
    });
    const dFrontend = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.frontend.id,
      toRole: "specialist",
      task: "Design admin + teacher + guardian dashboards with accessibility",
      priority: "high",
    });
    const dSecurity = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.security.id,
      toRole: "specialist",
      task: "Threat model + RBAC policy matrix + audit logging requirements",
      priority: "high",
    });

    expect(dBackend.state).toBe("assigned");
    expect(dFrontend.state).toBe("assigned");
    expect(dSecurity.state).toBe("assigned");

    const upward = registerDelegation({
      fromAgentId: AGENTS.perfWorker.id,
      fromSessionKey: "agent:performance-engineer:subagent:school-test",
      fromRole: "worker",
      toAgentId: AGENTS.backend.id,
      toRole: "specialist",
      task: "Need guidance for attendance import performance (50k rows CSV)",
      justification: "Batch import spikes memory and blocks event loop",
      priority: "normal",
    });
    expect(upward.state).toBe("pending_review");

    const pending = listPendingReviewsForAgent(AGENTS.backend.id);
    expect(pending.some((p) => p.id === upward.id)).toBe(true);

    const approved = reviewDelegation(upward.id, {
      reviewerId: AGENTS.backend.id,
      decision: "approve",
      reasoning: "Valid scalability concern for school onboarding periods",
      evaluations: { withinScope: true, canDelegateToOther: false, requiresEscalation: false },
    });
    expect(approved?.state).toBe("assigned");

    // 5) Workspace: artifacts, context, decisions
    await writeTeamArtifact({
      requesterSessionKey: sessionKey,
      name: "school-prd.md",
      content:
        "Modules: Students, Teachers, Classes, Enrollments, Attendance, Grades, Billing, Communication",
      metadata: {
        description: "PRD for School Management v1",
        tags: ["product", "school", "planning"],
      },
    });

    await writeTeamArtifact({
      requesterSessionKey: sessionKey,
      name: "rbac-matrix.md",
      content: "admin:* principal:school teacher:class guardian:children student:self",
      metadata: { description: "Authorization matrix", tags: ["security", "rbac"] },
    });

    await writeTeamContext({
      requesterSessionKey: sessionKey,
      key: "nfrs",
      value: "P95 API < 300ms, 99.9% uptime, LGPD-ready",
    });
    await writeTeamContext({
      requesterSessionKey: sessionKey,
      key: "release_scope",
      value: "Matrículas, Turmas, Presença, Notas",
    });

    await recordTeamDecision({
      requesterSessionKey: sessionKey,
      topic: "School v1 MVP scope",
      decision: "Deliver Enrollment+Class+Attendance+Grades first; Billing in phase 2",
      participants: [AGENTS.product.id, AGENTS.backend.id, AGENTS.frontend.id],
    });

    const prd = await readTeamArtifact({ requesterSessionKey: sessionKey, name: "school-prd.md" });
    expect(prd).toContain("Students");

    const nfrs = await readTeamContext({ requesterSessionKey: sessionKey, key: "nfrs" });
    expect(nfrs).toContain("LGPD-ready");

    const artifacts = await listTeamArtifacts({ requesterSessionKey: sessionKey });
    expect(artifacts.length).toBeGreaterThanOrEqual(2);

    const decisions = await listTeamDecisions({ requesterSessionKey: sessionKey });
    expect(decisions.length).toBeGreaterThanOrEqual(1);

    const summary = await buildTeamContextSummary({ requesterSessionKey: sessionKey });
    expect(summary.length).toBeGreaterThan(0);

    // 6) Completion + delivery plan
    updateDelegationState(dBackend.id, "in_progress");
    updateDelegationState(dFrontend.id, "in_progress");
    updateDelegationState(dSecurity.id, "in_progress");

    completeDelegation(dBackend.id, {
      status: "success",
      summary:
        "API plan ready: endpoints for students, teachers, classes, enrollment, attendance, grades; import/export and audit hooks included.",
    });
    completeDelegation(dFrontend.id, {
      status: "success",
      summary: "UX plan ready with role-based portals and accessible forms/tables/charts.",
    });
    completeDelegation(dSecurity.id, {
      status: "success",
      summary: "RBAC matrix, threat model, audit requirements and privacy controls documented.",
    });

    const metrics = getAgentDelegationMetrics(AGENTS.orchestrator.id);
    expect(metrics.sent).toBeGreaterThanOrEqual(3);
    expect(metrics.completed).toBeGreaterThanOrEqual(3);
  });

  it("should handle conflict, rejection, replan and quality gates before final planning approval", async () => {
    const collab = initializeCollaborativeSession({
      topic: "School Management System v1 - Conflict Resolution",
      agents: [
        AGENTS.backend.id,
        AGENTS.frontend.id,
        AGENTS.db.id,
        AGENTS.security.id,
        AGENTS.qa.id,
        AGENTS.product.id,
      ],
      moderator: AGENTS.orchestrator.id,
      minRounds: 0,
    });

    // Conflict: frontend proposes SPA-only; backend challenges with SEO/access constraints for public pages
    const uiDecision = publishProposal({
      sessionKey: collab.sessionKey,
      agentId: AGENTS.frontend.id,
      decisionTopic: "UI Delivery Strategy",
      proposal: "Single SPA for all school actors",
      reasoning: "Faster front-end iteration",
    });

    challengeProposal({
      sessionKey: collab.sessionKey,
      decisionId: uiDecision.decisionId,
      agentId: AGENTS.backend.id,
      challenge:
        "Public-facing pages (calendar/news) need SSR for SEO and faster first load on low-end devices.",
      suggestedAlternative: "Hybrid: SSR for public pages + SPA for authenticated portals",
    });

    agreeToProposal({
      sessionKey: collab.sessionKey,
      decisionId: uiDecision.decisionId,
      agentId: AGENTS.product.id,
    });

    finalizeDecision({
      sessionKey: collab.sessionKey,
      decisionId: uiDecision.decisionId,
      finalDecision:
        "Hybrid delivery: SSR for public pages, SPA for authenticated admin/teacher/guardian/student portals.",
      moderatorId: AGENTS.orchestrator.id,
    });

    const thread = getDecisionThread({
      sessionKey: collab.sessionKey,
      decisionId: uiDecision.decisionId,
    });
    expect(thread.length).toBeGreaterThanOrEqual(3);

    // Upward request out of scope should be rejected
    const outOfScope = registerDelegation({
      fromAgentId: AGENTS.perfWorker.id,
      fromSessionKey: "agent:performance-engineer:subagent:school-replan",
      fromRole: "worker",
      toAgentId: AGENTS.security.id,
      toRole: "specialist",
      task: "Please deploy K8s cluster for load tests",
      justification: "Need infra urgently",
      priority: "normal",
    });

    expect(outOfScope.state).toBe("pending_review");

    const rejected = reviewDelegation(outOfScope.id, {
      reviewerId: AGENTS.security.id,
      decision: "reject",
      reasoning: "Infra provisioning is DevOps scope, not security.",
      evaluations: {
        withinScope: false,
        canDelegateToOther: true,
        requiresEscalation: false,
        suggestedAlternative: "devops-engineer",
      },
    });

    expect(rejected?.state).toBe("rejected");

    // Failure then replan: backend plan fails due to missing migration strategy
    const backendPlan = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.backend.id,
      toRole: "specialist",
      task: "Produce API implementation plan for school modules",
      priority: "high",
    });

    updateDelegationState(backendPlan.id, "in_progress");
    const failed = completeDelegation(backendPlan.id, {
      status: "failure",
      summary: "Plan incomplete: migration strategy and rollback steps were missing.",
    });
    expect(failed?.state).toBe("failed");
    expect(failed?.result?.status).toBe("failure");

    const replan = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.db.id,
      toRole: "specialist",
      task: "Create migration + rollback strategy for SIS schema evolution",
      priority: "high",
    });

    updateDelegationState(replan.id, "in_progress");
    const fixed = completeDelegation(replan.id, {
      status: "success",
      summary:
        "Versioned migration plan with pre-checks, rollback scripts and data backfill strategy ready.",
    });
    expect(fixed?.result?.status).toBe("success");

    // Quality gates as explicit artifacts/contexts
    await writeTeamArtifact({
      requesterSessionKey: sessionKey,
      name: "quality-gates-school-v1.md",
      content:
        "- zero type errors\n- lint clean\n- integration tests for enrollment/attendance/grades\n- security checklist for RBAC/LGPD\n- rollback plan approved",
      metadata: { description: "Release quality gates", tags: ["qa", "release", "gates"] },
    });

    await writeTeamContext({
      requesterSessionKey: sessionKey,
      key: "quality_gate_status",
      value: "passed",
    });
    await writeTeamContext({ requesterSessionKey: sessionKey, key: "risk_level", value: "medium" });

    const gateStatus = await readTeamContext({
      requesterSessionKey: sessionKey,
      key: "quality_gate_status",
    });
    expect(gateStatus).toBe("passed");

    await recordTeamDecision({
      requesterSessionKey: sessionKey,
      topic: "Planning Approval",
      decision: "Approved with hybrid UI strategy, migration rollback plan and QA gates passed.",
      participants: [
        AGENTS.orchestrator.id,
        AGENTS.qa.id,
        AGENTS.backend.id,
        AGENTS.db.id,
        AGENTS.security.id,
      ],
    });

    const artifacts = await listTeamArtifacts({ requesterSessionKey: sessionKey });
    expect(artifacts.some((a) => a.name === "quality-gates-school-v1.md")).toBe(true);

    const decisions = await listTeamDecisions({ requesterSessionKey: sessionKey });
    expect(decisions.some((d) => d.topic === "Planning Approval")).toBe(true);

    const summary = await buildTeamContextSummary({ requesterSessionKey: sessionKey });
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain("quality-gates-school-v1.md");

    const metrics = getAgentDelegationMetrics(AGENTS.orchestrator.id);
    expect(metrics.sent).toBeGreaterThanOrEqual(2);
  });

  it("should simulate cross-squad dependency, SLA breach/retry and compute release readiness score", async () => {
    // Cross-squad dependency: frontend cannot finalize planning before backend contract
    const backendContract = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.backend.id,
      toRole: "specialist",
      task: "Publish API contract for enrollments/attendance/grades with examples",
      priority: "high",
    });

    const frontendPlan = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.frontend.id,
      toRole: "specialist",
      task: "Produce UI flow plan based on backend contract",
      priority: "high",
    });

    updateDelegationState(frontendPlan.id, "in_progress");
    const blockedFrontend = completeDelegation(frontendPlan.id, {
      status: "partial",
      summary: "Partially done. Blocked waiting for backend API contract final fields.",
    });
    expect(blockedFrontend?.result?.status).toBe("partial");

    // SLA simulation: backend misses initial SLA and fails first attempt
    updateDelegationState(backendContract.id, "in_progress");
    const firstAttempt = completeDelegation(backendContract.id, {
      status: "failure",
      summary: "SLA breach: contract examples missing and pagination rules undefined.",
    });
    expect(firstAttempt?.state).toBe("failed");

    // Retry path (new delegation instance representing retry)
    const backendRetry = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.backend.id,
      toRole: "specialist",
      task: "Retry #1: finalize API contract with examples, pagination, validation and error codes",
      priority: "high",
    });

    updateDelegationState(backendRetry.id, "in_progress");
    const retrySuccess = completeDelegation(backendRetry.id, {
      status: "success",
      summary: "Contract finalized with OpenAPI examples, pagination/filtering and error taxonomy.",
    });
    expect(retrySuccess?.result?.status).toBe("success");

    // Unblock frontend after dependency is ready
    const frontendRetry = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.frontend.id,
      toRole: "specialist",
      task: "Retry #1: complete UI plan using finalized backend contract",
      priority: "high",
    });

    updateDelegationState(frontendRetry.id, "in_progress");
    const frontendDone = completeDelegation(frontendRetry.id, {
      status: "success",
      summary: "UI plan completed with stable payloads and error-state handling.",
    });
    expect(frontendDone?.result?.status).toBe("success");

    // QA quality gate
    const qaGate = registerDelegation({
      fromAgentId: AGENTS.orchestrator.id,
      fromSessionKey: sessionKey,
      fromRole: "orchestrator",
      toAgentId: AGENTS.qa.id,
      toRole: "specialist",
      task: "Validate acceptance criteria and test matrix for SIS v1 planning",
      priority: "normal",
    });

    updateDelegationState(qaGate.id, "in_progress");
    const qaDone = completeDelegation(qaGate.id, {
      status: "success",
      summary:
        "Acceptance criteria validated. Critical paths covered in integration and E2E test plan.",
    });
    expect(qaDone?.result?.status).toBe("success");

    // Persist planning telemetry in workspace
    await writeTeamContext({
      requesterSessionKey: sessionKey,
      key: "sla_backend_contract",
      value: "breached_once_then_recovered",
    });
    await writeTeamContext({
      requesterSessionKey: sessionKey,
      key: "dependency_frontend_backend",
      value: "resolved_after_retry",
    });
    await writeTeamContext({ requesterSessionKey: sessionKey, key: "qa_gate", value: "passed" });

    await writeTeamArtifact({
      requesterSessionKey: sessionKey,
      name: "release-readiness-inputs.md",
      content:
        "backend:first_attempt=failure,retry=success\nfrontend:first_attempt=partial,retry=success\nqa=success\nsecurity=assumed_pass_from_previous_flow",
      metadata: {
        description: "Inputs for readiness scoring",
        tags: ["release", "readiness", "sla"],
      },
    });

    // Compute a simple readiness score (test-side orchestration logic)
    const gateStatus = await readTeamContext({ requesterSessionKey: sessionKey, key: "qa_gate" });
    const dep = await readTeamContext({
      requesterSessionKey: sessionKey,
      key: "dependency_frontend_backend",
    });
    const sla = await readTeamContext({
      requesterSessionKey: sessionKey,
      key: "sla_backend_contract",
    });

    let readiness = 0;
    // 40% quality gates
    if (gateStatus === "passed") {
      readiness += 40;
    }
    // 30% dependency resolution
    if (dep === "resolved_after_retry") {
      readiness += 30;
    }
    // 30% SLA resilience (allow one breach if recovered)
    if (sla === "breached_once_then_recovered") {
      readiness += 20;
    }
    if (sla?.includes("recovered")) {
      readiness += 10;
    }

    expect(readiness).toBeGreaterThanOrEqual(90);

    await recordTeamDecision({
      requesterSessionKey: sessionKey,
      topic: "Release Readiness Score",
      decision: `School v1 planning readiness score = ${readiness}/100 (approved)`,
      participants: [AGENTS.orchestrator.id, AGENTS.backend.id, AGENTS.frontend.id, AGENTS.qa.id],
    });

    const decisions = await listTeamDecisions({ requesterSessionKey: sessionKey });
    expect(decisions.some((d) => d.topic === "Release Readiness Score")).toBe(true);

    const summary = await buildTeamContextSummary({ requesterSessionKey: sessionKey });
    expect(summary).toContain("release-readiness-inputs.md");
    expect(summary.length).toBeGreaterThan(0);
  });
});
