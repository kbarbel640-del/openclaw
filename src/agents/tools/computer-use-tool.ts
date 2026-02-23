/**
 * computer-use-tool.ts
 *
 * Bridges Claude's native computer_use API action format to Peekaboo CLI
 * commands, enabling structured screen control alongside the existing
 * Peekaboo skill (which exposes the raw CLI to the agent via bash).
 *
 * Actions: screenshot | click | type | key | scroll | move | see | app
 *
 * Wire-up: add createComputerUseTool() to createClawdiaTools() in openclaw-tools.ts.
 */

import * as os from "node:os";
import * as path from "node:path";
import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { runExec } from "../../process/exec.js";
import { resolveImageSanitizationLimits } from "../image-sanitization.js";
import { optionalStringEnum, stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, imageResultFromFile, jsonResult, readStringParam } from "./common.js";

const log = createSubsystemLogger("computer-use");

const COMPUTER_USE_ACTIONS = [
  "screenshot", // Capture the full screen and return as an image
  "click", // Click at coordinates or element ID
  "type", // Type text (optionally press Return after)
  "key", // Press a key combo via hotkey (e.g. "cmd,c")
  "scroll", // Scroll at coordinates
  "move", // Move the cursor
  "see", // Annotated UI map with element IDs
  "app", // Launch / quit / hide / switch apps
] as const;

const SCROLL_DIRECTIONS = ["up", "down", "left", "right"] as const;
const APP_ACTIONS = ["launch", "quit", "hide", "show", "switch"] as const;

const ComputerUseToolSchema = Type.Object({
  action: stringEnum(COMPUTER_USE_ACTIONS, {
    description:
      "The action to perform. 'screenshot' captures the screen; 'see' returns an annotated UI map with element IDs you can target with click/type.",
  }),

  // Coordinate targeting (click, scroll, move)
  x: Type.Optional(Type.Number({ description: "X coordinate in screen pixels." })),
  y: Type.Optional(Type.Number({ description: "Y coordinate in screen pixels." })),

  // Element targeting (click, type)
  elementId: Type.Optional(
    Type.String({
      description:
        "Peekaboo element ID from a prior 'see' action (e.g. B1, T3). Preferred over coords when available.",
    }),
  ),

  // type
  text: Type.Optional(Type.String({ description: "Text to type. Required for 'type' action." })),
  pressReturn: Type.Optional(
    Type.Boolean({ description: "If true, press Return after typing. Default false." }),
  ),

  // key (hotkey)
  keys: Type.Optional(
    Type.String({
      description:
        "Comma-separated modifier+key combo for 'key' action (e.g. 'cmd,c', 'cmd,shift,4'). Required for 'key'.",
    }),
  ),

  // scroll
  direction: optionalStringEnum(SCROLL_DIRECTIONS, {
    description: "Scroll direction. Required for 'scroll' action.",
  }),
  amount: Type.Optional(
    Type.Number({ description: "Number of scroll ticks (default 3). Used with 'scroll'." }),
  ),

  // see / screenshot
  annotate: Type.Optional(
    Type.Boolean({
      description:
        "If true (default for 'see'), overlay element ID annotations on the captured image.",
    }),
  ),
  analyze: Type.Optional(
    Type.String({
      description: "Optional vision prompt to analyze the screenshot or 'see' image.",
    }),
  ),

  // app
  appName: Type.Optional(
    Type.String({ description: "Application name or bundle ID. Required for 'app' action." }),
  ),
  appAction: optionalStringEnum(APP_ACTIONS, {
    description: "App lifecycle action. Required for 'app' action.",
  }),

  // Window / screen targeting (shared)
  windowTitle: Type.Optional(Type.String({ description: "Partial window title to target." })),
  screenIndex: Type.Optional(Type.Number({ description: "Screen index (0 = primary)." })),
});

/** Resolves a temp path for screenshot output. */
function tempScreenshotPath(): string {
  return path.join(os.tmpdir(), `clawdia-screenshot-${Date.now()}.png`);
}

