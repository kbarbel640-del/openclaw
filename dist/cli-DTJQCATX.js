import { o as createSubsystemLogger } from "./entry.js";
import "./auth-profiles-C9_xOnFy.js";
import "./utils-M-vQAlGY.js";
import "./exec-CPPvAI1K.js";
import { c as resolveDefaultAgentId, s as resolveAgentWorkspaceDir } from "./agent-scope-BabSooVs.js";
import "./github-copilot-token-C9W4SY9o.js";
import "./pi-model-discovery-EhM2JAQo.js";
import { i as loadConfig } from "./config-DERbrvBI.js";
import "./manifest-registry-4qV6l7iG.js";
import "./plugins-Bj04t2xy.js";
import "./logging-B5vJSgy6.js";
import "./accounts-auAzqhkF.js";
import "./send-BPz2yf20.js";
import "./send-DWM7RrpW.js";
import { _t as loadOpenClawPlugins } from "./reply-9YUII82G.js";
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
import "./sessions-BJEyAc_A.js";
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