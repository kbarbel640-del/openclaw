import type { GatewayServiceRuntime } from "./service-runtime.js";
import {
  installLaunchAgent,
  isLaunchAgentLoaded,
  readLaunchAgentProgramArguments,
  readLaunchAgentRuntime,
  restartLaunchAgent,
  stopLaunchAgent,
  uninstallLaunchAgent,
} from "./launchd.js";
import {
  installWindowsService,
  uninstallWindowsService,
  startWindowsService,
  stopWindowsService,
  isWindowsServiceRunning,
  getWindowsServiceStatus,
} from "./service-windows.js";
import {
  installSystemdService,
  isSystemdServiceEnabled,
  readSystemdServiceExecStart,
  readSystemdServiceRuntime,
  restartSystemdService,
  stopSystemdService,
  uninstallSystemdService,
} from "./systemd.js";

export type GatewayServiceInstallArgs = {
  env: Record<string, string | undefined>;
  stdout: NodeJS.WritableStream;
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string | undefined>;
  description?: string;
};

export type GatewayService = {
  label: string;
  loadedText: string;
  notLoadedText: string;
  install: (args: GatewayServiceInstallArgs) => Promise<void>;
  uninstall: (args: {
    env: Record<string, string | undefined>;
    stdout: NodeJS.WritableStream;
  }) => Promise<void>;
  stop: (args: {
    env?: Record<string, string | undefined>;
    stdout: NodeJS.WritableStream;
  }) => Promise<void>;
  restart: (args: {
    env?: Record<string, string | undefined>;
    stdout: NodeJS.WritableStream;
  }) => Promise<void>;
  isLoaded: (args: { env?: Record<string, string | undefined> }) => Promise<boolean>;
  readCommand: (env: Record<string, string | undefined>) => Promise<{
    programArguments: string[];
    workingDirectory?: string;
    environment?: Record<string, string>;
    sourcePath?: string;
  } | null>;
  readRuntime: (env: Record<string, string | undefined>) => Promise<GatewayServiceRuntime>;
};


// ... imports above ...

export function resolveGatewayService(): GatewayService {
  if (process.platform === "darwin") {
    // ... darwin impl ...
    return {
      label: "LaunchAgent",
      loadedText: "loaded",
      notLoadedText: "not loaded",
      install: async (args) => {
        await installLaunchAgent(args);
      },
      uninstall: async (args) => {
        await uninstallLaunchAgent(args);
      },
      stop: async (args) => {
        await stopLaunchAgent({
          stdout: args.stdout,
          env: args.env,
        });
      },
      restart: async (args) => {
        await restartLaunchAgent({
          stdout: args.stdout,
          env: args.env,
        });
      },
      isLoaded: async (args) => isLaunchAgentLoaded(args),
      readCommand: readLaunchAgentProgramArguments,
      readRuntime: readLaunchAgentRuntime,
    };
  }

  if (process.platform === "linux") {
    // ... linux impl ...
    return {
      label: "systemd",
      loadedText: "enabled",
      notLoadedText: "disabled",
      install: async (args) => {
        await installSystemdService(args);
      },
      uninstall: async (args) => {
        await uninstallSystemdService(args);
      },
      stop: async (args) => {
        await stopSystemdService({
          stdout: args.stdout,
          env: args.env,
        });
      },
      restart: async (args) => {
        await restartSystemdService({
          stdout: args.stdout,
          env: args.env,
        });
      },
      isLoaded: async (args) => isSystemdServiceEnabled(args),
      readCommand: readSystemdServiceExecStart,
      readRuntime: async (env) => await readSystemdServiceRuntime(env),
    };
  }

  if (process.platform === "win32") {
    return {
      label: "Scheduled Task (Windows)",
      loadedText: "installed",
      notLoadedText: "not installed",
      install: async (_args) => {
        await installWindowsService({
            cwd: process.cwd(),
        });
      },
      uninstall: async (_args) => {
        await uninstallWindowsService();
      },
      stop: async (_args) => {
        await stopWindowsService();
      },
      restart: async (_args) => {
        await stopWindowsService();
        await startWindowsService();
      },
      isLoaded: async (_args) => {
          try {
             const status = await getWindowsServiceStatus();
             return status !== "Not Installed";
          } catch {
              return false;
          }
      },
      readCommand: async (_env) => null,
      readRuntime: async (_env) => ({
          pid: undefined, 
          uptimeSeconds: undefined,
          memoryBytes: undefined,
          status: (await isWindowsServiceRunning()) ? "running" : "stopped",
          detail: await getWindowsServiceStatus()
      }),
    };
  }


  throw new Error(`Gateway service install not supported on ${process.platform}`);
}

