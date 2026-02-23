import { _t as getVerboseFlag, c as enableConsoleCapture, gt as getPrimaryCommand, ht as getPositiveIntFlagValue, i as normalizeEnv, mt as getFlagValue, n as isTruthyEnvValue, p as defaultRuntime, pt as getCommandPath, vt as hasFlag, yt as hasHelpOrVersion } from "./entry.js";
import "./auth-profiles-C9_xOnFy.js";
import "./utils-M-vQAlGY.js";
import "./exec-CPPvAI1K.js";
import "./agent-scope-BabSooVs.js";
import "./github-copilot-token-C9W4SY9o.js";
import "./pi-model-discovery-EhM2JAQo.js";
import { F as loadDotEnv, P as VERSION } from "./config-DERbrvBI.js";
import "./manifest-registry-4qV6l7iG.js";
import "./plugins-Bj04t2xy.js";
import "./logging-B5vJSgy6.js";
import "./accounts-auAzqhkF.js";
import "./send-BPz2yf20.js";
import "./send-DWM7RrpW.js";
import "./reply-9YUII82G.js";
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
import { r as formatUncaughtError } from "./errors-C34O4jLW.js";
import "./ports-rKsugsSD.js";
import "./control-service-NNBQcdp2.js";
import "./deliver-CNGP7twu.js";
import "./pi-embedded-helpers-C1-1-U6z.js";
import "./sessions-BJEyAc_A.js";
import { d as installUnhandledRejectionHandler } from "./runner-XcgJy_ug.js";
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
import { t as ensureOpenClawCliOnPath } from "./path-env-C8edjgRD.js";
import "./plugin-auto-enable-CpOL1NkY.js";
import "./note-Dj9IhbC0.js";
import { t as ensurePluginRegistryLoaded } from "./plugin-registry-BZ78Po9J.js";
import { t as assertSupportedRuntime } from "./runtime-guard-BUaZDEQe.js";
import "./doctor-config-flow-Bd-qIvCT.js";
import { n as emitCliBanner, t as ensureConfigReady } from "./config-guard-Coif1oF6.js";
import path from "node:path";
import process$1 from "node:process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

//#region src/cli/program/routes.ts
const routeHealth = {
	match: (path) => path[0] === "health",
	loadPlugins: true,
	run: async (argv) => {
		const json = hasFlag(argv, "--json");
		const verbose = getVerboseFlag(argv, { includeDebug: true });
		const timeoutMs = getPositiveIntFlagValue(argv, "--timeout");
		if (timeoutMs === null) return false;
		const { healthCommand } = await import("./health-kuZS8TS7.js").then((n) => n.i);
		await healthCommand({
			json,
			timeoutMs,
			verbose
		}, defaultRuntime);
		return true;
	}
};
const routeStatus = {
	match: (path) => path[0] === "status",
	loadPlugins: true,
	run: async (argv) => {
		const json = hasFlag(argv, "--json");
		const deep = hasFlag(argv, "--deep");
		const all = hasFlag(argv, "--all");
		const usage = hasFlag(argv, "--usage");
		const verbose = getVerboseFlag(argv, { includeDebug: true });
		const timeoutMs = getPositiveIntFlagValue(argv, "--timeout");
		if (timeoutMs === null) return false;
		const { statusCommand } = await import("./status-D8ZdyZZM.js").then((n) => n.t);
		await statusCommand({
			json,
			deep,
			all,
			usage,
			timeoutMs,
			verbose
		}, defaultRuntime);
		return true;
	}
};
const routeSessions = {
	match: (path) => path[0] === "sessions",
	run: async (argv) => {
		const json = hasFlag(argv, "--json");
		const store = getFlagValue(argv, "--store");
		if (store === null) return false;
		const active = getFlagValue(argv, "--active");
		if (active === null) return false;
		const { sessionsCommand } = await import("./sessions-CjMS_pWM.js").then((n) => n.n);
		await sessionsCommand({
			json,
			store,
			active
		}, defaultRuntime);
		return true;
	}
};
const routeAgentsList = {
	match: (path) => path[0] === "agents" && path[1] === "list",
	run: async (argv) => {
		const json = hasFlag(argv, "--json");
		const bindings = hasFlag(argv, "--bindings");
		const { agentsListCommand } = await import("./agents-B8An3iQ9.js").then((n) => n.t);
		await agentsListCommand({
			json,
			bindings
		}, defaultRuntime);
		return true;
	}
};
const routeMemoryStatus = {
	match: (path) => path[0] === "memory" && path[1] === "status",
	run: async (argv) => {
		const agent = getFlagValue(argv, "--agent");
		if (agent === null) return false;
		const json = hasFlag(argv, "--json");
		const deep = hasFlag(argv, "--deep");
		const index = hasFlag(argv, "--index");
		const verbose = hasFlag(argv, "--verbose");
		const { runMemoryStatus } = await import("./memory-cli-CbQlPAUy.js").then((n) => n.t);
		await runMemoryStatus({
			agent,
			json,
			deep,
			index,
			verbose
		});
		return true;
	}
};
function getCommandPositionals(argv) {
	const out = [];
	const args = argv.slice(2);
	for (const arg of args) {
		if (!arg || arg === "--") break;
		if (arg.startsWith("-")) continue;
		out.push(arg);
	}
	return out;
}
const routes = [
	routeHealth,
	routeStatus,
	routeSessions,
	routeAgentsList,
	routeMemoryStatus,
	{
		match: (path) => path[0] === "config" && path[1] === "get",
		run: async (argv) => {
			const pathArg = getCommandPositionals(argv)[2];
			if (!pathArg) return false;
			const json = hasFlag(argv, "--json");
			const { runConfigGet } = await import("./config-cli-DsUdhobv.js").then((n) => n.t);
			await runConfigGet({
				path: pathArg,
				json
			});
			return true;
		}
	},
	{
		match: (path) => path[0] === "config" && path[1] === "unset",
		run: async (argv) => {
			const pathArg = getCommandPositionals(argv)[2];
			if (!pathArg) return false;
			const { runConfigUnset } = await import("./config-cli-DsUdhobv.js").then((n) => n.t);
			await runConfigUnset({ path: pathArg });
			return true;
		}
	}
];
function findRoutedCommand(path) {
	for (const route of routes) if (route.match(path)) return route;
	return null;
}

