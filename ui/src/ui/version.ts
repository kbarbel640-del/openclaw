declare const __OPENCLAW_CONTROL_UI_VERSION__: string | undefined;

export const CONTROL_UI_VERSION =
  (typeof __OPENCLAW_CONTROL_UI_VERSION__ === "string" && __OPENCLAW_CONTROL_UI_VERSION__.trim()) ||
  "dev";
