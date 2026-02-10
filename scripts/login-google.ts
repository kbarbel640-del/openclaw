#!/usr/bin/env -S node --experimental-strip-types
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { chromium } from "playwright-core";

type BrowserKind = "brave" | "canary" | "chromium" | "chrome" | "edge";
type BrowserExecutable = {
  kind: BrowserKind;
  path: string;
};

type Args = {
  mode: "launch" | "cdp";
  out: string;
  url: string;
  channel: string;
  cdpPort: number;
  userDataDir: string;
  close: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: "launch",
    out: "google-state.json",
    url: "https://mail.google.com/",
    channel: "chrome",
    cdpPort: 9222,
    userDataDir: ".local/google-user-data",
    close: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mode") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --mode");
      }
      if (value !== "launch" && value !== "cdp") {
        throw new Error(`Invalid --mode: ${value}`);
      }
      args.mode = value;
      i++;
      continue;
    }
    if (arg === "--out") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --out");
      }
      args.out = value;
      i++;
      continue;
    }
    if (arg === "--url") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --url");
      }
      args.url = value;
      i++;
      continue;
    }
    if (arg === "--channel") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --channel");
      }
      args.channel = value;
      i++;
      continue;
    }
    if (arg === "--cdp-port") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --cdp-port");
      }
      const port = Number.parseInt(value, 10);
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid --cdp-port: ${value}`);
      }
      args.cdpPort = port;
      i++;
      continue;
    }
    if (arg === "--user-data-dir") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --user-data-dir");
      }
      args.userDataDir = value;
      i++;
      continue;
    }
    if (arg === "--no-close") {
      args.close = false;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node --experimental-strip-types scripts/login-google.ts [options]",
          "",
          "Options:",
          "  --mode <launch|cdp>      Browser startup mode (default: launch)",
          "  --out <path>             Output storageState JSON (default: google-state.json)",
          "  --url <url>              Start URL (default: https://mail.google.com/)",
          "  --channel <name>         Browser channel in launch mode (default: chrome)",
          "  --cdp-port <port>        CDP port in cdp mode (default: 9222)",
          "  --user-data-dir <path>   Chrome user profile dir in cdp mode",
          "                           (default: .local/google-user-data)",
          "  --no-close               Keep browser running after export in cdp mode",
        ].join("\n"),
      );
      process.exit(0);
    }

    throw new Error(`Unknown arg: ${arg}`);
  }

  return args;
}

function detectBrowserExecutable(): BrowserExecutable | null {
  const joinWin = path.win32.join;
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";

  const windowsCandidates: Array<BrowserExecutable> = [
    ...(localAppData
      ? [
          {
            kind: "chrome" as const,
            path: joinWin(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
          },
          {
            kind: "edge" as const,
            path: joinWin(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
          },
          {
            kind: "brave" as const,
            path: joinWin(
              localAppData,
              "BraveSoftware",
              "Brave-Browser",
              "Application",
              "brave.exe",
            ),
          },
          {
            kind: "canary" as const,
            path: joinWin(localAppData, "Google", "Chrome SxS", "Application", "chrome.exe"),
          },
        ]
      : []),
    {
      kind: "chrome",
      path: joinWin(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    },
    {
      kind: "chrome",
      path: joinWin(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    },
    {
      kind: "edge",
      path: joinWin(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    },
    {
      kind: "edge",
      path: joinWin(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    },
    {
      kind: "brave",
      path: joinWin(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    },
    {
      kind: "brave",
      path: joinWin(programFilesX86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    },
  ];

  const macCandidates: Array<BrowserExecutable> = [
    {
      kind: "chrome",
      path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    {
      kind: "chrome",
      path: path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    },
    {
      kind: "edge",
      path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    },
    {
      kind: "brave",
      path: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    },
    {
      kind: "chromium",
      path: "/Applications/Chromium.app/Contents/MacOS/Chromium",
    },
  ];

  const linuxCandidates: Array<BrowserExecutable> = [
    { kind: "chrome", path: "/usr/bin/google-chrome" },
    { kind: "chrome", path: "/usr/bin/google-chrome-stable" },
    { kind: "edge", path: "/usr/bin/microsoft-edge" },
    { kind: "edge", path: "/usr/bin/microsoft-edge-stable" },
    { kind: "brave", path: "/usr/bin/brave-browser" },
    { kind: "chromium", path: "/usr/bin/chromium" },
    { kind: "chromium", path: "/usr/bin/chromium-browser" },
  ];

  const candidates =
    process.platform === "win32"
      ? windowsCandidates
      : process.platform === "darwin"
        ? macCandidates
        : process.platform === "linux"
          ? linuxCandidates
          : [];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate.path)) {
      return candidate;
    }
  }

  return null;
}

async function ensurePortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = net
      .createServer()
      .once("error", (err) => reject(err))
      .once("listening", () => {
        server.close(() => resolve());
      })
      .listen(port, "127.0.0.1");
  });
}

async function promptEnter(message: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(message);
  rl.close();
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForCdpReady(cdpUrl: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  const versionUrl = new URL("/json/version", cdpUrl).toString();

  while (Date.now() < deadline) {
    try {
      const response = await fetch(versionUrl, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // CDP endpoint might not be up yet.
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for Chrome CDP endpoint: ${cdpUrl}`);
}

