import { atom, computed } from "nanostores";
import type { Tab } from "../ui/navigation.ts";
import type { ThemeMode, ResolvedTheme } from "../ui/theme.ts";

// Core app state
export const $connected = atom(false);
export const $tab = atom<Tab>("chat");
export const $onboarding = atom(false);
export const $lastError = atom<string | null>(null);

// Theme state
export const $theme = atom<ThemeMode>("system");
export const $themeResolved = atom<ResolvedTheme>("dark");

// Password state
export const $password = atom("");

// Session state
export const $sessionKey = atom("main");
export const $activeSession = atom<string | null>(null);
export const $sessions = atom<unknown>(null);

// Assistant identity
export const $assistantName = atom("OpenClaw");
export const $assistantAvatar = atom<string | null>(null);
export const $assistantAgentId = atom<string | null>(null);

// Derived state
export const $isOnboarding = computed($onboarding, (onboarding) => onboarding);
export const $hasError = computed($lastError, (error) => error !== null);
