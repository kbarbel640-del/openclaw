/**
 * TEST: Collaboration Security Scenarios
 *
 * Verifies:
 * 1. Unauthorized actions (Impersonation) are blocked.
 * 2. Authorized actions proceed.
 * 3. Directory listing works.
 */

import type { GatewayClient } from "../src/gateway/server-methods/types.js";

function mockClient(agentId: string): GatewayClient {
  return {
    connect: {
      client: {
        id: agentId,
        version: "1.0.0",
        platform: "test",
        mode: "agent",
      },
    },
  } as unknown as GatewayClient;
}

async function runTest() {
  console.log("🛡️  Starting Collaboration Security Tests...\n");

  // Dynamic import to load server methods
  const { initializeCollaborativeSession, collaborationHandlers } =
    await import("../src/gateway/server-methods/collaboration.js");

  // 1. Setup Session
  console.log("1️⃣  Initializing Session...");
  const session = initializeCollaborativeSession({
    topic: "Security Test Session",
    agents: ["alice", "bob", "eve"],
    moderator: "admin",
  });
  console.log(`   Session: ${session.sessionKey}`);

  // 2. Test: Authorized Proposal (Alice acts as Alice) - SHOULD PASS
  console.log("\n2️⃣  Test: Authorized Proposal (Alice -> Alice)...");
  const publishHandler = collaborationHandlers["collab.proposal.publish"];

  try {
    await new Promise<void>((resolve, reject) => {
      void publishHandler({
        params: {
          sessionKey: session.sessionKey,
          agentId: "alice",
          decisionTopic: "Test Topic",
          proposal: "Alice's Proposal",
          reasoning: "Valid",
        },
        respond: (success: unknown, data: unknown, err: unknown) => {
          if (success) {
            console.log("   ✅ Success (Expected)");
            resolve();
          } else {
            const error = err as { message?: string } | undefined;
            reject(new Error(`Failed: ${String(error?.message)}`));
          }
        },
        context: {} as Record<string, unknown>,
        client: mockClient("alice"), // Correct Identity
        req: {} as Record<string, unknown>,
        isWebchatConnect: () => false,
      });
    });
  } catch (e: unknown) {
    const error = e as { message: string };
    console.error(`   ❌ Failed unexpected: ${error.message}`);
    process.exit(1);
  }

  // 3. Test: Un-Authorized Proposal (Eve tries to act as Bob) - SHOULD FAIL
  console.log("\n3️⃣  Test: Impersonation Attack (Eve -> Bob)...");
  try {
    await new Promise<void>((resolve, reject) => {
      void publishHandler({
        params: {
          sessionKey: session.sessionKey,
          agentId: "bob", // TARGET
          decisionTopic: "Test Topic",
          proposal: "Eve's Malicious Proposal",
          reasoning: "Evil",
        },
        respond: (success: unknown, data: unknown, err: unknown) => {
          if (success) {
            console.error("   ❌ FAILED: Operation succeeded but should have been blocked!");
            reject(new Error("Security Bypass Detected"));
          } else {
            // We expect failure only here!
            const error = err as { message?: string } | undefined;
            console.log(`   ✅ Blocked (Expected): ${String(error?.message)}`);
            resolve();
          }
        },
        context: {} as Record<string, unknown>,
        client: mockClient("eve"), // ATTACKER Identity
        req: {} as Record<string, unknown>,
        isWebchatConnect: () => false,
      });
    });
  } catch (e: unknown) {
    // If the handler throws (which assertClientIdentity does), we catch it here
    const error = e as { message: string };
    if (error.message.includes("Not authorized") || error.message.includes("cannot act as")) {
      console.log(`   ✅ Blocked (Expected Exception): ${error.message}`);
    } else {
      console.error(`   ❌ Failed with unexpected error: ${error.message}`);
      process.exit(1);
    }
  }

  // 4. Test: Directory Listing
  console.log("\n4️⃣  Test: Expert Directory Listing...");
  const dirHandler = collaborationHandlers["collab.directory.list"];
  try {
    await new Promise<void>((resolve, reject) => {
      void dirHandler({
        params: {},
        respond: (success: unknown, data: unknown, err: unknown) => {
          if (success) {
            const result = data as Record<string, unknown>;
            const agents = result.agents;
            if (Array.isArray(agents) && agents.length > 0) {
              console.log(`   ✅ Success: Retrieved ${agents.length} agents.`);
              resolve();
            } else {
              reject(new Error("Agent list empty or invalid"));
            }
          } else {
            const error = err as { message?: string } | undefined;
            reject(new Error(`Failed: ${String(error?.message)}`));
          }
        },
        context: {} as Record<string, unknown>,
        client: mockClient("alice"),
        req: {} as Record<string, unknown>,
        isWebchatConnect: () => false,
      });
    });
  } catch (e: unknown) {
    const error = e as { message: string };
    console.error(`   ❌ Failed: ${error.message}`);
    process.exit(1);
  }

  console.log("\n✅ Security Scenarios Passed!");
  process.exit(0);
}

runTest().catch(console.error);
