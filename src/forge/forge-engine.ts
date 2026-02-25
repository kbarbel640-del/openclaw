import { createSubsystemLogger } from "../logging/subsystem.js";
import { getGlobalDb } from "../infra/db.js";
import { SandboxTester } from "./sandbox-tester.js";
import { callGateway } from "../gateway/call.js";
import { SystemLogger } from "../infra/system-logger.js";
import { SystemHealth } from "../infra/system-health.js";

const log = createSubsystemLogger("forge/engine");

export class ForgeEngine {
  private db = getGlobalDb();
  private sandbox = new SandboxTester();

  async onTaskFailure(params: { taskId: string; failureReason: string; context: string }) {
    const jobId = crypto.randomUUID();
    try {
      log.info(`Analyzing failure for task ${params.taskId}: ${params.failureReason}`);

      const now = Date.now();
      this.db.prepare(`
        INSERT INTO forge_jobs (id, task_id, failure_reason, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(jobId, params.taskId, params.failureReason, 'analyzing', now, now);

      const missingCapability = await this.identifyMissingCapability(params.failureReason, params.context);
      if (missingCapability) {
        await this.generateAndTestSkill(jobId, missingCapability);
      } else {
        this.updateJobStatus(jobId, "failed", "Could not identify missing capability");
      }
      SystemHealth.update("forge");
    } catch (err) {
      SystemLogger.error("FORGE", `Forge job ${jobId} failed`, err);
      this.updateJobStatus(jobId, "failed", String(err));
      SystemHealth.update("forge", err);
    }
  }

  private async identifyMissingCapability(reason: string, context: string): Promise<string | null> {
    const prompt = `Analyze this task failure and identify the missing capability/skill.
Reason: ${reason}
Context: ${context}

Respond with only the name of the missing capability (e.g. "image_processing_webp").`;

    const response = await callGateway<{ text: string }>({
      method: "agent",
      params: { message: prompt, lane: "main", deliver: false }
    });

    return response?.text?.trim() || null;
  }

  private async generateAndTestSkill(jobId: string, capability: string) {
    this.updateJobStatus(jobId, "generating");

    const prompt = `Generate a TypeScript skill for the capability: ${capability}.
The skill must export an async function 'execute(params: any)'.
Respond only with the code.`;

    const response = await callGateway<{ text: string }>({
      method: "agent",
      params: { message: prompt, lane: "main", deliver: false }
    });

    const code = response?.text?.replace(/```typescript|```javascript|```/g, "").trim() || "";

    this.db.prepare(`UPDATE forge_jobs SET generated_code = ?, updated_at = ? WHERE id = ?`)
           .run(code, Date.now(), jobId);
    this.updateJobStatus(jobId, "testing");

    const testResult = await this.sandbox.testSkill(code);
    this.db.prepare(`UPDATE forge_jobs SET test_results = ?, updated_at = ? WHERE id = ?`)
           .run(JSON.stringify(testResult), Date.now(), jobId);

    if (testResult.success) {
      this.updateJobStatus(jobId, "completed");
      log.info(`Skill generated and tested successfully for job ${jobId}`);
    } else {
      this.updateJobStatus(jobId, "failed", "Sandbox tests failed: " + testResult.error);
    }
  }

  private updateJobStatus(id: string, status: string, error?: string) {
    this.db.prepare(`
      UPDATE forge_jobs
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, Date.now(), id);
  }
}
