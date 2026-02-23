import { C as resolveOpenClawAgentDir } from "./auth-profiles-C9_xOnFy.js";
import { i as loadConfig } from "./config-DERbrvBI.js";
import { t as ensureOpenClawModelsJson } from "./models-config-CrH18Kky.js";

//#region src/agents/context.ts
const MODEL_CACHE = /* @__PURE__ */ new Map();
(async () => {
	try {
		const { discoverAuthStorage, discoverModels } = await import("./pi-model-discovery-EhM2JAQo.js").then((n) => n.r);
		await ensureOpenClawModelsJson(loadConfig());
		const agentDir = resolveOpenClawAgentDir();
		const models = discoverModels(discoverAuthStorage(agentDir), agentDir).getAll();
		for (const m of models) {
			if (!m?.id) continue;
			if (typeof m.contextWindow === "number" && m.contextWindow > 0) MODEL_CACHE.set(m.id, m.contextWindow);
		}
	} catch {}
})();
function lookupContextTokens(modelId) {
	if (!modelId) return;
	return MODEL_CACHE.get(modelId);
}

//#endregion
export { lookupContextTokens as t };