//#endregion
//#region src/cli/route.ts
async function prepareRoutedCommand(params) {
	emitCliBanner(VERSION, { argv: params.argv });
	await ensureConfigReady({
		runtime: defaultRuntime,
		commandPath: params.commandPath
	});
	if (params.loadPlugins) ensurePluginRegistryLoaded();
}
async function tryRouteCli(argv) {
	if (isTruthyEnvValue(process.env.OPENCLAW_DISABLE_ROUTE_FIRST)) return false;
	if (hasHelpOrVersion(argv)) return false;
	const path = getCommandPath(argv, 2);
	if (!path[0]) return false;
	const route = findRoutedCommand(path);
	if (!route) return false;
	await prepareRoutedCommand({
		argv,
		commandPath: path,
		loadPlugins: route.loadPlugins
	});
	return route.run(argv);
}

//#endregion
//#region src/cli/run-main.ts
function rewriteUpdateFlagArgv(argv) {
	const index = argv.indexOf("--update");
	if (index === -1) return argv;
	const next = [...argv];
	next.splice(index, 1, "update");
	return next;
}
function shouldRegisterPrimarySubcommand(argv) {
	return !hasHelpOrVersion(argv);
}
function shouldSkipPluginCommandRegistration(params) {
	if (!hasHelpOrVersion(params.argv)) return false;
	if (!params.primary) return true;
	return params.hasBuiltinPrimary;
}
async function runCli(argv = process$1.argv) {
	const normalizedArgv = stripWindowsNodeExec(argv);
	loadDotEnv({ quiet: true });
	normalizeEnv();
	ensureOpenClawCliOnPath();
	assertSupportedRuntime();
	if (await tryRouteCli(normalizedArgv)) return;
	enableConsoleCapture();
	const { buildProgram } = await import("./program-D_8oWrth.js");
	const program = buildProgram();
	installUnhandledRejectionHandler();
	process$1.on("uncaughtException", (error) => {
		console.error("[openclaw] Uncaught exception:", formatUncaughtError(error));
		process$1.exit(1);
	});
	const parseArgv = rewriteUpdateFlagArgv(normalizedArgv);
	const primary = getPrimaryCommand(parseArgv);
	if (primary && shouldRegisterPrimarySubcommand(parseArgv)) {
		const { registerSubCliByName } = await import("./register.subclis-B58Jr0WP.js").then((n) => n.i);
		await registerSubCliByName(program, primary);
	}
	if (!shouldSkipPluginCommandRegistration({
		argv: parseArgv,
		primary,
		hasBuiltinPrimary: primary !== null && program.commands.some((command) => command.name() === primary)
	})) {
		const { registerPluginCliCommands } = await import("./cli-DTJQCATX.js");
		const { loadConfig } = await import("./config-DERbrvBI.js").then((n) => n.t);
		registerPluginCliCommands(program, loadConfig());
	}
	await program.parseAsync(parseArgv);
}
function stripWindowsNodeExec(argv) {
	if (process$1.platform !== "win32") return argv;
	const stripControlChars = (value) => {
		let out = "";
		for (let i = 0; i < value.length; i += 1) {
			const code = value.charCodeAt(i);
			if (code >= 32 && code !== 127) out += value[i];
		}
		return out;
	};
	const normalizeArg = (value) => stripControlChars(value).replace(/^['"]+|['"]+$/g, "").trim();
	const normalizeCandidate = (value) => normalizeArg(value).replace(/^\\\\\\?\\/, "");
	const execPath = normalizeCandidate(process$1.execPath);
	const execPathLower = execPath.toLowerCase();
	const execBase = path.basename(execPath).toLowerCase();
	const isExecPath = (value) => {
		if (!value) return false;
		const normalized = normalizeCandidate(value);
		if (!normalized) return false;
		const lower = normalized.toLowerCase();
		return lower === execPathLower || path.basename(lower) === execBase || lower.endsWith("\\node.exe") || lower.endsWith("/node.exe") || lower.includes("node.exe") || path.basename(lower) === "node.exe" && fs.existsSync(normalized);
	};
	const filtered = argv.filter((arg, index) => index === 0 || !isExecPath(arg));
	if (filtered.length < 3) return filtered;
	const cleaned = [...filtered];
	if (isExecPath(cleaned[1])) cleaned.splice(1, 1);
	if (isExecPath(cleaned[2])) cleaned.splice(2, 1);
	return cleaned;
}

//#endregion
export { runCli };