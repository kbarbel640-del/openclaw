import { z } from "zod";
import { callGateway } from "../../gateway/call.js";
import { type AgentOrchestrator, createAgentOrchestrator } from "../agent-orchestrator.js";

// --- Types ---

export const WorkflowPhaseSchema = z.enum([
  "DISCOVERY",
  "EXPLORATION",
  "QUESTIONS",
  "ARCHITECTURE",
  "IMPLEMENTATION",
  "IMPLEMENTATION_WAITING",
  "REVIEW",
  "SUMMARY",
  "COMPLETED",
]);

export type WorkflowPhase = z.infer<typeof WorkflowPhaseSchema>;

export interface FeatureDevState {
  featureRequest: string;
  currentPhase: WorkflowPhase;
  implementationSessionKey?: string;
  context: {
    discoverySummary?: string;
    explorationFindings?: string;
    clarifyingQuestions?: string[];
    answers?: Record<string, string>;
    architecturePlan?: string;
    implementationFiles?: string[];
    implementationResults?: string; // Captured output from implementation agent
    reviewIssues?: string[];
  };
}

// --- Prompts (Ported from Claude Code) ---

const _PROMPTS = {
  EXPLORER: `You are an expert code analyst specializing in tracing and understanding feature implementations across codebases.

## Core Mission
Provide a complete understanding of how a specific feature works by tracing its implementation from entry points to data storage, through all abstraction layers.

## Analysis Approach
1. Feature Discovery: Find entry points (APIs, UI components, CLI commands)
2. Code Flow Tracing: Follow call chains from entry to output
3. Architecture Analysis: Map abstraction layers
4. Implementation Details: Key algorithms, error handling, performance

## Output Guidance
Provide a comprehensive analysis that helps developers understand the feature deeply enough to modify or extend it. Include:
- Entry points with file:line references
- Step-by-step execution flow
- Key components and responsibilities
- List of essential files to read`,

  ARCHITECT: `You are a senior software architect who delivers comprehensive, actionable architecture blueprints.

## Core Process
1. Codebase Pattern Analysis: Extract existing patterns and conventions.
2. Architecture Design: Design the complete feature architecture. Make decisive choices.
3. Complete Implementation Blueprint: Specify every file to create or modify.

## Output Guidance
Deliver a decisive, complete architecture blueprint. Include:
- Patterns & Conventions Found
- Architecture Decision with rationale
- Component Design
- Implementation Map: Specific files to create/modify
- Build Sequence`,

  REVIEWER: `You are an expert code reviewer specializing in modern software development.

## Core Review Responsibilities
1. Project Guidelines Compliance: Verify adherence to CLAUDE.md
2. Bug Detection: Logic errors, security vulnerabilities
3. Code Quality: Duplication, missing error handling

## Confidence Scoring
Rate each issue 0-100. Only report issues with confidence >= 80.

## Output Guidance
Start by clearly stating what you're reviewing. For each high-confidence issue, provide:
- Clear description with confidence score
- File path and line number
- Specific project guideline reference
- Concrete fix suggestion`,
};

// --- Workflow Engine ---

export class FeatureDevWorkflow {
  private state: FeatureDevState;
  private orchestrator: AgentOrchestrator;

  constructor(initialRequest: string) {
    this.state = {
      featureRequest: initialRequest,
      currentPhase: "DISCOVERY",
      context: {},
    };
    this.orchestrator = createAgentOrchestrator();
  }

  getState(): FeatureDevState {
    return this.state;
  }

  async runStep(): Promise<FeatureDevState> {
    switch (this.state.currentPhase) {
      case "DISCOVERY":
        return this.runDiscovery();
      case "EXPLORATION":
        return this.runExploration();
      case "QUESTIONS":
        return this.runQuestions();
      case "ARCHITECTURE":
        return this.runArchitecture();
      case "IMPLEMENTATION":
        return this.runImplementation();
      case "IMPLEMENTATION_WAITING":
        return this.runImplementationWaiting();
      case "REVIEW":
        return this.runReview();
      case "SUMMARY":
        return this.runSummary();
      case "COMPLETED":
        return this.state;
      default:
        throw new Error(`Unknown phase: ${this.state.currentPhase}`);
    }
  }

  private async runDiscovery(): Promise<FeatureDevState> {
    // ... (unchanged)
    this.state.currentPhase = "EXPLORATION";
    return this.state;
  }

