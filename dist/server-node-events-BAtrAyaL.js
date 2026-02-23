import { p as defaultRuntime } from "./entry.js";
import "./auth-profiles-C9_xOnFy.js";
import { u as normalizeMainKey } from "./session-key-DVvxnFKg.js";
import "./utils-M-vQAlGY.js";
import "./exec-CPPvAI1K.js";
import "./agent-scope-BabSooVs.js";
import "./github-copilot-token-C9W4SY9o.js";
import "./pi-model-discovery-EhM2JAQo.js";
import { i as loadConfig } from "./config-DERbrvBI.js";
import "./manifest-registry-4qV6l7iG.js";
import { r as normalizeChannelId } from "./plugins-Bj04t2xy.js";
import "./logging-B5vJSgy6.js";
import "./accounts-auAzqhkF.js";
import "./send-BPz2yf20.js";
import "./send-DWM7RrpW.js";
import { S as resolveGatewaySessionStoreTarget, b as loadSessionEntry, fr as enqueueSystemEvent, mt as requestHeartbeatNow, x as pruneLegacyStoreKeys } from "./reply-9YUII82G.js";
import "./media-CYPnlTh1.js";
import "./message-channel-C6pzZhm1.js";
import "./render-DyRjoIgA.js";
import "./tables-bbm5Q_NB.js";
import "./image-ops-DNHr22g3.js";
import "./fetch-Di_volBf.js";
import "./tool-images-cW3M5OUJ.js";
import "./common-DrD5glIM.js";
import "./server-context-BNtjuKAn.js";
import "./chrome-DFsbt9ef.js";
import "./auth-HVWrOuKf.js";
import "./control-auth-Batqdqdc.js";
import "./ports-rKsugsSD.js";
import "./control-service-NNBQcdp2.js";
import "./deliver-CNGP7twu.js";
import "./pi-embedded-helpers-C1-1-U6z.js";
import { l as updateSessionStore } from "./sessions-BJEyAc_A.js";
import "./runner-XcgJy_ug.js";
import "./image-WxJLBk1p.js";
import "./models-config-CrH18Kky.js";
import "./sandbox-D64T9Pyj.js";
import "./skills-DQyYx0by.js";
import "./routes-D0Nv_oa2.js";
import "./store-CC9NUiWk.js";
import "./paths-erOp4-FP.js";
import "./redact-Bt-krp_b.js";
import "./tool-display-CQTF9Pgy.js";
import "./context-CGQcAzA9.js";
import "./dispatcher-CZ1pwxaF.js";
import "./send-Cwo7YumQ.js";
import "./memory-cli-CbQlPAUy.js";
import "./manager-ATX3L2Ui.js";
import "./sqlite-Bp1-grKZ.js";
import "./retry-BXvnraMG.js";
import "./commands-registry-Drw6pxn6.js";
import "./client-CS0sGUWu.js";
import "./call-NZu9U6a5.js";
import "./channel-activity-V_1Gy17o.js";
import "./send-D-mTESpD.js";
import "./links-Bvz_D8Gr.js";
import "./progress-ApT6cok4.js";
import "./pairing-store-Dgy_PkNT.js";
import "./pi-tools.policy-6ltFPOyK.js";
import "./send-CbVU-TR-.js";
import "./onboard-helpers-B0uCYhu2.js";
import "./prompt-style-Bo1texhN.js";
import "./pairing-labels-BcVKQODN.js";
import "./session-cost-usage-CWXgq9D0.js";
import "./nodes-screen-C0J6_Jq4.js";
import "./channel-selection-By_FPHpy.js";
import "./delivery-queue-CR5cV5Y4.js";
import { t as agentCommand } from "./agent-DaD8fZ8s.js";
import { t as formatForLog } from "./ws-log-Bcr8m1Kh.js";
import { randomUUID } from "node:crypto";

