---
name: feishu-doc
description: |
  Feishu document read/write operations. Activate when user mentions Feishu docs, cloud docs, or docx links.
---

# Feishu Document Tool

Single tool `feishu_doc` with action parameter for all document operations.

## Token Extraction

From URL `https://xxx.feishu.cn/docx/ABC123def` → `doc_token` = `ABC123def`

## Actions

### Read Document

```json
{ "action": "read", "doc_token": "ABC123def" }
```

Returns: title, plain text content, block statistics. Check `hint` field - if present, structured content (tables, images) exists that requires `list_blocks`.

### Write Document (Replace All)

```json
{ "action": "write", "doc_token": "ABC123def", "content": "# Title\n\nMarkdown content..." }
```

Replaces entire document with markdown content. Supports: headings, lists (with nesting), code blocks, quotes, links, images (`![](url)` auto-uploaded), bold/italic/strikethrough, **tables**.

**Table Example:**

```markdown
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
```

**Nested List Example:**

```markdown
- Item 1
  - Nested item 1.1
    - Deep nested 1.1.1
  - Nested item 1.2
- Item 2
```

### Append Content

```json
{ "action": "append", "doc_token": "ABC123def", "content": "Additional content" }
```

Appends markdown to end of document.

### Create Document

```json
{ "action": "create", "title": "New Document" }
```

With folder:

```json
{ "action": "create", "title": "New Document", "folder_token": "fldcnXXX" }
```

### List Blocks

```json
{ "action": "list_blocks", "doc_token": "ABC123def" }
```

Returns full block data including tables, images. Use this to read structured content.

### Get Single Block

```json
{ "action": "get_block", "doc_token": "ABC123def", "block_id": "doxcnXXX" }
```

### Update Block Text

```json
{
  "action": "update_block",
  "doc_token": "ABC123def",
  "block_id": "doxcnXXX",
  "content": "New text"
}
```

### Delete Block

```json
{ "action": "delete_block", "doc_token": "ABC123def", "block_id": "doxcnXXX" }
```

## Table Row/Column Operations

Get the table `block_id` first via `list_blocks` (block_type 31 = Table).

### Insert Row

```json
{
  "action": "insert_table_row",
  "doc_token": "ABC123def",
  "block_id": "tableBlockId",
  "row_index": -1
}
```

`row_index`: position to insert (`-1` = end, `0` = before first row).

### Insert Column

```json
{
  "action": "insert_table_column",
  "doc_token": "ABC123def",
  "block_id": "tableBlockId",
  "column_index": -1
}
```

`column_index`: position to insert (`-1` = end, `0` = before first column).

### Delete Rows

```json
{
  "action": "delete_table_rows",
  "doc_token": "ABC123def",
  "block_id": "tableBlockId",
  "row_start": 2,
  "row_count": 1
}
```

`row_start`: 0-based index. `row_count`: number of rows to delete (default: 1).

### Delete Columns

```json
{
  "action": "delete_table_columns",
  "doc_token": "ABC123def",
  "block_id": "tableBlockId",
  "column_start": 1,
  "column_count": 1
}
```

### Merge Cells

```json
{
  "action": "merge_table_cells",
  "doc_token": "ABC123def",
  "block_id": "tableBlockId",
  "row_start": 0,
  "row_end": 2,
  "column_start": 0,
  "column_end": 2
}
```

`row_end` / `column_end` are exclusive (like Python slice notation).

## Colored Text

Update a text block with colored segments. Use `list_blocks` to get the `block_id` first.

### Syntax

Wrap text with `[color]...[/color]` tags:

```json
{
  "action": "color_text",
  "doc_token": "ABC123def",
  "block_id": "doxcnXXX",
  "content": "Revenue [green]+15%[/green] YoY, Costs [red]-3%[/red]"
}
```

### Supported Tags

| Tag           | Effect                                 |
| ------------- | -------------------------------------- |
| `[red]`       | Red text (use for declines, negatives) |
| `[green]`     | Green text (use for growth, positives) |
| `[orange]`    | Orange text                            |
| `[yellow]`    | Yellow text                            |
| `[blue]`      | Blue text                              |
| `[purple]`    | Purple text                            |
| `[grey]`      | Grey text                              |
| `[bold]`      | Bold text                              |
| `[bg:yellow]` | Yellow background (any color works)    |

Combine tags: `[green bold]+25%[/green]`

### Data Report Example

```json
{
  "action": "color_text",
  "doc_token": "ABC123def",
  "block_id": "doxcnXXX",
  "content": "Q4 Revenue [green]+18%[/green]  Net Profit [green]+12%[/green]  Costs [red]-3%[/red]  Note: [bg:yellow]Q4 anomaly detected[/bg]"
}
```

**Workflow for data reports:**

1. `write` - create document structure with markdown
2. `list_blocks` - find block IDs for rows containing metrics
3. `color_text` - apply red/green colors to each metric block

## Reading Workflow

1. Start with `action: "read"` - get plain text + statistics
2. Check `block_types` in response for Table, Image, Code, etc.
3. If structured content exists, use `action: "list_blocks"` for full data

## Configuration

```yaml
channels:
  feishu:
    tools:
      doc: true # default: true
```

**Note:** `feishu_wiki` depends on this tool - wiki page content is read/written via `feishu_doc`.

## Permissions

Required: `docx:document`, `docx:document:readonly`, `docx:document.block:convert`, `drive:drive`