async function runLaunchMode(args: Args, outPath: string) {
  console.log(`Opening a visible browser for manual login: ${args.url}`);
  console.log("Log in manually, including 2FA.");
  console.log("When your inbox/account page is fully loaded, return here and press Enter.");
  console.log("");

  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: args.channel,
    });
  } catch (error) {
    const message = String((error as Error | undefined)?.message ?? error);
    console.error(message);
    console.error("");
    console.error("Launch mode failed. Try cdp mode instead:");
    console.error(
      "node --experimental-strip-types scripts/login-google.ts --mode cdp --out google-state.json",
    );
    process.exit(1);
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(args.url, { waitUntil: "domcontentloaded" });
  await promptEnter("Press Enter when fully logged in... ");
  await context.storageState({ path: outPath });
  await browser.close();

  console.log(`Saved storageState to ${outPath}`);
}

async function runCdpMode(args: Args, outPath: string) {
  const executable = detectBrowserExecutable();
  if (!executable) {
    throw new Error("No local Chrome/Edge/Brave executable found.");
  }

  await ensurePortAvailable(args.cdpPort);

  const cdpUrl = `http://127.0.0.1:${args.cdpPort}`;
  const userDataDir = path.resolve(args.userDataDir);

  console.log(`Starting normal browser for manual login: ${args.url}`);
  console.log(`Browser: ${executable.kind} (${executable.path})`);
  console.log(`CDP endpoint: ${cdpUrl}`);
  console.log(`User data dir: ${userDataDir}`);
  console.log("");

  const child: ChildProcess = spawn(
    executable.path,
    [
      `--remote-debugging-port=${args.cdpPort}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
      "--hide-crash-restore-bubble",
      args.url,
    ],
    {
      stdio: "ignore",
      windowsHide: false,
    },
  );

  await waitForCdpReady(cdpUrl, 25_000);
  await promptEnter("Press Enter when fully logged in... ");

  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 30_000 });
  const context = browser.contexts()[0] ?? (await browser.newContext());
  await context.storageState({ path: outPath });
  await browser.close();

  if (args.close) {
    try {
      child.kill();
    } catch {
      // Best effort.
    }
  } else {
    console.log("Browser left running because --no-close was used.");
  }

  console.log(`Saved storageState to ${outPath}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const outPath = path.resolve(args.out);

  if (args.mode === "cdp") {
    await runCdpMode(args, outPath);
    return;
  }

  await runLaunchMode(args, outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
