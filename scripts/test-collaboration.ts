import { spawn } from "node:child_process";
import path from "node:path";

async function runTest() {
  console.log("🚀 Starting Subagent Collaboration Test...");
  console.log("-----------------------------------------");
  console.log("Spawn Target: Vulcan (agent:vulcan)");
  console.log("Mission: Check with Aegis if the cron scheduler is secure.");

  try {
    const child = spawn(
      "node",
      [
        "openclaw.mjs",
        "agent",

        "--agent",
        "vulcan",
        "--message",
        "SYSTEM: Task: Check with Aegis if openclaw cron scheduler is secure. Check AGENTS.md to find him.\nUSER: Please check with Aegis if the cron scheduler is secure.",
      ],
      {
        stdio: "pipe",
        env: {
          ...process.env,
        },
        cwd: process.cwd(),
      },
    );

    child.stdout.on("data", (data) => {
      process.stdout.write(data);
    });

    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      console.log("-----------------------------------------");
      if (code === 0) {
        console.log("✅ Test Completed.");
      } else {
        console.error(`❌ Test Failed with exit code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (error: any) {
    console.error("❌ Test Failed:", error.message);
    process.exit(1);
  }
}

runTest();
