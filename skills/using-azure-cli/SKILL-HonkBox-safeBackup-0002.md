---
name: using-azure-cli
description: Executes Azure CLI commands for Azure resources and Azure DevOps repos/PRs/pipelines. Use when running az commands, ADO scripting, querying VMs/storage/AKS, DevOps work items, or automation. Covers common gotchas (pr show flags, pr images via REST, WIQL queries).
invocation: user
---

# Using Azure CLI

Expert guidance for the Azure CLI (`az`) and Azure DevOps extension.

## Contents

- [Quick Reference](#quick-reference)
- [Authentication](#authentication)
- [Configuration & Defaults](#configuration--defaults)
- [Output Formats](#output-formats)
- [Core Command Groups](#core-command-groups)
- [Azure DevOps](#azure-devops-extension)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- **Reference Files:**
  - [references/azure-resources.md](references/azure-resources.md) - Key Vault, VMs, storage, AKS, Resource Graph
  - [references/devops-commands.md](references/devops-commands.md) - az devops invoke, work items, pipeline logs
  - [references/common-gotchas.md](references/common-gotchas.md) - Binary uploads, PR images, flag limitations
  - [devops-reference.md](devops-reference.md) - Detailed PR, repo, pipeline, invoke commands
  - [workflows.md](workflows.md) - Complete workflow scripts
  - [domain-specific.md](domain-specific.md) - ECS queries, entitlements, pipeline monitoring
  - [kusto-reference.md](kusto-reference.md) - Azure Data Explorer cluster management

## Quick Reference

| Task                | Command                                                     |
| ------------------- | ----------------------------------------------------------- |
| Login               | `az login`                                                  |
| Show account        | `az account show`                                           |
| Switch subscription | `az account set -s <NAME>`                                  |
| List PRs            | `az repos pr list --status active -o table`                 |
| Show PR             | `az repos pr show --id <ID>`                                |
| Create PR           | `az repos pr create --title "..." --source-branch <branch>` |
| Run pipeline        | `az pipelines run --name "CI"`                              |
| Query work items    | `az boards query --wiql "SELECT..."`                        |

## Authentication

```bash
# Interactive login (opens browser)
az login

# Device code flow (headless/remote)
az login --use-device-code

# Service principal
az login --service-principal -u <APP_ID> -p <SECRET> -t <TENANT_ID>

# Managed identity (from Azure resources)
az login --identity

# Show current account
az account show

# Switch subscription
az account set -s <SUBSCRIPTION_NAME_OR_ID>
```

## Configuration & Defaults

### DevOps Defaults (CRITICAL for scripting)

```bash
# Set org and project defaults - HUGE time saver
az devops configure --defaults \
  organization=https://yammer.visualstudio.com \
  project=engineering

# View current DevOps defaults
az devops configure --list

# Commands now work without --org and -p
az repos pr list --status active  # Uses defaults
az pipelines list -o table        # Uses defaults
```

**Best practice:** Always set DevOps defaults at the start of scripts:

```bash
#!/bin/bash
az devops configure --defaults organization=https://yammer.visualstudio.com project=engineering
az repos pr list --status active
```

### Persistent Configuration

```bash
# Set defaults (persist across sessions)
az config set defaults.group=myResourceGroup
az config set defaults.location=westus2

# View current config
az config get
```

### az find - AI-Powered Command Discovery

```bash
az find "create a virtual machine"
az find "list storage blobs"
az find "get pipeline logs"
```

## Output Formats

| Format | Flag       | Use Case                  |
| ------ | ---------- | ------------------------- |
| JSON   | `-o json`  | Machine-readable, default |
| Table  | `-o table` | Human-readable            |
| TSV    | `-o tsv`   | Scripting, variables      |
| None   | `-o none`  | Suppress output           |

### JMESPath Queries

```bash
# Single property
az vm show -g myRG -n myVM --query "name" -o tsv

# Multiple properties
az vm list --query "[].{Name:name, Size:hardwareProfile.vmSize}" -o table

# Filter results
az vm list --query "[?powerState=='VM running']"
```

## Core Command Groups

| Group         | Purpose                             |
| ------------- | ----------------------------------- |
| `az account`  | Subscriptions and accounts          |
| `az group`    | Resource groups                     |
| `az vm`       | Virtual machines                    |
| `az aks`      | Azure Kubernetes Service            |
| `az storage`  | Storage accounts, blobs             |
| `az network`  | VNets, NSGs, load balancers         |
| `az keyvault` | Key Vault secrets, keys             |
| `az monitor`  | Logs, metrics, alerts               |
| `az graph`    | Cross-subscription resource queries |
| `az kusto`    | Azure Data Explorer clusters        |

For detailed resource commands, see [references/azure-resources.md](references/azure-resources.md).

## Common Patterns

### CRUD Operations

```bash
# Create
az <service> create --name <name> --resource-group <rg> [options]

# List
az <service> list --resource-group <rg>

# Show
az <service> show --name <name> --resource-group <rg>

# Update
az <service> update --name <name> --resource-group <rg> --set <prop>=<value>

# Delete
az <service> delete --name <name> --resource-group <rg> --yes
```

### Store IDs for Reuse

```bash
VM_ID=$(az vm show -g myRG -n myVM --query id -o tsv)
az vm start --ids $VM_ID
```

### Async Operations

```bash
az group delete -n MyResourceGroup --no-wait
az vm wait --created --ids $VM_ID
```

## Azure DevOps Extension

### Installation

```bash
az extension add --name azure-devops
az devops configure --defaults organization=https://dev.azure.com/myorg project=MyProject
```

### Common Organizations

| Name               | URL                                  | Project     |
| ------------------ | ------------------------------------ | ----------- |
| Teams              | `https://domoreexp.visualstudio.com` | MSTeams     |
| Yammer Engineering | `https://yammer.visualstudio.com`    | engineering |

### Repositories

```bash
# Create PR (use --description, NOT --body like gh CLI)
az repos pr create --title "Feature X" \
  --description "PR description here" \
  --source-branch feature/x \
  --target-branch main \
  --auto-complete true

# List PRs
az repos pr list --status active -o table

# Show PR details (ONLY --id and --org, NOT -p/--repository)
az repos pr show --id 123 --org https://yammer.visualstudio.com

# Complete PR
az repos pr update --id 123 --status completed

# Get PR web URL
PR_INFO=$(az repos pr show --id 123 --org https://yammer.visualstudio.com -o json)
PR_URL=$(echo "$PR_INFO" | jq -r '"\(.repository.webUrl)/pullrequest/\(.pullRequestId)"')
```

**IMPORTANT:** `az repos pr show` only accepts `--id` and `--org`. Do NOT pass `-p`, `--project`, or `--repository`.

### Pipelines

```bash
# List pipelines
az pipelines list -o table

# Run pipeline
az pipelines run --name "CI"

# Run with variables
az pipelines run --name "CI" --variables "env=staging"

# List pipeline RUNS (note: 'runs' not 'run')
az pipelines runs list --branch my-branch --top 5 -o table

# Show specific run
az pipelines runs show --id 12345 -o json
```

**IMPORTANT:** Use `az pipelines runs list` (with 's'), not `az pipelines run list`.

### Work Items

```bash
# Create bug
az boards work-item create --title "Login broken" --type Bug

# Update state
az boards work-item update --id 123 --state "Active"

# Query (WIQL)
az boards query --wiql "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = 'Active'"

# Query by Area Path (use UNDER for hierarchy)
az boards query --wiql "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team\\Feature'"
```

### az devops invoke - REST API Access

Direct access to ANY Azure DevOps REST API with automatic authentication:

```bash
az devops invoke \
  --area <service-area> \
  --resource <resource> \
  --route-parameters key=value \
  --query-parameters key=value \
  --http-method GET|POST|PATCH|DELETE \
  -o json
```

Common areas: `git`, `build`, `wit`, `test`, `policy`, `core`

For detailed invoke commands, see [references/devops-commands.md](references/devops-commands.md).

## Critical Gotchas

### Binary File Uploads

**NEVER use `az rest --body @file` for binary uploads - it corrupts files (uploads 0 bytes)**

Always use `curl --data-binary`:

```bash
TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)
curl -s -X POST "https://dev.azure.com/org/project/_apis/wit/attachments?fileName=image.png&api-version=7.0" \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @"image.png"
```

### PR Images

Use REST API for PR descriptions with images - NOT `az repos pr update` (escapes exclamation marks).

For complete details, see [references/common-gotchas.md](references/common-gotchas.md).

## Global Flags

| Flag               | Short | Description         |
| ------------------ | ----- | ------------------- |
| `--subscription`   | `-s`  | Subscription to use |
| `--resource-group` | `-g`  | Resource group      |
| `--name`           | `-n`  | Resource name       |
| `--output`         | `-o`  | Output format       |
| `--query`          |       | JMESPath query      |
| `--debug`          |       | Debug logging       |

## Best Practices

### Security

- Never hardcode secrets - Use Key Vault
- Use managed identities when in Azure
- Rotate PATs regularly

### PAT Scope Reference

When creating Personal Access Tokens, use minimal required scopes:

| Task                     | Required Scope                       |
| ------------------------ | ------------------------------------ |
| Read PRs                 | `Code (Read)`                        |
| Create/update PRs        | `Code (Read & Write)`                |
| Read pipelines           | `Build (Read)`                       |
| Trigger builds           | `Build (Read & Execute)`             |
| Read work items          | `Work Items (Read)`                  |
| Create/update work items | `Work Items (Read, Write, & Manage)` |
| Full access              | `Full access` (avoid if possible)    |

**Create PAT:** https://dev.azure.com/<org>/\_usersSettings/tokens

### Rate Limiting & Backoff

Azure DevOps APIs have rate limits. Handle gracefully:

```bash
# Retry with exponential backoff
retry_az() {
  local max_attempts=3
  local delay=5
  for ((i=1; i<=max_attempts; i++)); do
    if "$@"; then return 0; fi
    echo "Attempt $i failed, waiting ${delay}s..."
    sleep $delay
    delay=$((delay * 2))
  done
  return 1
}

# Usage
retry_az az boards work-item show --id 12345
```

**Rate limit symptoms:**

- HTTP 429 "Too Many Requests"
- HTTP 503 "Service Unavailable"
- Sudden timeouts after many rapid calls

**Prevention:**

- Batch operations when possible
- Add 100-500ms delay between rapid calls
- Use `--query` to reduce response size

### Safe Logging

Never log sensitive data:

```bash
# Bad - logs token
echo "Using token: $AZURE_DEVOPS_PAT"

# Good - logs only length
echo "Token configured: ${#AZURE_DEVOPS_PAT} chars"

# Bad - logs full response with secrets
az keyvault secret show --vault-name x --name y

# Good - extract only needed field
az keyvault secret show --vault-name x --name y --query value -o tsv
```

### Scripting

```bash
# Always use TSV for variables
NAME=$(az vm show -g myRG -n myVM --query name -o tsv)

# Check exit codes
if az vm show -g myRG -n myVM &>/dev/null; then
    echo "VM exists"
fi
```

## Troubleshooting

```bash
# Debug output
az vm create ... --debug

# Check version
az version

# Update CLI
az upgrade

# Clear credentials
az account clear
az login
```

## Verification

After running az commands:

1. **Verify authentication:** `az account show` returns your account
2. **Verify DevOps extension:** `az extension show --name azure-devops` succeeds
3. **Verify org access:** `az repos pr list --org <URL> -o table` returns results
4. **Verify command success:** Check exit code `$?` equals 0

## Related Skills

- `/querying-azure-data-explorer` - KQL queries via Azure CLI
- `/ensuring-ci-green` - Pipeline operations
- `/reviewing-ado-prs` - PR operations
- `/responding-to-pr-comments` - Comment operations
