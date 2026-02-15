import { z } from "zod";
import { zodToToolJsonSchema } from "../schema/zod-tool-schema.js";

const BROWSER_ACT_KINDS = [
  "click",
  "type",
  "press",
  "hover",
  "drag",
  "select",
  "fill",
  "resize",
  "wait",
  "evaluate",
  "close",
] as const;

const BROWSER_TOOL_ACTIONS = [
  "status",
  "start",
  "stop",
  "profiles",
  "tabs",
  "open",
  "focus",
  "close",
  "snapshot",
  "screenshot",
  "navigate",
  "console",
  "pdf",
  "upload",
  "dialog",
  "act",
] as const;

const BROWSER_TARGETS = ["sandbox", "host", "node"] as const;

const BROWSER_SNAPSHOT_FORMATS = ["aria", "ai"] as const;
const BROWSER_SNAPSHOT_MODES = ["efficient"] as const;
const BROWSER_SNAPSHOT_REFS = ["role", "aria"] as const;

const BROWSER_IMAGE_TYPES = ["png", "jpeg"] as const;

// NOTE: Using a flattened object schema instead of Type.Union([Type.Object(...), ...])
// because Claude API on Vertex AI rejects nested anyOf schemas as invalid JSON Schema.
// The discriminator (kind) determines which properties are relevant; runtime validates.
const BrowserActSchema = z.object({
  kind: z.enum(BROWSER_ACT_KINDS),
  // Common fields
  targetId: z.string().optional(),
  ref: z.string().optional(),
  // click
  doubleClick: z.boolean().optional(),
  button: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
  // type
  text: z.string().optional(),
  submit: z.boolean().optional(),
  slowly: z.boolean().optional(),
  // press
  key: z.string().optional(),
  // drag
  startRef: z.string().optional(),
  endRef: z.string().optional(),
  // select
  values: z.array(z.string()).optional(),
  // fill - use permissive array of objects
  fields: z.array(z.object({}).passthrough()).optional(),
  // resize
  width: z.number().optional(),
  height: z.number().optional(),
  // wait
  timeMs: z.number().optional(),
  textGone: z.string().optional(),
  // evaluate
  fn: z.string().optional(),
});

// IMPORTANT: OpenAI function tool schemas must have a top-level `type: "object"`.
// A root-level `Type.Union([...])` compiles to `{ anyOf: [...] }` (no `type`),
// which OpenAI rejects ("Invalid schema ... type: None"). Keep this schema an object.
export const BrowserToolSchema = zodToToolJsonSchema(
  z.object({
    action: z.enum(BROWSER_TOOL_ACTIONS),
    target: z.enum(BROWSER_TARGETS).optional(),
    node: z.string().optional(),
    profile: z.string().optional(),
    targetUrl: z.string().optional(),
    targetId: z.string().optional(),
    limit: z.number().optional(),
    maxChars: z.number().optional(),
    mode: z.enum(BROWSER_SNAPSHOT_MODES).optional(),
    snapshotFormat: z.enum(BROWSER_SNAPSHOT_FORMATS).optional(),
    refs: z.enum(BROWSER_SNAPSHOT_REFS).optional(),
    interactive: z.boolean().optional(),
    compact: z.boolean().optional(),
    depth: z.number().optional(),
    selector: z.string().optional(),
    frame: z.string().optional(),
    labels: z.boolean().optional(),
    fullPage: z.boolean().optional(),
    ref: z.string().optional(),
    element: z.string().optional(),
    type: z.enum(BROWSER_IMAGE_TYPES).optional(),
    level: z.string().optional(),
    paths: z.array(z.string()).optional(),
    inputRef: z.string().optional(),
    timeoutMs: z.number().optional(),
    accept: z.boolean().optional(),
    promptText: z.string().optional(),
    request: BrowserActSchema.optional(),
  }),
);
