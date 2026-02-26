import { Type, type Static } from "@sinclair/typebox";

export const FeishuDocSchema = Type.Union([
  Type.Object({
    action: Type.Literal("read"),
    doc_token: Type.String({ description: "Document token (extract from URL /docx/XXX)" }),
  }),
  Type.Object({
    action: Type.Literal("write"),
    doc_token: Type.String({ description: "Document token" }),
    content: Type.String({
      description: "Markdown content to write (replaces entire document content)",
    }),
  }),
  Type.Object({
    action: Type.Literal("append"),
    doc_token: Type.String({ description: "Document token" }),
    content: Type.String({ description: "Markdown content to append to end of document" }),
  }),
  Type.Object({
    action: Type.Literal("create"),
    title: Type.String({ description: "Document title" }),
    folder_token: Type.Optional(Type.String({ description: "Target folder token (optional)" })),
  }),
  Type.Object({
    action: Type.Literal("list_blocks"),
    doc_token: Type.String({ description: "Document token" }),
  }),
  Type.Object({
    action: Type.Literal("get_block"),
    doc_token: Type.String({ description: "Document token" }),
    block_id: Type.String({ description: "Block ID (from list_blocks)" }),
  }),
  Type.Object({
    action: Type.Literal("update_block"),
    doc_token: Type.String({ description: "Document token" }),
    block_id: Type.String({ description: "Block ID (from list_blocks)" }),
    content: Type.String({ description: "New text content" }),
  }),
  Type.Object({
    action: Type.Literal("delete_block"),
    doc_token: Type.String({ description: "Document token" }),
    block_id: Type.String({ description: "Block ID" }),
  }),
  // Table operations
  Type.Object({
    action: Type.Literal("insert_table_row"),
    doc_token: Type.String({ description: "Document token" }),
    block_id: Type.String({ description: "Table block ID" }),
    row_index: Type.Optional(
      Type.Number({ description: "Row index to insert at (-1 for end, default: -1)" }),
    ),
  }),
  Type.Object({
    action: Type.Literal("insert_table_column"),
    doc_token: Type.String({ description: "Document token" }),
    block_id: Type.String({ description: "Table block ID" }),
    column_index: Type.Optional(
      Type.Number({ description: "Column index to insert at (-1 for end, default: -1)" }),
    ),
  }),
  Type.Object({
    action: Type.Literal("delete_table_rows"),
    doc_token: Type.String({ description: "Document token" }),
    block_id: Type.String({ description: "Table block ID" }),
    row_start: Type.Number({ description: "Start row index (0-based)" }),
    row_count: Type.Optional(Type.Number({ description: "Number of rows to delete (default: 1)" })),
  }),
  Type.Object({
    action: Type.Literal("delete_table_columns"),
    doc_token: Type.String({ description: "Document token" }),
    block_id: Type.String({ description: "Table block ID" }),
    column_start: Type.Number({ description: "Start column index (0-based)" }),
    column_count: Type.Optional(
      Type.Number({ description: "Number of columns to delete (default: 1)" }),
    ),
  }),
  Type.Object({
    action: Type.Literal("merge_table_cells"),
    doc_token: Type.String({ description: "Document token" }),
    block_id: Type.String({ description: "Table block ID" }),
    row_start: Type.Number({ description: "Start row index" }),
    row_end: Type.Number({ description: "End row index (exclusive)" }),
    column_start: Type.Number({ description: "Start column index" }),
    column_end: Type.Number({ description: "End column index (exclusive)" }),
  }),
]);

export type FeishuDocParams = Static<typeof FeishuDocSchema>;
