export type ThemeMode = "system" | "light" | "dark" | "midnight" | "graphite" | "aurora";
export type ResolvedTheme = "light" | "dark" | "midnight" | "graphite" | "aurora";

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}