/** Builds the peekaboo argv for a given action and params. */
function buildPeekabooArgv(
  action: (typeof COMPUTER_USE_ACTIONS)[number],
  params: Record<string, unknown>,
): string[] {
  const argv: string[] = [];

  const coordsArg = (): string[] => {
    const x = params.x;
    const y = params.y;
    return typeof x === "number" && typeof y === "number" ? ["--coords", `${x},${y}`] : [];
  };

  const appFlag = (): string[] => {
    const name = readStringParam(params, "appName");
    return name ? ["--app", name] : [];
  };

  const windowTitleFlag = (): string[] => {
    const t = readStringParam(params, "windowTitle");
    return t ? ["--window-title", t] : [];
  };

  const screenIndexFlag = (): string[] => {
    const idx = params.screenIndex;
    return typeof idx === "number" ? ["--screen-index", String(idx)] : [];
  };

  switch (action) {
    case "screenshot": {
      const outPath = tempScreenshotPath();
      argv.push("image", "--mode", "screen", "--format", "png", "--path", outPath);
      argv.push(...screenIndexFlag(), ...appFlag(), ...windowTitleFlag());
      const analyzePrompt = readStringParam(params, "analyze");
      if (analyzePrompt) {
        argv.push("--analyze", analyzePrompt);
      }
      argv.push("--json");
      // Attach the output path as a custom marker so execute() can read the file.
      // We embed it at the end as a sentinel; execute() extracts it before running.
      argv.push("__outpath__", outPath);
      break;
    }

    case "click": {
      argv.push("click");
      const elementId = readStringParam(params, "elementId");
      if (elementId) {
        argv.push("--on", elementId);
      } else {
        argv.push(...coordsArg());
      }
      argv.push(...appFlag(), ...windowTitleFlag(), "--json");
      break;
    }

    case "type": {
      const text = readStringParam(params, "text") ?? "";
      argv.push("type", text);
      if (params.pressReturn === true) {
        argv.push("--return");
      }
      argv.push(...appFlag(), "--json");
      break;
    }

    case "key": {
      const keys = readStringParam(params, "keys");
      if (!keys) {
        throw new Error("keys required for 'key' action");
      }
      argv.push("hotkey", "--keys", keys, "--json");
      break;
    }

    case "scroll": {
      const dir = readStringParam(params, "direction") ?? "down";
      const amount = typeof params.amount === "number" ? params.amount : 3;
      argv.push("scroll", "--direction", dir, "--amount", String(amount));
      argv.push(...coordsArg(), ...appFlag(), ...windowTitleFlag(), "--json");
      break;
    }

    case "move": {
      argv.push("move", ...coordsArg(), "--json");
      break;
    }

    case "see": {
      const annotate = params.annotate !== false; // default true
      const outPath = tempScreenshotPath();
      argv.push("see", "--path", outPath);
      if (annotate) {
        argv.push("--annotate");
      }
      argv.push(...appFlag(), ...windowTitleFlag());
      const analyzePrompt = readStringParam(params, "analyze");
      if (analyzePrompt) {
        argv.push("--analyze", analyzePrompt);
      }
      argv.push("--json");
      argv.push("__outpath__", outPath);
      break;
    }

    case "app": {
      const appAction = readStringParam(params, "appAction");
      if (!appAction) {
        throw new Error("appAction required for 'app' action");
      }
      const name = readStringParam(params, "appName");
      if (!name) {
        throw new Error("appName required for 'app' action");
      }
      argv.push("app", "--action", appAction, "--name", name, "--json");
      break;
    }

    default:
      throw new Error(`Unknown computer_use action: ${String(action)}`);
  }

  return argv;
}

export function createComputerUseTool(options?: { config?: OpenClawConfig }): AnyAgentTool {
  const imageSanitization = resolveImageSanitizationLimits(options?.config);

  return {
    label: "Computer Use",
    name: "computer_use",
    description:
      "Control the Mac screen: capture screenshots, click, type, press keys, scroll, inspect UI elements, and manage apps. " +
      "Use 'see' to get an annotated UI map with element IDs, then 'click' or 'type' targeting those IDs. " +
      "Requires Peekaboo CLI (peekaboo) and macOS Accessibility + Screen Recording permissions.",
    parameters: ComputerUseToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", {
        required: true,
      }) as (typeof COMPUTER_USE_ACTIONS)[number];

      const fullArgv = buildPeekabooArgv(action, params);

      // Extract the sentinel output path before running the command.
      let outPath: string | undefined;
      const sentinelIdx = fullArgv.indexOf("__outpath__");
      if (sentinelIdx !== -1) {
        outPath = fullArgv[sentinelIdx + 1];
        fullArgv.splice(sentinelIdx, 2);
      }

      log.debug("computer_use: running peekaboo", { action, argv: fullArgv.join(" ") });

      let stdout: string;
      let stderr: string;
      try {
        ({ stdout, stderr } = await runExec("peekaboo", fullArgv, { timeoutMs: 30_000 }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonResult({ error: `peekaboo failed: ${msg}`, action });
      }

      if (stderr.trim()) {
        log.debug("computer_use: peekaboo stderr", { stderr: stderr.trim() });
      }

      // Actions that produce an image file.
      if (outPath && (action === "screenshot" || action === "see")) {
        let jsonMeta: Record<string, unknown> = {};
        if (stdout.trim()) {
          try {
            jsonMeta = JSON.parse(stdout.trim()) as Record<string, unknown>;
          } catch {
            // ignore parse errors — image is the primary result
          }
        }
        return await imageResultFromFile({
          label: `computer_use:${action}`,
          path: outPath,
          extraText:
            action === "see" ? "UI map captured. Element IDs shown in annotations." : undefined,
          details: { action, ...jsonMeta },
          imageSanitization,
        });
      }

      // All other actions return JSON.
      let payload: unknown = { ok: true };
      if (stdout.trim()) {
        try {
          payload = JSON.parse(stdout.trim());
        } catch {
          payload = { ok: true, output: stdout.trim() };
        }
      }

      return jsonResult(payload);
    },
  };
}
