/**
 * Batch insertion for large Feishu documents (>1000 blocks).
 *
 * The Feishu Descendant API has a limit of 1000 blocks per request.
 * This module handles splitting large documents into batches while
 * preserving parent-child relationships between blocks.
 */

import type * as Lark from "@larksuiteoapi/node-sdk";
import { cleanBlocksForDescendant } from "./table-utils.js";

export const BATCH_SIZE = 1000; // Feishu API limit per request

type Logger = { info?: (msg: string) => void };

/**
 * Collect all descendant blocks for a given set of first-level block IDs.
 * Recursively traverses the block tree to gather all children.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK block types
function collectDescendants(blocks: any[], firstLevelIds: string[]): any[] {
  const blockMap = new Map<string, any>();
  for (const block of blocks) {
    blockMap.set(block.block_id, block);
  }

  const result: any[] = [];
  const visited = new Set<string>();

  function collect(blockId: string) {
    if (visited.has(blockId)) return;
    visited.add(blockId);

    const block = blockMap.get(blockId);
    if (!block) return;

    result.push(block);

    // Recursively collect children
    const children = block.children;
    if (Array.isArray(children)) {
      for (const childId of children) {
        collect(childId);
      }
    } else if (typeof children === "string") {
      collect(children);
    }
  }

  for (const id of firstLevelIds) {
    collect(id);
  }

  return result;
}

/**
 * Insert a single batch of blocks using Descendant API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK block types
async function insertBatch(
  client: Lark.Client,
  docToken: string,
  blocks: any[],
  firstLevelBlockIds: string[],
): Promise<any[]> {
  const descendants = cleanBlocksForDescendant(blocks);

  if (descendants.length === 0) {
    return [];
  }

  const res = await client.docx.documentBlockDescendant.create({
    path: { document_id: docToken, block_id: docToken },
    data: {
      children_id: firstLevelBlockIds,
      descendants,
    },
  });

  if (res.code !== 0) {
    throw new Error(`${res.msg} (code: ${res.code})`);
  }

  return res.data?.children ?? [];
}

/**
 * Insert blocks in batches for large documents (>1000 blocks).
 *
 * Splits first-level blocks into batches of up to 1000, collecting
 * all descendants for each batch to maintain block relationships.
 *
 * @param client - Feishu API client
 * @param docToken - Document ID
 * @param blocks - All blocks from Convert API
 * @param firstLevelBlockIds - IDs of top-level blocks to insert
 * @param logger - Optional logger for progress updates
 * @returns Inserted children blocks and any skipped block IDs
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK block types
export async function insertBlocksInBatches(
  client: Lark.Client,
  docToken: string,
  blocks: any[],
  firstLevelBlockIds: string[],
  logger?: Logger,
): Promise<{ children: any[]; skipped: string[] }> {
  const allChildren: any[] = [];
  const totalBatches = Math.ceil(firstLevelBlockIds.length / BATCH_SIZE);

  for (let i = 0; i < firstLevelBlockIds.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batchFirstLevelIds = firstLevelBlockIds.slice(i, i + BATCH_SIZE);
    const batchBlocks = collectDescendants(blocks, batchFirstLevelIds);

    logger?.info?.(
      `feishu_doc: Inserting batch ${batchNum}/${totalBatches} (${batchBlocks.length} blocks)...`,
    );

    const children = await insertBatch(client, docToken, batchBlocks, batchFirstLevelIds);
    allChildren.push(...children);
  }

  return { children: allChildren, skipped: [] };
}
