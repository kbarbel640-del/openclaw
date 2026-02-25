import type { CSSProperties } from "react";

export const type = {
  systemMeta: {
    fontFamily: "var(--font-mono)",
    fontWeight: 400,
    fontSize: "11px",
    letterSpacing: "3px",
    textTransform: "uppercase",
  } satisfies CSSProperties,

  label: {
    fontFamily: "var(--font-mono)",
    fontWeight: 500,
    fontSize: "12px",
    letterSpacing: "2px",
    textTransform: "uppercase",
  } satisfies CSSProperties,

  body: {
    fontFamily: "var(--font-sans)",
    fontWeight: 400,
    fontSize: "14px",
    letterSpacing: "0",
    lineHeight: 1.5,
  } satisfies CSSProperties,

  sectionHeader: {
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    fontSize: "16px",
    letterSpacing: "1px",
    textTransform: "uppercase",
  } satisfies CSSProperties,

  screenTitle: {
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    fontSize: "24px",
    letterSpacing: "-0.5px",
    textTransform: "uppercase",
  } satisfies CSSProperties,

  heroNumber: {
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: "48px",
    letterSpacing: "-2px",
  } satisfies CSSProperties,

  statusText: {
    fontFamily: "var(--font-mono)",
    fontWeight: 400,
    fontSize: "10px",
    letterSpacing: "4px",
    textTransform: "uppercase",
  } satisfies CSSProperties,
} as const;
