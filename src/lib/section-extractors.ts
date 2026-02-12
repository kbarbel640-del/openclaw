import { parseHTML } from "linkedom";
import { ResearchDoc, Section, ResearchDocSchema } from "./section-schema.js";

function normalizeText(s: string) {
  return s.replace(/\r\n/g, "\n").trim();
}

function splitByHeadingsFromMarkdown(md: string): Section[] {
  // Simple heuristic: split by H2 / H3 (lines starting with '##')
  const lines = md.split(/\r?\n/);
  const sections: Section[] = [];
  let currentTitle: string | undefined;
  let buf: string[] = [];

  const pushBuf = () => {
    if (buf.length === 0) {
      return;
    }
    sections.push({ title: currentTitle, text: normalizeText(buf.join("\n")) });
    buf = [];
  };

  for (const line of lines) {
    const h2 = line.match(/^##+\s+(.*)$/);
    if (h2) {
      pushBuf();
      currentTitle = h2[1].trim();
      continue;
    }
    buf.push(line);
  }
  pushBuf();
  return sections;
}

function plainTextFallback(text: string): Section[] {
  // Split into chunks by double-newline; make first chunk 'Context' if no headings
  const parts = text
    .split(/\n\s*\n/)
    .map(normalizeText)
    .filter(Boolean);
  if (parts.length === 0) {
    return [];
  }
  if (parts.length === 1) {
    return [
      { title: "Background", text: parts[0] },
      { title: "Next steps", text: "(Please add acceptance criteria / testing notes)" },
    ];
  }
  const out: Section[] = [];
  out.push({ title: "Background", text: parts[0] });
  if (parts.length > 1) {
    out.push({ title: "Findings", text: parts.slice(1, Math.min(3, parts.length)).join("\n\n") });
  }
  if (parts.length > 3) {
    out.push({ title: "More details", text: parts.slice(3).join("\n\n") });
  }
  return out;
}

export function extractSectionsFromMarkdownOrText(input: string, maxSections = 6): Section[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  // If it looks like HTML, parse and extract headings
  const isHtml = /<\/?\w+[^>]*>/.test(trimmed);
  if (isHtml) {
    try {
      const win = parseHTML(trimmed) as unknown as Window & { document: Document };
      const doc = win.document;
      const headings = Array.from(doc.querySelectorAll("h1,h2,h3"));
      if (headings.length) {
        const sections: Section[] = [];
        for (const h of headings) {
          const title = (h.textContent || "").trim() || undefined;
          let text = "";
          let sibling = h.nextElementSibling;
          while (sibling && !/^H[1-3]$/.test(sibling.tagName)) {
            text += "\n" + (sibling.textContent || "");
            sibling = sibling.nextElementSibling;
          }
          sections.push({ title, text: normalizeText(text) });
          if (sections.length >= maxSections) {
            break;
          }
        }
        if (sections.length) {
          return sections;
        }
      }
    } catch {
      // fall through to markdown heuristics
    }
  }

  // Markdown heading splitter
  if (/^#{2,}\s+/m.test(trimmed)) {
    const secs = splitByHeadingsFromMarkdown(trimmed)
      .slice(0, maxSections)
      .filter((s) => s.text.length > 0);
    if (secs.length) {
      return secs;
    }
  }

  // Plain text fallback
  return plainTextFallback(trimmed).slice(0, maxSections);
}

export function buildResearchDocFromInput(params: {
  title?: string;
  summary?: string;
  input: string;
  template?: string;
}) {
  const sections = extractSectionsFromMarkdownOrText(params.input);
  const doc: ResearchDoc = {
    title: params.title ?? sections[0]?.title ?? "Untitled research",
    summary: params.summary,
    sections,
    template: params.template,
    provenance: { method: "headings" },
    schemaVersion: "research.v1",
  } as const;
  const parsed = ResearchDocSchema.parse(doc);
  return parsed;
}
