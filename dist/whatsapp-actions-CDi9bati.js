import "./paths-rb94mUrR.js";
import "./agent-scope-CVeVRfcx.js";
import "./exec-BhtJ_oeB.js";
import "./model-selection-C5uBHvBr.js";
import "./github-copilot-token-Cr_SiZeh.js";
import "./image-ops-C7_aZYD2.js";
import "./config-D-m2JC0t.js";
import "./tool-images-DoCjYzGJ.js";
import { i as jsonResult, l as readStringParam, o as readReactionParams, t as createActionGate } from "./common-DFhQiw_g.js";
import "./ir-Dp-ysZy0.js";
import "./fetch-D1SGLLcP.js";
import "./active-listener-CJCb60Eh.js";
import { r as sendReactionWhatsApp } from "./outbound-dYKhZXD3.js";

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