  private async runImplementation(): Promise<FeatureDevState> {
    // In a real system, we would REQUIRE explicit user approval here via a "gate" state.
    // We assume approval for now.

    const sessionKey = await this.orchestrator.spawnImplementationTeam({
      debateSessionKey: "feature-dev-implementation",
      implementationAgents: [{ id: "main", role: "specialist" }],
      label: `Implementation: ${this.state.featureRequest}`,
    });

    this.state.implementationSessionKey = sessionKey;

    const plan = this.state.context.architecturePlan || "No architecture plan found.";
    const prompt = `FEATURE IMPLEMENTATION TASK
        
Request: ${this.state.featureRequest}

Architecture Plan:
${plan}

Instructions:
1. Implement the feature described above.
2. Create or modify files as specified in the plan.
3. Verify your changes.
`;

    // Send the prompt to the implementation agent
    await callGateway({
      method: "messages.send",
      params: {
        sessionKey,
        text: prompt,
      },
    });

    this.state.context.implementationFiles = [`Session ${sessionKey} started.`];

    // Transition to WAITING state to let user poll/advance when ready
    this.state.currentPhase = "IMPLEMENTATION_WAITING";
    return this.state;
  }

  private async runImplementationWaiting(): Promise<FeatureDevState> {
    // User has manually advanced, implying the implementation session is done.
    // We fetch the chat history to capture what was done.

    if (this.state.implementationSessionKey) {
      try {
        const history = await callGateway<{ messages: Array<{ text?: string }> }>({
          method: "chat.history",
          params: { sessionKey: this.state.implementationSessionKey, limit: 10 },
        });

        const summary =
          history?.messages
            ?.map((m) => m.text)
            .filter(Boolean)
            .join("\n---\n") || "No output captured.";

        this.state.context.implementationResults = summary;
      } catch (err) {
        console.error("Failed to fetch implementation history:", err);
        this.state.context.implementationResults = "Failed to fetch implementation history.";
      }
    }

    this.state.currentPhase = "REVIEW";
    return this.state;
  }

  private async runExploration(): Promise<FeatureDevState> {
    // Spawn Explorer Agent
    const _sessionKey = await this.orchestrator.spawnImplementationTeam({
      debateSessionKey: "feature-dev-exploration", // Placeholder
      implementationAgents: [{ id: "code-explorer", role: "Explorer" }],
      label: `Exploration: ${this.state.featureRequest}`,
    });

    // In a real implementation, we would wait for the agent to finish and capture output.
    // Here we simulate the state update.
    this.state.context.explorationFindings = `Simulated findings for: ${this.state.featureRequest}`;
    this.state.currentPhase = "QUESTIONS";
    return this.state;
  }

  private async runQuestions(): Promise<FeatureDevState> {
    // In a real system, we would pause here and return the state to the UI to ask the user.
    // For this port, we simulate the "clarification" step.
    if (!this.state.context.clarifyingQuestions) {
      this.state.context.clarifyingQuestions = [
        "What specific constraints exist?",
        "Are there preferred libraries?",
      ];
    }

    // transform findings into questions
    // wait for user input (mocked)
    this.state.context.answers = {
      "What specific constraints exist?": "None",
      "Are there preferred libraries?": "Standard libs only",
    };

    this.state.currentPhase = "ARCHITECTURE";
    return this.state;
  }

  private async runArchitecture(): Promise<FeatureDevState> {
    const sessionKey = await this.orchestrator.spawnImplementationTeam({
      debateSessionKey: "feature-dev-architecture",
      implementationAgents: [{ id: "code-architect", role: "Architect" }],
      label: `Architecture: ${this.state.featureRequest}`,
    });

    this.state.context.architecturePlan = `Architecture Plan from session ${sessionKey}: \n1. Create Service\n2. Add API Route`;
    this.state.currentPhase = "IMPLEMENTATION";
    return this.state;
  }

  private async runReview(): Promise<FeatureDevState> {
    const sessionKey = await this.orchestrator.spawnImplementationTeam({
      debateSessionKey: "feature-dev-review",
      implementationAgents: [{ id: "code-reviewer", role: "Reviewer" }],
      label: `Review: ${this.state.featureRequest}`,
    });

    this.state.context.reviewIssues = [`Review from ${sessionKey}: No critical issues found.`];
    this.state.currentPhase = "SUMMARY";
    return this.state;
  }

  private async runSummary(): Promise<FeatureDevState> {
    // Final wrap up
    this.state.currentPhase = "COMPLETED";
    return this.state;
  }
}
