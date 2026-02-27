/**
 * Convert Markdown tables to Discord Embed objects.
 *
 * Strategy: row-based inline fields (card layout)
 * - Each data row = one inline field
 * - First column = field name (bold)
 * - Remaining columns = stacked as "header: value" lines
 * - Desktop: up to 3 cards side by side
 * - Mobile: cards stack vertically
 *
 * For tables with >25 rows or 1 column: code block fallback
 */

interface TableColumn {
  header: string;
  rows: string[];
}

interface ParsedTable {
  columns: TableColumn[];
  title?: string;
}

export function parseMarkdownTables(text: string): {
  tables: ParsedTable[];
  remainingText: string;
} {
  const tables: ParsedTable[] = [];
  const tableRegex = /(?:\*\*(.+?)\*\*\s*\n)?(\|.+\|[\s\S]*?)(?=\n\n|\n?$|(?=\n(?:[^|]|\n)))/g;

  let match;
  let lastIndex = 0;
  const textParts: string[] = [];

  while ((match = tableRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      textParts.push(text.slice(lastIndex, match.index));
    }
    lastIndex = match.index + match[0].length;

    const title = match[1]?.trim();
    const tableText = match[2].trim();
    const parsedTable = parseSingleTable(tableText);
    if (parsedTable) {
      if (title) {
        parsedTable.title = title;
      }
      tables.push(parsedTable);
    }
  }

  if (lastIndex < text.length) {
    textParts.push(text.slice(lastIndex));
  }

  if (tables.length === 0) {
    return { tables: [], remainingText: text };
  }

  return { tables, remainingText: textParts.join("\n").trim() };
}

function parseSingleTable(tableText: string): ParsedTable | null {
  const lines = tableText.split("\n").filter((line) => line.trim().startsWith("|"));
  if (lines.length < 2) {
    return null;
  }

  const headerCells = parseTableRow(lines[0]);
  if (headerCells.length === 0) {
    return null;
  }

  if (!lines[1].match(/^\|[\s\-:|]+\|$/)) {
    return null;
  }

  const columns: TableColumn[] = headerCells.map((header) => ({
    header: header.trim(),
    rows: [],
  }));

  for (let i = 2; i < lines.length; i++) {
    const cells = parseTableRow(lines[i]);
    for (let j = 0; j < columns.length; j++) {
      columns[j].rows.push((cells[j] || "").trim());
    }
  }

  return { columns };
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  color?: number;
}

/** Display width: CJK = 2, others = 1 */
function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) {
    const c = ch.codePointAt(0) || 0;
    if (
      (c >= 0x4e00 && c <= 0x9fff) ||
      (c >= 0x3400 && c <= 0x4dbf) ||
      (c >= 0x3000 && c <= 0x303f) ||
      (c >= 0xff00 && c <= 0xffef) ||
      (c >= 0xac00 && c <= 0xd7af) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0x20000 && c <= 0x2a6df)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function padEnd(str: string, targetWidth: number): string {
  const diff = targetWidth - displayWidth(str);
  return str + " ".repeat(Math.max(0, diff));
}

export function tableToEmbed(table: ParsedTable, _index: number): DiscordEmbed {
  const numCols = table.columns.length;
  const numRows = table.columns[0]?.rows.length || 0;

  // Need at least 2 columns and ≤25 rows for card layout (Discord max 25 fields)
  if (numCols >= 2 && numRows <= 25) {
    // Row-based card layout:
    // First column value = field name
    // Remaining columns = stacked lines "Header: Value"
    const fields = [];

    for (let r = 0; r < numRows; r++) {
      const name = table.columns[0].rows[r] || "—";
      const lines = [];
      for (let c = 1; c < numCols; c++) {
        const header = table.columns[c].header;
        const value = table.columns[c].rows[r] || "—";
        lines.push(`**${header}:** ${value}`);
      }

      fields.push({
        name,
        value: lines.join("\n") || "\u200b",
        inline: true,
      });
    }

    return {
      ...(table.title ? { title: table.title } : {}),
      fields,
      color: 0x5865f2,
    };
  }

  // Fallback: code block
  const colWidths = table.columns.map((col) => {
    const maxData = col.rows.reduce((m, r) => Math.max(m, displayWidth(r)), 0);
    return Math.max(displayWidth(col.header), maxData, 2);
  });

  const headerLine = table.columns.map((col, i) => padEnd(col.header, colWidths[i])).join(" │ ");
  const sepLine = colWidths.map((w) => "─".repeat(w)).join("─┼─");
  const dataLines: string[] = [];
  for (let r = 0; r < numRows; r++) {
    dataLines.push(
      table.columns.map((col, i) => padEnd(col.rows[r] || "", colWidths[i])).join(" │ "),
    );
  }

  const description = "```\n" + [headerLine, sepLine, ...dataLines].join("\n") + "\n```";

  return {
    ...(table.title ? { title: table.title } : {}),
    description,
    color: 0x5865f2,
  };
}

export function convertTablesToEmbeds(text: string): { embeds: DiscordEmbed[]; text: string } {
  const { tables, remainingText } = parseMarkdownTables(text);
  if (tables.length === 0) {
    return { embeds: [], text };
  }

  const embeds = tables.slice(0, 10).map((table, i) => tableToEmbed(table, i));
  return { embeds, text: remainingText };
}
