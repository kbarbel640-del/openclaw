import "./paths-BZtyHNCi.js";
import "./workspace-CiMJt8ns.js";
import "./exec-a7RqluET.js";
import { c as resolveDefaultAgentId, r as resolveAgentDir, s as resolveAgentWorkspaceDir } from "./agent-scope-CKM5Fx2d.js";
import "./deliver-DoqeFT_8.js";
import { t as runEmbeddedPiAgent } from "./pi-embedded-wOdSH7A9.js";
import "./image-ops-CNOCC6Z9.js";
import "./boolean-Bb19hm9Y.js";
import "./model-auth-BkZQl1VS.js";
import "./config-B1Xo0gZ9.js";
import "./send-DikgY_ip.js";
import "./send-Vi3Q-r6l.js";
import "./send-D1qz65-z.js";
import "./github-copilot-token-BRNzgUa_.js";
import "./pi-model-discovery-Cexg1XRf.js";
import "./pi-embedded-helpers-Cvc7owo8.js";
import "./chrome-0sqdPv5Z.js";
import "./frontmatter-Uu27Y56g.js";
import "./store-BS1bEBlO.js";
import "./paths-DfJF1B42.js";
import "./tool-images-DIQtEDeE.js";
import "./image-DI2I4FtL.js";
import "./manager-CTvEo516.js";
import "./sqlite-x0Vt2lcg.js";
import "./retry-EqrOfF5v.js";
import "./redact-DcuzVizL.js";
import "./common-ZSq2WcmK.js";
import "./ir-BwpE5lG4.js";
import "./fetch-COWz5SB0.js";
import "./render-CiikiGbn.js";
import "./runner-CGtwfu-7.js";
import "./send-CE6-rIOZ.js";
import "./send-D9An4ZuK.js";
import "./channel-activity-B9lMlJ-Z.js";
import "./tables-BZU_QyKu.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

//#region src/hooks/llm-slug-generator.ts
/**
* LLM-based slug generator for session memory filenames
*/
/**
* Generate a short 1-2 word filename slug from session content using LLM
*/
async function generateSlugViaLLM(params) {
	let tempSessionFile = null;
	try {
		const agentId = resolveDefaultAgentId(params.cfg);
		const workspaceDir = resolveAgentWorkspaceDir(params.cfg, agentId);
		const agentDir = resolveAgentDir(params.cfg, agentId);
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-slug-"));
		tempSessionFile = path.join(tempDir, "session.jsonl");
		const prompt = `Based on this conversation, generate a short 1-2 word filename slug (lowercase, hyphen-separated, no file extension).

Conversation summary:
${params.sessionContent.slice(0, 2e3)}

Reply with ONLY the slug, nothing else. Examples: "vendor-pitch", "api-design", "bug-fix"`;
		const result = await runEmbeddedPiAgent({
			sessionId: `slug-generator-${Date.now()}`,
			sessionKey: "temp:slug-generator",
			agentId,
			sessionFile: tempSessionFile,
			workspaceDir,
			agentDir,
			config: params.cfg,
			prompt,
			timeoutMs: 15e3,
			runId: `slug-gen-${Date.now()}`
		});
		if (result.payloads && result.payloads.length > 0) {
			const text = result.payloads[0]?.text;
			if (text) return text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || null;
		}
		return null;
	} catch (err) {
		console.error("[llm-slug-generator] Failed to generate slug:", err);
		return null;
	} finally {
		if (tempSessionFile) try {
			await fs.rm(path.dirname(tempSessionFile), {
				recursive: true,
				force: true
			});
		} catch {}
	}
}

//#endregion
export { generateSlugViaLLM };