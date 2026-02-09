import fs from "fs";
import os from "os";
import path from "path";

const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");

try {
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);

  const targetAgents = ["mars", "muse", "kairos", "vulcan"]; // Added Vulcan just to be safe/consistent
  let updatedCount = 0;

  if (config.agents && Array.isArray(config.agents.list)) {
    for (const agent of config.agents.list) {
      if (targetAgents.includes(agent.id) && agent.model && agent.model.primary) {
        if (agent.model.primary !== "ollama/kimi-k2.5:cloud") {
          console.log(`Updating ${agent.id}: ${agent.model.primary} -> ollama/kimi-k2.5:cloud`);
          agent.model.primary = "ollama/kimi-k2.5:cloud";
          updatedCount++;
        }
      }
    }
  }

  if (updatedCount > 0) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    console.log(`✅ Successfully updated ${updatedCount} agents in ${configPath}`);
  } else {
    console.log("ℹ️ No agents needed updating.");
  }
} catch (err) {
  console.error("❌ Failed to update config:", err);
  process.exit(1);
}
