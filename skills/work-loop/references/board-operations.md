# Manual Board Operations

GraphQL mutations for manually manipulating the project board.

## Move Item to Different Status

```bash
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "<PROJECT_ID>",
    itemId: "<ITEM_ID>",
    fieldId: "<STATUS_FIELD_ID>",
    value: { singleSelectOptionId: "<STATUS_OPTION_ID>" }
  }) {
    projectV2Item { id }
  }
}'
```

## Get Item ID for an Issue

```bash
gh api graphql -f query='
query {
  repository(owner: "<owner>", name: "<repo>") {
    issue(number: <issue-number>) {
      projectItems(first: 10) {
        nodes {
          id
          project { title }
        }
      }
    }
  }
}'
```

## Add Issue to Project

```bash
gh api graphql -f query='
mutation {
  addProjectV2ItemById(input: {
    projectId: "<PROJECT_ID>",
    contentId: "<ISSUE_NODE_ID>"
  }) {
    item { id }
  }
}'
```

Get issue node ID:
```bash
gh issue view <number> --repo <owner/repo> --json id --jq '.id'
```

## List All Items on Board

```bash
gh project item-list <project-number> --owner <username> -L 50 --format json
```

## Common Status Transitions

| From | To | When |
|------|----|------|
| Ready | In progress | Gate script picks up work |
| In progress | In review | Sub-agent creates PR |
| In review | Done | Verifier merges PR |
| In review | In progress | PR needs fixes |
| Any | Backlog | Deprioritized |
