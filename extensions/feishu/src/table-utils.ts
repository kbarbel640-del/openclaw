/**
 * Table utilities for Feishu document operations.
 * Provides adaptive column width calculation based on cell content.
 */

// Feishu table constraints
const MIN_COLUMN_WIDTH = 50; // Feishu API minimum
const MAX_COLUMN_WIDTH = 400; // Reasonable maximum for readability
const DEFAULT_TABLE_WIDTH = 730; // Approximate Feishu page content width

/**
 * Calculate adaptive column widths based on cell content length.
 *
 * Algorithm:
 * 1. For each column, find the max content length across all rows
 * 2. Weight CJK characters as 2x width (they render wider)
 * 3. Calculate proportional widths based on content length
 * 4. Apply min/max constraints
 * 5. Adjust to fit total table width
 *
 * @param blocks - Array of blocks from Convert API
 * @param tableBlockId - The block_id of the table block
 * @param totalWidth - Total table width in pixels (default: 730)
 * @returns Array of column widths in pixels
 */
export function calculateAdaptiveColumnWidths(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: any[],
  tableBlockId: string,
  totalWidth: number = DEFAULT_TABLE_WIDTH,
): number[] {
  // Find the table block
  const tableBlock = blocks.find((b) => b.block_id === tableBlockId && b.block_type === 31);

  if (!tableBlock?.table?.property) {
    return [];
  }

  const { row_size, column_size } = tableBlock.table.property;
  const cellIds: string[] = tableBlock.children || [];

  // Build block lookup map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockMap = new Map<string, any>();
  for (const block of blocks) {
    blockMap.set(block.block_id, block);
  }

  // Extract text content from a table cell
  function getCellText(cellId: string): string {
    const cell = blockMap.get(cellId);
    if (!cell?.children) return "";

    let text = "";
    const childIds = Array.isArray(cell.children) ? cell.children : [cell.children];

    for (const childId of childIds) {
      const child = blockMap.get(childId);
      if (child?.text?.elements) {
        for (const elem of child.text.elements) {
          if (elem.text_run?.content) {
            text += elem.text_run.content;
          }
        }
      }
    }
    return text;
  }

  // Calculate weighted length (CJK chars count as 2)
  function getWeightedLength(text: string): number {
    return [...text].reduce((sum, char) => {
      return sum + (char.charCodeAt(0) > 255 ? 2 : 1);
    }, 0);
  }

  // Find max content length per column
  const maxLengths: number[] = new Array(column_size).fill(0);

  for (let row = 0; row < row_size; row++) {
    for (let col = 0; col < column_size; col++) {
      const cellIndex = row * column_size + col;
      const cellId = cellIds[cellIndex];
      if (cellId) {
        const content = getCellText(cellId);
        const length = getWeightedLength(content);
        maxLengths[col] = Math.max(maxLengths[col], length);
      }
    }
  }

  // Handle empty table
  const totalLength = maxLengths.reduce((a, b) => a + b, 0);
  if (totalLength === 0) {
    const equalWidth = Math.floor(totalWidth / column_size);
    return new Array(column_size).fill(equalWidth);
  }

  // Calculate proportional widths
  let widths = maxLengths.map((len) => {
    const proportion = len / totalLength;
    return Math.round(proportion * totalWidth);
  });

  // Apply min/max constraints
  widths = widths.map((w) => Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, w)));

  // Redistribute to match total width
  const currentTotal = widths.reduce((a, b) => a + b, 0);
  if (currentTotal !== totalWidth) {
    const diff = totalWidth - currentTotal;
    // Add/subtract from widest column (or first if all equal)
    const targetIndex = widths.indexOf(Math.max(...widths));
    widths[targetIndex] = Math.max(
      MIN_COLUMN_WIDTH,
      Math.min(MAX_COLUMN_WIDTH, widths[targetIndex] + diff),
    );
  }

  return widths;
}

/**
 * Clean blocks for Descendant API with adaptive column widths.
 *
 * - Removes parent_id from all blocks
 * - Fixes children type (string → array) for TableCell blocks
 * - Removes merge_info (read-only, causes API error)
 * - Calculates and applies adaptive column_width for tables
 *
 * @param blocks - Array of blocks from Convert API
 * @returns Cleaned blocks ready for Descendant API
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cleanBlocksForDescendant(blocks: any[]): any[] {
  // Pre-calculate adaptive widths for all tables
  const tableWidths = new Map<string, number[]>();
  for (const block of blocks) {
    if (block.block_type === 31) {
      const widths = calculateAdaptiveColumnWidths(blocks, block.block_id);
      tableWidths.set(block.block_id, widths);
    }
  }

  return blocks.map((block) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { parent_id: _parentId, ...cleanBlock } = block;

    // Fix: Convert API sometimes returns children as string for TableCell
    if (cleanBlock.block_type === 32 && typeof cleanBlock.children === "string") {
      cleanBlock.children = [cleanBlock.children];
    }

    // Clean table blocks
    if (cleanBlock.block_type === 31 && cleanBlock.table) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cells: _cells, ...tableWithoutCells } = cleanBlock.table;
      const { row_size, column_size } = tableWithoutCells.property || {};
      const adaptiveWidths = tableWidths.get(block.block_id);

      cleanBlock.table = {
        property: {
          row_size,
          column_size,
          ...(adaptiveWidths?.length && { column_width: adaptiveWidths }),
        },
      };
    }

    return cleanBlock;
  });
}
