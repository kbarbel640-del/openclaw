import DOMPurify from "dompurify";
import { marked } from "marked";
import { truncateText } from "./format.ts";

// ---------------------------------------------------------------------------
// Mermaid: lazy loading + DOM-based rendering via MutationObserver
// ---------------------------------------------------------------------------

let mermaidInstance: typeof import("mermaid").default | null = null;
let mermaidLoading: Promise<typeof import("mermaid").default> | null = null;
let mermaidObserverActive = false;

async function ensureMermaid(): Promise<typeof import("mermaid").default> {
  if (mermaidInstance) {
    return mermaidInstance;
  }
  if (!mermaidLoading) {
    mermaidLoading = import("mermaid").then((mod) => {
      mermaidInstance = mod.default;
      mermaidInstance.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "strict",
        maxTextSize: 50_000,
        fontFamily: "inherit",
      });
      return mermaidInstance;
    });
  }
  return mermaidLoading;
}

/**
 * Start watching the DOM for `.mermaid-placeholder` elements and render
 * Mermaid diagrams into them.  Call once at application startup.
 *
 * Because Mermaid SVG is injected directly into the DOM (bypassing
 * DOMPurify), the library's own `securityLevel: "strict"` provides XSS
 * protection while keeping all SVG attributes intact.
 */
export function initMermaidRenderer(): void {
  if (mermaidObserverActive) {
    return;
  }
  mermaidObserverActive = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          schedulePlaceholderScan(node);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Process any placeholders already in the DOM.
  schedulePlaceholderScan(document.body);
}

// Batch DOM scans into a single animation frame to avoid layout thrashing.
let scanScheduled = false;
let scanRoots: HTMLElement[] = [];

function schedulePlaceholderScan(root: HTMLElement): void {
  scanRoots.push(root);
  if (scanScheduled) {
    return;
  }
  scanScheduled = true;
  requestAnimationFrame(() => {
    const roots = scanRoots;
    scanRoots = [];
    scanScheduled = false;
    for (const r of roots) {
      processPlaceholdersIn(r);
    }
  });
}

function processPlaceholdersIn(root: HTMLElement): void {
  const selector = ".mermaid-placeholder:not(.mermaid-rendering)";
  if (root.matches?.(selector)) {
    void renderPlaceholder(root);
  }
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    void renderPlaceholder(el);
  }
}

async function renderPlaceholder(el: HTMLElement): Promise<void> {
  const code = el.getAttribute("data-mermaid-code");
  if (!code) {
    return;
  }
  el.classList.add("mermaid-rendering");

  try {
    const mermaid = await ensureMermaid();
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const { svg } = await mermaid.render(id, code);
    el.innerHTML = svg;
    el.className = "mermaid-diagram";
    el.removeAttribute("data-mermaid-code");
  } catch (error) {
    console.error("Mermaid render error:", error);
    el.innerHTML = `<pre class="mermaid-error"><code>${escapeHtml(code)}</code></pre>`;
    el.className = "mermaid-error-container";
  }
}

// ---------------------------------------------------------------------------
// Marked configuration
// ---------------------------------------------------------------------------

marked.setOptions({ gfm: true, breaks: true });

const renderer = new marked.Renderer();
const originalCodeRenderer = renderer.code.bind(renderer);

renderer.code = function ({
  text: code,
  lang: language,
  escaped,
}: {
  text: string;
  lang?: string;
  escaped?: boolean;
  type: string;
  raw: string;
  codeBlockStyle?: string;
}) {
  if (language === "mermaid") {
    // Emit a lightweight placeholder.  The MutationObserver set up by
    // initMermaidRenderer() detects the element after Lit inserts it into
    // the DOM and replaces it with the rendered Mermaid SVG.
    return `<div class="mermaid-placeholder" data-mermaid-code="${escapeHtml(code)}"></div>`;
  }
  return originalCodeRenderer.call(this, {
    text: code,
    lang: language,
    escaped,
    type: "code",
    raw: code,
    codeBlockStyle: undefined,
  });
};

marked.use({ renderer });

// ---------------------------------------------------------------------------
// DOMPurify configuration
// ---------------------------------------------------------------------------

// Only standard HTML elements — no SVG.  Mermaid SVGs are injected directly
// into the DOM after sanitisation, so they never go through DOMPurify.
const allowedTags = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

const allowedAttrs = [
  "class",
  "href",
  "rel",
  "target",
  "title",
  "start",
  // Mermaid placeholder attribute (survives DOMPurify, read in renderPlaceholder)
  "data-mermaid-code",
];

let hooksInstalled = false;

function installHooks() {
  if (hooksInstalled) {
    return;
  }
  hooksInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof HTMLAnchorElement)) {
      return;
    }
    const href = node.getAttribute("href");
    if (!href) {
      return;
    }
    node.setAttribute("rel", "noreferrer noopener");
    node.setAttribute("target", "_blank");
  });
}

// ---------------------------------------------------------------------------
// Markdown rendering (public API)
// ---------------------------------------------------------------------------

const MARKDOWN_CHAR_LIMIT = 140_000;
const MARKDOWN_PARSE_LIMIT = 40_000;
const MARKDOWN_CACHE_LIMIT = 200;
const MARKDOWN_CACHE_MAX_CHARS = 50_000;
const markdownCache = new Map<string, string>();

function getCachedMarkdown(key: string): string | null {
  const cached = markdownCache.get(key);
  if (cached === undefined) {
    return null;
  }
  markdownCache.delete(key);
  markdownCache.set(key, cached);
  return cached;
}

function setCachedMarkdown(key: string, value: string) {
  markdownCache.set(key, value);
  if (markdownCache.size <= MARKDOWN_CACHE_LIMIT) {
    return;
  }
  const oldest = markdownCache.keys().next().value;
  if (oldest) {
    markdownCache.delete(oldest);
  }
}

export async function toSanitizedMarkdownHtml(markdown: string): Promise<string> {
  const input = markdown.trim();
  if (!input) {
    return "";
  }
  installHooks();
  if (input.length <= MARKDOWN_CACHE_MAX_CHARS) {
    const cached = getCachedMarkdown(input);
    if (cached !== null) {
      return cached;
    }
  }
  const truncated = truncateText(input, MARKDOWN_CHAR_LIMIT);
  const suffix = truncated.truncated
    ? `\n\n… truncated (${truncated.total} chars, showing first ${truncated.text.length}).`
    : "";
  if (truncated.text.length > MARKDOWN_PARSE_LIMIT) {
    const escaped = escapeHtml(`${truncated.text}${suffix}`);
    const htmlStr = `<pre class="code-block">${escaped}</pre>`;
    const sanitized = DOMPurify.sanitize(htmlStr, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: allowedAttrs,
    });
    if (input.length <= MARKDOWN_CACHE_MAX_CHARS) {
      setCachedMarkdown(input, sanitized);
    }
    return sanitized;
  }
  const rendered = marked.parse(`${truncated.text}${suffix}`) as string;
  // Mermaid placeholders are plain <div>s that survive DOMPurify unchanged.
  // The actual SVG rendering is deferred until the element is in the DOM
  // (handled by the MutationObserver from initMermaidRenderer).
  const sanitized = DOMPurify.sanitize(rendered, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
  });
  if (input.length <= MARKDOWN_CACHE_MAX_CHARS) {
    setCachedMarkdown(input, sanitized);
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
