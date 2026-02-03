# Getting GitHub Project IDs

To configure a work loop, you need several IDs from your GitHub Projects v2 board.

## 1. Get Project ID and Number

```bash
# List your projects
gh project list --owner <username>

# Example output:
# NUMBER  TITLE           ID
# 1       Axiom Trader    PVT_kwHOAAT4Ss4BNkU2
```

The `NUMBER` is `projectNum`, the `ID` is `projectId`.

## 2. Get Status Field ID and Option IDs

Run this GraphQL query:

```bash
gh api graphql -f query='
query {
  user(login: "<username>") {
    projectV2(number: <project-number>) {
      id
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}'
```

Find the "Status" field in the output:

```json
{
  "id": "PVTSSF_lAHOAAT4Ss4BNkU2zg8hkHE",  // statusField
  "name": "Status",
  "options": [
    {"id": "f75ad846", "name": "Backlog"},
    {"id": "61e4505c", "name": "Ready"},      // statusOptions.ready
    {"id": "47fc9ee4", "name": "In progress"}, // statusOptions.inProgress
    {"id": "df73e18b", "name": "In review"},   // statusOptions.inReview
    {"id": "98236657", "name": "Done"}         // statusOptions.done
  ]
}
```

## 3. For Organization Projects

Replace `user(login: ...)` with `organization(login: ...)`:

```bash
gh api graphql -f query='
query {
  organization(login: "<org-name>") {
    projectV2(number: <project-number>) {
      ...
    }
  }
}'
```

## Quick Copy Template

After getting IDs, fill in:

```json
{
  "projectOwner": "<username>",
  "projectNum": <number>,
  "projectId": "<PVT_xxx>",
  "statusField": "<PVTSSF_xxx>",
  "statusOptions": {
    "ready": "<ready-option-id>",
    "inProgress": "<in-progress-option-id>",
    "inReview": "<in-review-option-id>",
    "done": "<done-option-id>"
  }
}
```
