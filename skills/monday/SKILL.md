---
name: monday
description: Access monday.com work management platform via MCP. Use for creating/managing items, boards, groups, columns, and users. Triggers on "monday", "monday.com", "work items", "project board", or requests to manage tasks and workflows in monday.com.
homepage: https://monday.com
metadata: {"clawdbot":{"emoji":"📊","requires":{"env":["MONDAY_API_TOKEN"]},"primaryEnv":"MONDAY_API_TOKEN"}}
---

# monday.com Work Management

Access monday.com boards, items, and workflows via the official MCP server.

## Setup

1. Get your API token from monday.com: Account → Developers → My access tokens
2. Set the environment variable:
   ```bash
   export MONDAY_API_TOKEN="your-api-token"
   ```

## MCP Server

**Hosted (recommended):**
```json
{
  "mcpServers": {
    "monday": {
      "url": "https://mcp.monday.com/mcp"
    }
  }
}
```

**Local via npx:**
```json
{
  "mcpServers": {
    "monday": {
      "command": "npx",
      "args": ["@mondaydotcomorg/monday-api-mcp@latest", "-t", "${MONDAY_API_TOKEN}"]
    }
  }
}
```

**Optional flags:**
- `--read-only` / `-ro` - Enable read-only mode
- `--mode apps` - Use apps mode for app-specific tools
- `--enable-dynamic-api-tools` - Enable beta GraphQL tools

## Available Tools

### Item Operations
- `create_item` - Create a new item on a board
- `delete_item` - Delete an item
- `get_board_items_by_name` - Search items by name
- `create_update` - Add an update/comment to an item
- `change_item_column_values` - Update item column values
- `move_item_to_group` - Move item to a different group

### Board Operations
- `create_board` - Create a new board
- `get_board_schema` - Get board structure and columns
- `create_group` - Create a group within a board
- `create_column` - Add a column to a board
- `delete_column` - Remove a column from a board

### Account Operations
- `list_users_and_teams` - List workspace users and teams

### WorkForms Operations
- `create_form` - Create a new WorkForm
- `get_form` - Retrieve form details

### Dynamic API Tools (Beta)
- `all_monday_api` - Execute arbitrary GraphQL queries
- `get_graphql_schema` - Retrieve API schema
- `get_type_details` - Get details for specific types

## Example Queries

- "Create a new item on my Tasks board"
- "Show me all items in the Marketing board"
- "Move the website redesign task to Done"
- "Add a comment to the Q4 planning item"
- "List all users in my workspace"

## Notes

- Requires Node.js v20+ for local installation
- API token permissions determine available operations
- Use `--read-only` flag for safer exploration
