import { A as theme, p as defaultRuntime } from "./entry.js";
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
import "./message-channel-C6pzZhm1.js";
import "./image-ops-DNHr22g3.js";
import "./tool-images-cW3M5OUJ.js";
import "./server-context-BNtjuKAn.js";
import "./chrome-DFsbt9ef.js";
import "./ports-rKsugsSD.js";
import "./pi-embedded-helpers-C1-1-U6z.js";
import "./sessions-BJEyAc_A.js";
import "./sandbox-D64T9Pyj.js";
import "./skills-DQyYx0by.js";
import "./routes-D0Nv_oa2.js";
import "./store-CC9NUiWk.js";
import "./paths-erOp4-FP.js";
import "./redact-Bt-krp_b.js";
import "./tool-display-CQTF9Pgy.js";
import "./commands-registry-Drw6pxn6.js";
import "./client-CS0sGUWu.js";
import "./call-NZu9U6a5.js";
import { t as formatDocsLink } from "./links-Bvz_D8Gr.js";
import { t as parseTimeoutMs } from "./parse-timeout-CBYDeqB8.js";
import { t as runTui } from "./tui-yb6CsxRg.js";

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