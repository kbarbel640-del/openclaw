import "./paths-DVBShlw6.js";
import { t as createSubsystemLogger } from "./subsystem-Dk9vptdH.js";
import "./utils-DHNjxV7z.js";
import "./pi-embedded-helpers-VKUwj79_.js";
import { _t as loadOpenClawPlugins } from "./reply-CyQ6-FzJ.js";
import "./exec-BDA_Yyrr.js";
import { c as resolveDefaultAgentId, s as resolveAgentWorkspaceDir } from "./agent-scope-9Xp7ERv_.js";
import "./model-selection-LGcPfPYa.js";
import "./github-copilot-token-CiF5Iyi2.js";
import "./boolean-BgXe2hyu.js";
import "./env-BglTbubH.js";
import { i as loadConfig } from "./config-BFqIpIaN.js";
import "./manifest-registry-qsNC0Vs3.js";
import "./plugins-BqubgBzU.js";
import "./sessions-C0GO_mnr.js";
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

//#region src/plugins/cli.ts
const log = createSubsystemLogger("plugins");
function registerPluginCliCommands(program, cfg) {
	const config = cfg ?? loadConfig();
	const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
	const logger = {
		info: (msg) => log.info(msg),
		warn: (msg) => log.warn(msg),
		error: (msg) => log.error(msg),
		debug: (msg) => log.debug(msg)
	};
	const registry = loadOpenClawPlugins({
		config,
		workspaceDir,
		logger
	});
	const existingCommands = new Set(program.commands.map((cmd) => cmd.name()));
	for (const entry of registry.cliRegistrars) {
		if (entry.commands.length > 0) {
			const overlaps = entry.commands.filter((command) => existingCommands.has(command));
			if (overlaps.length > 0) {
				log.debug(`plugin CLI register skipped (${entry.pluginId}): command already registered (${overlaps.join(", ")})`);
				continue;
			}
		}
		try {
			const result = entry.register({
				program,
				config,
				workspaceDir,
				logger
			});
			if (result && typeof result.then === "function") result.catch((err) => {
				log.warn(`plugin CLI register failed (${entry.pluginId}): ${String(err)}`);
			});
			for (const command of entry.commands) existingCommands.add(command);
		} catch (err) {
			log.warn(`plugin CLI register failed (${entry.pluginId}): ${String(err)}`);
		}
	}
}

//#endregion
export { registerPluginCliCommands };