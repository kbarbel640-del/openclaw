import "./paths-DVBShlw6.js";
import "./subsystem-Dk9vptdH.js";
import "./utils-DHNjxV7z.js";
import "./exec-BDA_Yyrr.js";
import "./agent-scope-9Xp7ERv_.js";
import "./model-selection-LGcPfPYa.js";
import "./github-copilot-token-CiF5Iyi2.js";
import "./boolean-BgXe2hyu.js";
import "./env-BglTbubH.js";
import "./config-BFqIpIaN.js";
import "./manifest-registry-qsNC0Vs3.js";
import "./plugins-BqubgBzU.js";
import "./image-ops-7FCglKpJ.js";
import "./message-channel-Dy2obPV0.js";
import "./logging-CcxUDNcI.js";
import "./accounts-DgwQ0fS6.js";
import "./tool-images-Dcxo2DY6.js";
import "./fetch-C9UREBdO.js";
import { a as jsonResult, n as createActionGate, s as readReactionParams, u as readStringParam } from "./common-BmAlIOdG.js";
import "./ir-DCG3Acd8.js";
import "./render-DIvHuHqk.js";
import "./tables-K0iiA2Kp.js";
import { r as sendReactionWhatsApp } from "./outbound-BYf8x1XJ.js";

//#region src/agents/tools/whatsapp-actions.ts
async function handleWhatsAppAction(params, cfg) {
	const action = readStringParam(params, "action", { required: true });
	const isActionEnabled = createActionGate(cfg.channels?.whatsapp?.actions);
	if (action === "react") {
		if (!isActionEnabled("reactions")) throw new Error("WhatsApp reactions are disabled.");
		const chatJid = readStringParam(params, "chatJid", { required: true });
		const messageId = readStringParam(params, "messageId", { required: true });
		const { emoji, remove, isEmpty } = readReactionParams(params, { removeErrorMessage: "Emoji is required to remove a WhatsApp reaction." });
		const participant = readStringParam(params, "participant");
		const accountId = readStringParam(params, "accountId");
		const fromMeRaw = params.fromMe;
		await sendReactionWhatsApp(chatJid, messageId, remove ? "" : emoji, {
			verbose: false,
			fromMe: typeof fromMeRaw === "boolean" ? fromMeRaw : void 0,
			participant: participant ?? void 0,
			accountId: accountId ?? void 0
		});
		if (!remove && !isEmpty) return jsonResult({
			ok: true,
			added: emoji
		});
		return jsonResult({
			ok: true,
			removed: true
		});
	}
	throw new Error(`Unsupported WhatsApp action: ${action}`);
}

//#endregion
export { handleWhatsAppAction };