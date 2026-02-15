/**
 * DEMO: Collaboration System
 *
 * Demonstrates the full cycle of a collaborative session:
 * 1. Initialization
 * 2. Proposals
 * 3. Messaging
 * 4. Moderation intervention
 * 5. Finalization
 */

import type { GatewayClient } from "../src/gateway/server-methods/types.js";

function mockClient(agentId: string): GatewayClient {
  return {
    connect: {
      client: {
        id: agentId,
        version: "1.0.0",
        platform: "demo",
        mode: "agent",
      },
    },
  } as unknown as GatewayClient;
}

// Mock client to interact with the gateway
// In a real scenario, this would be an agent or a CLI tool
async function runDemo() {
  console.log("🚀 Starting Collaboration Demo...\n");

  // specific demo implementation details would depend on how we validly connect
  // to the running gateway in this test environment.
  // Since we are inside the monorepo, we can import server methods directly for a unit-test style demo
  // OR we can use the `openclaw-gateway-tool` if we want to test via RPC.

  // For this script, let's use direct imports to simulate the flow,
  // similar to how `collaboration.test.ts` works, but with the new features.

  // We need to dynamic import to avoid build issues in this script file
  const { initializeCollaborativeSession, collaborationHandlers } =
    await import("../src/gateway/server-methods/collaboration.js");

  const { loadMessages } = await import("../src/agents/collaboration-messaging.js");

  // 1. Initialize Session
  console.log("1️⃣  Initializing Session...");
  // Direct call (internal trusted)
  const session = initializeCollaborativeSession({
    topic: "Modernize Authentication System",
    agents: ["backend-architect", "frontend-lead", "security-officer"],
    moderator: "cto-bot",
  });
  console.log(`   Session created: ${session.sessionKey}`);

  // 2. Publish Proposal via RPC Handler (authenticated)
  console.log("\n2️⃣  Backend Architect publishing proposal...");
  const publishHandler = collaborationHandlers["collab.proposal.publish"];
  if (publishHandler) {
    await new Promise<void>((resolve, reject) => {
      try {
        void publishHandler({
          params: {
            sessionKey: session.sessionKey,
            agentId: "backend-architect",
            decisionTopic: "Auth Provider",
            proposal: "Use Clerk.dev for authentication",
            reasoning: "Offloads complexity, handles MFA/Social login out of the box.",
          },
          respond: (success: unknown, data: unknown, err: unknown) => {
            if (!success) {
              const error = err as { message?: string } | undefined;
              console.error(`   Proposal failed: ${String(error?.message)}`);
              reject(new Error(String(error?.message)));
            } else {
              console.log("   Proposal published.");
              resolve();
            }
          },
          context: {} as Record<string, unknown>,
          client: mockClient("backend-architect"),
          req: {} as Record<string, unknown>,
          isWebchatConnect: () => false,
        });
      } catch (e: unknown) {
        const error = e as { message: string };
        console.error(`   Proposal failed (sync): ${error.message}`);
        reject(error);
      }
    });
  }

  // 3. Send Direct Message (Persistent)
  console.log("\n3️⃣  Security Officer sending persistent message to Backend...");
  // We use the handler wrappers to test the RPC layer logic
  const sendHandler = collaborationHandlers["collab.messages.send"];
  if (sendHandler) {
    await new Promise<void>((resolve, reject) => {
      try {
        // Mocking the context/respond for the handler
        void sendHandler({
          params: {
            fromAgentId: "security-officer",
            toAgentId: "backend-architect",
            topic: "Security Concerns",
            message: "Hey, have we vetted Clerk's SOC2 compliance?",
          },
          respond: (success: unknown, data: unknown, err: unknown) => {
            if (!success) {
              const error = err as { message?: string } | undefined;
              console.error(`   Message send failed: ${String(error?.message)}`);
              reject(new Error(String(error?.message)));
            } else {
              const result = data as { messageId?: unknown };
              console.log(`   Message sent! ID: ${String(result.messageId)}`);
              resolve();
            }
          },
          context: {} as Record<string, unknown>,
          client: mockClient("security-officer"),
          req: {} as Record<string, unknown>,
          isWebchatConnect: () => false,
        });
      } catch (e: unknown) {
        const error = e as { message: string };
        console.error(`   Message send failed (sync): ${error.message}`);
        reject(error);
      }
    });
  }

  // 4. Challenge Proposal
  console.log("\n4️⃣  Security Officer challenging proposal...");
  const challengeHandler = collaborationHandlers["collab.proposal.challenge"];
  if (challengeHandler) {
    await new Promise<void>((resolve, reject) => {
      try {
        void challengeHandler({
          params: {
            sessionKey: session.sessionKey,
            decisionId: session.decisions[0].id,
            agentId: "security-officer",
            challenge: "Vendor lock-in risk is high.",
            suggestedAlternative: "Use self-hosted solution like Keycloak or Authentik.",
          },
          respond: (success: unknown, data: unknown, err: unknown) => {
            if (!success) {
              const error = err as { message?: string } | undefined;
              console.error(`   Challenge failed: ${String(error?.message)}`);
              reject(new Error(String(error?.message)));
            } else {
              console.log("   Challenge recorded.");
              resolve();
            }
          },
          context: {} as Record<string, unknown>,
          client: mockClient("security-officer"),
          req: {} as Record<string, unknown>,
          isWebchatConnect: () => false,
        });
      } catch (e: unknown) {
        const error = e as { message: string };
        console.error(`   Challenge failed (sync): ${error.message}`);
        reject(error);
      }
    });
  }

  // 5. Verify Message Persistence
  console.log("\n5️⃣  Verifying message persistence...");
  const messages = await loadMessages({ recipientId: "backend-architect" });
  console.log(`   Found ${messages.length} messages for Backend Architect.`);
  if (messages.length > 0) {
    console.log(`   Latest: "${messages[messages.length - 1].content}"`);
  }

  // 6. Automated Moderation
  console.log("\n6️⃣  Triggering Automated Moderation...");
  const interveneHandler = collaborationHandlers["collab.moderator.intervene"];
  if (interveneHandler) {
    await new Promise<void>((resolve, reject) => {
      try {
        void interveneHandler({
          params: {
            sessionKey: session.sessionKey,
            moderatorId: "cto-bot",
            interventionType: "question",
          },
          respond: (success: unknown, data: unknown, err: unknown) => {
            if (!success) {
              const error = err as { message?: string } | undefined;
              console.error(`   Moderation failed: ${String(error?.message)}`);
              reject(new Error(String(error?.message)));
            } else {
              const result = data as { message?: unknown };
              console.log(`   Moderator Intervened: "${String(result.message)}"`);
              resolve();
            }
          },
          context: {} as Record<string, unknown>,
          client: mockClient("cto-bot"),
          req: {} as Record<string, unknown>,
          isWebchatConnect: () => false,
        });
      } catch (e: unknown) {
        reject(e);
      }
    });
  }

  // 7. Finalization
  console.log("\n7️⃣  Finalizing Decision...");
  // Fake consensus
  session.roundCount = 5; // force enough rounds
  const finalizeHandler = collaborationHandlers["collab.decision.finalize"];
  if (finalizeHandler) {
    await new Promise<void>((resolve, reject) => {
      try {
        void finalizeHandler({
          params: {
            sessionKey: session.sessionKey,
            decisionId: session.decisions[0].id,
            finalDecision:
              "Proceed with Clerk.dev but build an abstraction layer to minimize lock-in.",
            moderatorId: "cto-bot",
          },
          respond: (success: unknown, data: unknown, err: unknown) => {
            if (!success) {
              const error = err as { message?: string } | undefined;
              console.error(`   Finalization failed: ${String(error?.message)}`);
              reject(new Error(String(error?.message)));
            } else {
              console.log("   Decision Finalized.");
              resolve();
            }
          },
          context: {} as Record<string, unknown>,
          client: mockClient("cto-bot"),
          req: {} as Record<string, unknown>,
          isWebchatConnect: () => false,
        });
      } catch (e: unknown) {
        reject(e);
      }
    });
  }

  // 8. Expert Consultation Directory
  console.log("\n8️⃣  Consulting Expert Directory...");
  const listExpertsHandler = collaborationHandlers["collab.directory.list"];
  if (listExpertsHandler) {
    await new Promise<void>((resolve, reject) => {
      try {
        void listExpertsHandler({
          params: {},
          respond: (success: unknown, data: unknown, err: unknown) => {
            if (!success) {
              const error = err as { message?: string } | undefined;
              console.error(`   Directory list failed: ${String(error?.message)}`);
              reject(new Error(String(error?.message)));
            } else {
              const result = data as Record<string, unknown>;
              const agents = result.agents as Array<{ agentId: string; role: string }>;
              console.log(`   Found ${agents.length} agents in directory.`);
              if (agents.length > 0) {
                console.log(`   Example: ${agents[0].agentId} (${agents[0].role})`);
              }
              resolve();
            }
          },
          context: {} as Record<string, unknown>,
          client: mockClient("worker"), // Anyone can list
          req: {} as Record<string, unknown>,
          isWebchatConnect: () => false,
        });
      } catch (e: unknown) {
        reject(e);
      }
    });
  }

  console.log("\n✅ Demo Completed Successfully!");
  process.exit(0);
}

runDemo().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