//#region src/gateway/server-node-events.ts
const handleNodeEvent = async (ctx, nodeId, evt) => {
	switch (evt.event) {
		case "voice.transcript": {
			if (!evt.payloadJSON) return;
			let payload;
			try {
				payload = JSON.parse(evt.payloadJSON);
			} catch {
				return;
			}
			const obj = typeof payload === "object" && payload !== null ? payload : {};
			const text = typeof obj.text === "string" ? obj.text.trim() : "";
			if (!text) return;
			if (text.length > 2e4) return;
			const sessionKeyRaw = typeof obj.sessionKey === "string" ? obj.sessionKey.trim() : "";
			const cfg = loadConfig();
			const rawMainKey = normalizeMainKey(cfg.session?.mainKey);
			const sessionKey = sessionKeyRaw.length > 0 ? sessionKeyRaw : rawMainKey;
			const { storePath, entry, canonicalKey } = loadSessionEntry(sessionKey);
			const now = Date.now();
			const sessionId = entry?.sessionId ?? randomUUID();
			if (storePath) await updateSessionStore(storePath, (store) => {
				const target = resolveGatewaySessionStoreTarget({
					cfg,
					key: sessionKey,
					store
				});
				pruneLegacyStoreKeys({
					store,
					canonicalKey: target.canonicalKey,
					candidates: target.storeKeys
				});
				store[canonicalKey] = {
					sessionId,
					updatedAt: now,
					thinkingLevel: entry?.thinkingLevel,
					verboseLevel: entry?.verboseLevel,
					reasoningLevel: entry?.reasoningLevel,
					systemSent: entry?.systemSent,
					sendPolicy: entry?.sendPolicy,
					lastChannel: entry?.lastChannel,
					lastTo: entry?.lastTo
				};
			});
			ctx.addChatRun(sessionId, {
				sessionKey: canonicalKey,
				clientRunId: `voice-${randomUUID()}`
			});
			agentCommand({
				message: text,
				sessionId,
				sessionKey: canonicalKey,
				thinking: "low",
				deliver: false,
				messageChannel: "node"
			}, defaultRuntime, ctx.deps).catch((err) => {
				ctx.logGateway.warn(`agent failed node=${nodeId}: ${formatForLog(err)}`);
			});
			return;
		}
		case "agent.request": {
			if (!evt.payloadJSON) return;
			let link = null;
			try {
				link = JSON.parse(evt.payloadJSON);
			} catch {
				return;
			}
			const message = (link?.message ?? "").trim();
			if (!message) return;
			if (message.length > 2e4) return;
			const channel = normalizeChannelId(typeof link?.channel === "string" ? link.channel.trim() : "") ?? void 0;
			const to = typeof link?.to === "string" && link.to.trim() ? link.to.trim() : void 0;
			const deliver = Boolean(link?.deliver) && Boolean(channel);
			const sessionKeyRaw = (link?.sessionKey ?? "").trim();
			const sessionKey = sessionKeyRaw.length > 0 ? sessionKeyRaw : `node-${nodeId}`;
			const cfg = loadConfig();
			const { storePath, entry, canonicalKey } = loadSessionEntry(sessionKey);
			const now = Date.now();
			const sessionId = entry?.sessionId ?? randomUUID();
			if (storePath) await updateSessionStore(storePath, (store) => {
				const target = resolveGatewaySessionStoreTarget({
					cfg,
					key: sessionKey,
					store
				});
				pruneLegacyStoreKeys({
					store,
					canonicalKey: target.canonicalKey,
					candidates: target.storeKeys
				});
				store[canonicalKey] = {
					sessionId,
					updatedAt: now,
					thinkingLevel: entry?.thinkingLevel,
					verboseLevel: entry?.verboseLevel,
					reasoningLevel: entry?.reasoningLevel,
					systemSent: entry?.systemSent,
					sendPolicy: entry?.sendPolicy,
					lastChannel: entry?.lastChannel,
					lastTo: entry?.lastTo
				};
			});
			agentCommand({
				message,
				sessionId,
				sessionKey: canonicalKey,
				thinking: link?.thinking ?? void 0,
				deliver,
				to,
				channel,
				timeout: typeof link?.timeoutSeconds === "number" ? link.timeoutSeconds.toString() : void 0,
				messageChannel: "node"
			}, defaultRuntime, ctx.deps).catch((err) => {
				ctx.logGateway.warn(`agent failed node=${nodeId}: ${formatForLog(err)}`);
			});
			return;
		}
		case "chat.subscribe": {
			if (!evt.payloadJSON) return;
			let payload;
			try {
				payload = JSON.parse(evt.payloadJSON);
			} catch {
				return;
			}
			const obj = typeof payload === "object" && payload !== null ? payload : {};
			const sessionKey = typeof obj.sessionKey === "string" ? obj.sessionKey.trim() : "";
			if (!sessionKey) return;
			ctx.nodeSubscribe(nodeId, sessionKey);
			return;
		}
		case "chat.unsubscribe": {
			if (!evt.payloadJSON) return;
			let payload;
			try {
				payload = JSON.parse(evt.payloadJSON);
			} catch {
				return;
			}
			const obj = typeof payload === "object" && payload !== null ? payload : {};
			const sessionKey = typeof obj.sessionKey === "string" ? obj.sessionKey.trim() : "";
			if (!sessionKey) return;
			ctx.nodeUnsubscribe(nodeId, sessionKey);
			return;
		}
		case "exec.started":
		case "exec.finished":
		case "exec.denied": {
			if (!evt.payloadJSON) return;
			let payload;
			try {
				payload = JSON.parse(evt.payloadJSON);
			} catch {
				return;
			}
			const obj = typeof payload === "object" && payload !== null ? payload : {};
			const sessionKey = typeof obj.sessionKey === "string" ? obj.sessionKey.trim() : `node-${nodeId}`;
			if (!sessionKey) return;
			const runId = typeof obj.runId === "string" ? obj.runId.trim() : "";
			const command = typeof obj.command === "string" ? obj.command.trim() : "";
			const exitCode = typeof obj.exitCode === "number" && Number.isFinite(obj.exitCode) ? obj.exitCode : void 0;
			const timedOut = obj.timedOut === true;
			const output = typeof obj.output === "string" ? obj.output.trim() : "";
			const reason = typeof obj.reason === "string" ? obj.reason.trim() : "";
			let text = "";
			if (evt.event === "exec.started") {
				text = `Exec started (node=${nodeId}${runId ? ` id=${runId}` : ""})`;
				if (command) text += `: ${command}`;
			} else if (evt.event === "exec.finished") {
				const exitLabel = timedOut ? "timeout" : `code ${exitCode ?? "?"}`;
				text = `Exec finished (node=${nodeId}${runId ? ` id=${runId}` : ""}, ${exitLabel})`;
				if (output) text += `\n${output}`;
			} else {
				text = `Exec denied (node=${nodeId}${runId ? ` id=${runId}` : ""}${reason ? `, ${reason}` : ""})`;
				if (command) text += `: ${command}`;
			}
			enqueueSystemEvent(text, {
				sessionKey,
				contextKey: runId ? `exec:${runId}` : "exec"
			});
			requestHeartbeatNow({ reason: "exec-event" });
			return;
		}
		default: return;
	}
};

//#endregion
export { handleNodeEvent };