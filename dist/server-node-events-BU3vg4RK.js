import "./paths-DVBShlw6.js";
import { c as defaultRuntime } from "./subsystem-Dk9vptdH.js";
import "./utils-DHNjxV7z.js";
import "./pi-embedded-helpers-VKUwj79_.js";
import { S as resolveGatewaySessionStoreTarget, b as loadSessionEntry, mt as requestHeartbeatNow, wr as enqueueSystemEvent, x as pruneLegacyStoreKeys } from "./reply-CyQ6-FzJ.js";
import { u as normalizeMainKey } from "./session-key-BWxPj0z_.js";
import "./exec-BDA_Yyrr.js";
import "./agent-scope-9Xp7ERv_.js";
import "./model-selection-LGcPfPYa.js";
import "./github-copilot-token-CiF5Iyi2.js";
import "./boolean-BgXe2hyu.js";
import "./env-BglTbubH.js";
import { i as loadConfig } from "./config-BFqIpIaN.js";
import "./manifest-registry-qsNC0Vs3.js";
import { r as normalizeChannelId } from "./plugins-BqubgBzU.js";
import { l as updateSessionStore } from "./sessions-C0GO_mnr.js";
import "./runner-CVeKzZQO.js";
import "./image-Bt9hGdbK.js";
import "./pi-model-discovery-EwKVHlZB.js";
import "./sandbox-BE-b8fdZ.js";
import "./chrome-CIS8D9FX.js";
import "./skills-ClV79GKX.js";
import "./routes-C7HQH21j.js";
import "./server-context-D1RX-Gax.js";
import "./image-ops-7FCglKpJ.js";
import "./store-Z0qYRiki.js";
import "./ports-DA9qgGkH.js";
import "./message-channel-Dy2obPV0.js";
import "./logging-CcxUDNcI.js";
import "./accounts-DgwQ0fS6.js";
import "./send-Di4Ur3tq.js";
import "./send-B_pFBnxc.js";
import "./paths-BuQbsACT.js";
import "./tool-images-Dcxo2DY6.js";
import "./redact-Bb36nvYe.js";
import "./tool-display-CmS3h6Nq.js";
import "./fetch-C9UREBdO.js";
import "./deliver-Ck5K5MKu.js";
import "./dispatcher-sWpBJmov.js";
import "./send-ClHUFnHH.js";
import "./manager-o1eUzokg.js";
import "./sqlite-CsNJIO0X.js";
import "./retry-DKmbQDAJ.js";
import "./common-BmAlIOdG.js";
import "./ir-DCG3Acd8.js";
import "./render-DIvHuHqk.js";
import "./commands-registry-ZEI2evvR.js";
import "./client-DpOK59bH.js";
import "./call-x2d8LpLG.js";
import "./channel-activity-BNtfMBh-.js";
import "./tables-K0iiA2Kp.js";
import "./send-BZlBXGH7.js";
import "./links-DRaqZmU9.js";
import "./progress-Dse9HtAj.js";
import "./pairing-store-Cc9gjRtb.js";
import "./pi-tools.policy-Cj5XVH3k.js";
import "./send-WO5xvV3w.js";
import "./onboard-helpers-BndGbHB5.js";
import "./prompt-style-BPRtWYv8.js";
import "./pairing-labels-Uz954oAX.js";
import "./session-cost-usage-CbsU4YHL.js";
import "./nodes-screen-ByxT3UnR.js";
import "./auth-BL5l-UZW.js";
import "./control-auth-CPG75YeL.js";
import "./control-service-DeCWAKYd.js";
import "./channel-selection-BZ0vtlHC.js";
import "./delivery-queue-46I6nBfA.js";
import { t as agentCommand } from "./agent-CSaVA6iH.js";
import { t as formatForLog } from "./ws-log-Dnh7qE8D.js";
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