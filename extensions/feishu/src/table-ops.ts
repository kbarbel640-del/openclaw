/**
 * Table row/column manipulation operations for Feishu documents.
 */

import type * as Lark from "@larksuiteoapi/node-sdk";

export async function insertTableRow(
  client: Lark.Client,
  docToken: string,
  blockId: string,
  rowIndex: number = -1,
) {
  const res = await client.docx.documentBlock.patch({
    path: { document_id: docToken, block_id: blockId },
    data: { insert_table_row: { row_index: rowIndex } },
  });
  if (res.code !== 0) {
    throw new Error(res.msg);
  }
  return { success: true, block: res.data?.block };
}

export async function insertTableColumn(
  client: Lark.Client,
  docToken: string,
  blockId: string,
  columnIndex: number = -1,
) {
  const res = await client.docx.documentBlock.patch({
    path: { document_id: docToken, block_id: blockId },
    data: { insert_table_column: { column_index: columnIndex } },
  });
  if (res.code !== 0) {
    throw new Error(res.msg);
  }
  return { success: true, block: res.data?.block };
}

export async function deleteTableRows(
  client: Lark.Client,
  docToken: string,
  blockId: string,
  rowStart: number,
  rowCount: number = 1,
) {
  const res = await client.docx.documentBlock.patch({
    path: { document_id: docToken, block_id: blockId },
    data: { delete_table_rows: { row_start_index: rowStart, row_end_index: rowStart + rowCount } },
  });
  if (res.code !== 0) {
    throw new Error(res.msg);
  }
  return { success: true, rows_deleted: rowCount, block: res.data?.block };
}

export async function deleteTableColumns(
  client: Lark.Client,
  docToken: string,
  blockId: string,
  columnStart: number,
  columnCount: number = 1,
) {
  const res = await client.docx.documentBlock.patch({
    path: { document_id: docToken, block_id: blockId },
    data: {
      delete_table_columns: {
        column_start_index: columnStart,
        column_end_index: columnStart + columnCount,
      },
    },
  });
  if (res.code !== 0) {
    throw new Error(res.msg);
  }
  return { success: true, columns_deleted: columnCount, block: res.data?.block };
}

export async function mergeTableCells(
  client: Lark.Client,
  docToken: string,
  blockId: string,
  rowStart: number,
  rowEnd: number,
  columnStart: number,
  columnEnd: number,
) {
  const res = await client.docx.documentBlock.patch({
    path: { document_id: docToken, block_id: blockId },
    data: {
      merge_table_cells: {
        row_start_index: rowStart,
        row_end_index: rowEnd,
        column_start_index: columnStart,
        column_end_index: columnEnd,
      },
    },
  });
  if (res.code !== 0) {
    throw new Error(res.msg);
  }
  return { success: true, block: res.data?.block };
}
