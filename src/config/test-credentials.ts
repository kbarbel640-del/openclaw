// Debug credentials loading
import { resolveClawdisAgentDir } from "../utils.js";
import { discoverAuthStorage } from "@mariozechner/pi-coding-agent";

export async function testCredentials() {
  const agentDir = resolveClawdisAgentDir();
  console.log("Agent dir:", agentDir);
  
  const authStorage = discoverAuthStorage(agentDir);
  const anthropicKey = await authStorage.getApiKey("anthropic");
  const zaiKey = await authStorage.getApiKey("zai");
  
  console.log("Anthropic auth:", JSON.stringify(anthropicKey, null, 2));
  console.log("Z.ai auth:", JSON.stringify(zaiKey, null, 2));
  
  console.log("Environment ANTHROPIC_AUTH_TOKEN:", process.env.ANTHROPIC_AUTH_TOKEN ? "SET" : "MISSING");
  console.log("Environment ANTHROPIC_API_KEY:", process.env.ANTHROPIC_API_KEY ? "SET" : "MISSING");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testCredentials().catch(console.error);
}
