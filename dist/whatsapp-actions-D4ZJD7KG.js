import "./auth-profiles-C9_xOnFy.js";
import "./utils-M-vQAlGY.js";
import "./exec-CPPvAI1K.js";
import "./agent-scope-BabSooVs.js";
import "./github-copilot-token-C9W4SY9o.js";
import "./config-DERbrvBI.js";
import "./manifest-registry-4qV6l7iG.js";
import "./plugins-Bj04t2xy.js";
import "./logging-B5vJSgy6.js";
import "./accounts-auAzqhkF.js";
import "./media-CYPnlTh1.js";
import "./message-channel-C6pzZhm1.js";
import "./render-DyRjoIgA.js";
import "./tables-bbm5Q_NB.js";
import { r as sendReactionWhatsApp } from "./outbound-ISwAf-aJ.js";
import "./image-ops-DNHr22g3.js";
import "./fetch-Di_volBf.js";
import "./tool-images-cW3M5OUJ.js";
import { a as jsonResult, n as createActionGate, s as readReactionParams, u as readStringParam } from "./common-DrD5glIM.js";

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