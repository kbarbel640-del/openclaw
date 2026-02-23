import "./paths-DVBShlw6.js";
import { R as theme, c as defaultRuntime } from "./subsystem-Dk9vptdH.js";
import "./utils-DHNjxV7z.js";
import "./pi-embedded-helpers-VKUwj79_.js";
import "./exec-BDA_Yyrr.js";
import "./agent-scope-9Xp7ERv_.js";
import "./model-selection-LGcPfPYa.js";
import "./github-copilot-token-CiF5Iyi2.js";
import "./boolean-BgXe2hyu.js";
import "./env-BglTbubH.js";
import "./config-BFqIpIaN.js";
import "./manifest-registry-qsNC0Vs3.js";
import "./plugins-BqubgBzU.js";
import "./sessions-C0GO_mnr.js";
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
import "./paths-BuQbsACT.js";
import "./tool-images-Dcxo2DY6.js";
import "./redact-Bb36nvYe.js";
import "./tool-display-CmS3h6Nq.js";
import "./commands-registry-ZEI2evvR.js";
import "./client-DpOK59bH.js";
import "./call-x2d8LpLG.js";
import { t as formatDocsLink } from "./links-DRaqZmU9.js";
import { t as parseTimeoutMs } from "./parse-timeout-mZ0bYwbj.js";
import { t as runTui } from "./tui-BHOTs34v.js";

//#region src/cli/tui-cli.ts
function registerTuiCli(program) {
	program.command("tui").description("Open a terminal UI connected to the Gateway").option("--url <url>", "Gateway WebSocket URL (defaults to gateway.remote.url when configured)").option("--token <token>", "Gateway token (if required)").option("--password <password>", "Gateway password (if required)").option("--session <key>", "Session key (default: \"main\", or \"global\" when scope is global)").option("--deliver", "Deliver assistant replies", false).option("--thinking <level>", "Thinking level override").option("--message <text>", "Send an initial message after connecting").option("--timeout-ms <ms>", "Agent timeout in ms (defaults to agents.defaults.timeoutSeconds)").option("--history-limit <n>", "History entries to load", "200").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/tui", "docs.openclaw.ai/cli/tui")}\n`).action(async (opts) => {
		try {
			const timeoutMs = parseTimeoutMs(opts.timeoutMs);
			if (opts.timeoutMs !== void 0 && timeoutMs === void 0) defaultRuntime.error(`warning: invalid --timeout-ms "${String(opts.timeoutMs)}"; ignoring`);
			const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
			await runTui({
				url: opts.url,
				token: opts.token,
				password: opts.password,
				session: opts.session,
				deliver: Boolean(opts.deliver),
				thinking: opts.thinking,
				message: opts.message,
				timeoutMs,
				historyLimit: Number.isNaN(historyLimit) ? void 0 : historyLimit
			});
		} catch (err) {
			defaultRuntime.error(String(err));
			defaultRuntime.exit(1);
		}
	});
}

//#endregion
export { registerTuiCli };