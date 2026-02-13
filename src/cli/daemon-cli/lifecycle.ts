import type { DaemonLifecycleOptions } from "./types.js";
import { resolveIsNixMode } from "../../config/paths.js";
import { resolveGatewayService } from "../../daemon/service.js";
import { renderWindowsGatewayHints } from "../../daemon/windows-hints.js";
import { defaultRuntime } from "../../runtime.js";
import { buildDaemonServiceSnapshot, createNullWriter, emitDaemonActionJson } from "./response.js";
import { renderGatewayServiceStartHints } from "./shared.js";
import { formatCliCommand } from "../command-format.js";

export async function runDaemonUninstall(opts: DaemonLifecycleOptions = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = (payload: {
    ok: boolean;
    result?: string;
    message?: string;
    error?: string;
    service?: {
      label: string;
      loaded: boolean;
      loadedText: string;
      notLoadedText: string;
    };
  }) => {
    if (!json) {
      return;
    }
    emitDaemonActionJson({ action: "uninstall", ...payload });
  };
  const fail = (message: string) => {
    if (json) {
      emit({ ok: false, error: message });
    } else {
      defaultRuntime.error(message);
    }
    defaultRuntime.exit(1);
  };

  if (resolveIsNixMode(process.env)) {
    fail("Nix mode detected; service uninstall is disabled.");
    return;
  }

  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch {
    loaded = false;
  }
  if (loaded) {
    try {
      await service.stop({ env: process.env, stdout });
    } catch {
      // Best-effort stop; final loaded check gates success.
    }
  }
  try {
    await service.uninstall({ env: process.env, stdout });
  } catch (err) {
    fail(`Gateway uninstall failed: ${String(err)}`);
    return;
  }

  loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch {
    loaded = false;
  }
  if (loaded) {
    fail("Gateway service still loaded after uninstall.");
    return;
  }
  emit({
    ok: true,
    result: "uninstalled",
    service: buildDaemonServiceSnapshot(service, loaded),
  });
}

export async function runDaemonStart(opts: DaemonLifecycleOptions = {}) {
  const json = Boolean(opts.json);
  const stdout = json ? createNullWriter() : process.stdout;
  const emit = (payload: {
    ok: boolean;
    result?: string;
    message?: string;
    error?: string;
    hints?: string[];
    service?: {
      label: string;
      loaded: boolean;
      loadedText: string;
      notLoadedText: string;
    };
  }) => {
    if (!json) {
      return;
    }
    emitDaemonActionJson({ action: "start", ...payload });
  };
  const fail = (message: string, hints?: string[]) => {
    if (json) {
      emit({ ok: false, error: message, hints });
    } else {
      defaultRuntime.error(message);
    }
    defaultRuntime.exit(1);
  };

  const service = resolveGatewayService();
  let loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch (err) {
    fail(`Gateway service check failed: ${String(err)}`);
    return;
  }

  if (loaded) {
    try {
      await service.restart({ env: process.env, stdout });
    } catch (err) {
      fail(`Gateway restart failed: ${String(err)}`);
      return;
    }
    emit({
      ok: true,
      result: "restarted",
      service: buildDaemonServiceSnapshot(service, true),
    });
    return;
  }

  if (!json) {
    console.log(
      `Gateway service ${service.label} is ${service.notLoadedText}. Installing...`,
    );
    console.log(
      `Running: ${formatCliCommand("openclaw gateway run")} as Windows Task Scheduler task`,
    );
  }

  try {
    await service.install({
      env: process.env,
      stdout,
      programArguments: ["gateway", "run"],
    });
  } catch (err) {
    fail(`Gateway service install failed: ${String(err)}`, renderWindowsGatewayHints());
    return;
  }

  if (!json) {
    console.log(`Gateway service ${service.label} installed.`);
  }

  try {
    await service.restart({ env: process.env, stdout });
  } catch (err) {
    fail(`Gateway service start failed: ${String(err)}`);
    return;
  }

  loaded = false;
  try {
    loaded = await service.isLoaded({ env: process.env });
  } catch {
    loaded = false;
  }

  const status = await service.readRuntime(process.env);
  if (!json) {
    console.log(`Gateway service: ${renderGatewayServiceStartHints()}`);
    if (status.status === "running") {
      console.log(`  Status: ${status.status}`);
      if (status.pid) {
        console.log(`  PID: ${status.pid}`);
      }
    }
  }

  emit({
    ok: true,
    result: "started",
    service: buildDaemonServiceSnapshot(service, loaded),
  });
}
