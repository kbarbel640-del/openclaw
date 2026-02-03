# Work Loop Config Schema

Config files live at `~/.config/work-loops/<repo-name>.json`.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `repo` | string | GitHub repo in `owner/name` format |
| `repoDir` | string | Absolute path to local clone |
| `projectOwner` | string | GitHub username or org |
| `projectNum` | number | Project board number |
| `projectId` | string | Project ID (`PVT_xxx`) |
| `statusField` | string | Status field ID (`PVTSSF_xxx`) |
| `statusOptions` | object | Option IDs for each status |
| `discordChannel` | string | Discord channel ID for updates |

## Status Options (Required)

```json
"statusOptions": {
  "ready": "option-id",      // "Ready" column
  "inProgress": "option-id", // "In progress" column  
  "inReview": "option-id",   // "In review" column
  "done": "option-id"        // "Done" column
}
```

## Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `displayName` | string | repo name | Human-readable name for logs |
| `discordChannelName` | string | "#updates" | Channel name for display |
| `worktreePrefix` | string | `/tmp/<repo>` | Worktree path prefix |
| `branchPrefix` | string | "fix" | Branch name prefix |
| `codingStandardsFile` | string | "" | Repo-relative path to standards |
| `forbiddenPaths` | array | `["/home/dan/clawd"]` | Paths sub-agents must avoid |
| `maxSubAgents` | number | 3 | Max concurrent sub-agents |
| `subAgentModel` | string | "moonshot/kimi-for-coding" | Model for sub-agents |
| `serviceCommands` | object | null | Start/stop commands for services |

## Service Commands (Optional)

For repos with services to start/stop during testing:

```json
"serviceCommands": {
  "start": "systemd-run --user ...",
  "stop": "systemctl --user stop ..."
}
```

## Example Config

```json
{
  "repo": "dbachelder/axiom-trader",
  "repoDir": "/home/dan/src/axiom-trader",
  "displayName": "Axiom Trader",
  
  "projectOwner": "dbachelder",
  "projectNum": 1,
  "projectId": "PVT_kwHOAAT4Ss4BNkU2",
  "statusField": "PVTSSF_lAHOAAT4Ss4BNkU2zg8hkHE",
  "statusOptions": {
    "ready": "61e4505c",
    "inProgress": "47fc9ee4",
    "inReview": "df73e18b",
    "done": "98236657"
  },
  
  "discordChannel": "1465486027907928322",
  "discordChannelName": "#trading-reports",
  
  "worktreePrefix": "/tmp/axiom-trader",
  "branchPrefix": "fix",
  
  "codingStandardsFile": "CODING-STANDARDS.md",
  
  "forbiddenPaths": ["/home/dan/clawd"],
  
  "maxSubAgents": 3,
  "subAgentModel": "moonshot/kimi-for-coding"
}
```
