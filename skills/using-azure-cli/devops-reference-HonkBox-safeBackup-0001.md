# Azure DevOps CLI Detailed Reference

## Repository Commands

### az repos

```bash
# Create repository
az repos create --name "RepoName" --project "Project"

# Create with specific organization
az repos create --name "RepoName" --organization https://dev.azure.com/myorg --project "Project"

# List all repos
az repos list --project "Project" -o table

# Show repo details
az repos show --repository "RepoName"

# Delete repository
az repos delete --id <repo-id> --yes

# Import from external URL
az repos import create --git-url https://github.com/user/repo --repository "NewRepo"
```

### az repos pr (Pull Requests)

```bash
# Create PR with all options
az repos pr create \
  --title "Feature: Add login" \
  --description "Implements OAuth login flow" \
  --source-branch feature/login \
  --target-branch main \
  --reviewers user1@example.com user2@example.com \
  --work-items 123 456 \
  --auto-complete true \
  --delete-source-branch true \
  --squash true \
  --merge-commit-message "Add OAuth login (#789)"

# Create draft PR
az repos pr create --title "WIP: New feature" --draft true

# List PRs with filters
az repos pr list --status active -o table
az repos pr list --status completed --top 10
az repos pr list --creator user@example.com
az repos pr list --reviewer user@example.com
az repos pr list --source-branch feature/x
az repos pr list --target-branch main

# Show PR details
az repos pr show --id 123

# Update PR
az repos pr update --id 123 --title "Updated title"
az repos pr update --id 123 --description "New description"
az repos pr update --id 123 --status abandoned

# Complete PR
az repos pr update --id 123 --status completed \
  --delete-source-branch true \
  --transition-work-items true

# Set auto-complete
az repos pr update --id 123 --auto-complete true

# Add/remove reviewers
az repos pr reviewer add --id 123 --reviewers user@example.com
az repos pr reviewer remove --id 123 --reviewer-id <user-id>

# List reviewers
az repos pr reviewer list --id 123

# Work with PR policies
az repos pr policy list --id 123
az repos pr policy queue --id 123 --evaluation-id <eval-id>
```

### Uploading Images to Embed in PRs

Azure DevOps PR descriptions support markdown images, but images must be hosted on Azure DevOps. Use the Work Item Attachments API to upload images and get URLs for embedding.

```bash
# 1. Get access token for Azure DevOps
TOKEN=$(az account get-access-token --resource "499b84ac-1321-427f-aa17-267ca6975798" --query accessToken -o tsv)

# 2. Upload image using curl (REST API)
# The API returns a JSON response with the attachment URL
curl -s -X POST \
  "https://{org}.visualstudio.com/{project}/_apis/wit/attachments?fileName={filename}&api-version=7.1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"/path/to/image.png"

# Example response:
# {
#   "id": "62d84105-fe3c-4935-b0fe-4b1435a560c6",
#   "url": "https://org.visualstudio.com/project-guid/_apis/wit/attachments/attachment-guid?fileName=image.png"
# }

# 3. Use the returned URL in PR description markdown
# ![Alt text](https://org.visualstudio.com/project-guid/_apis/wit/attachments/attachment-guid?fileName=image.png)

# Full example script to upload multiple images:
ORG="domoreexp.visualstudio.com"
PROJECT="Teamspace"
TOKEN=$(az account get-access-token --resource "499b84ac-1321-427f-aa17-267ca6975798" --query accessToken -o tsv)

for img in before.png after.png; do
  URL=$(curl -s -X POST \
    "https://${ORG}/${PROJECT}/_apis/wit/attachments?fileName=${img}&api-version=7.1" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"${img}" | jq -r '.url')
  echo "${img}: ${URL}"
done

# 4. Update PR description with embedded images
az repos pr update --id 123 --description "$(cat << 'EOF'
## Before / After

| Before | After |
|:---:|:---:|
| ![Before](URL_FROM_STEP_2) | ![After](URL_FROM_STEP_2) |
EOF
)"
```

**Notes:**

- The resource GUID `499b84ac-1321-427f-aa17-267ca6975798` is the Azure DevOps resource identifier for AAD authentication
- Images uploaded via the attachments API are permanent and don't expire
- The returned URL can be used in any Azure DevOps markdown field (PR descriptions, work items, wiki pages)
- Maximum file size is typically 130MB per attachment

### az repos policy

```bash
# List policies
az repos policy list --repository "RepoName" --branch main

# Common policy types
az repos policy approver-count create \
  --branch main \
  --repository-id <repo-id> \
  --blocking true \
  --enabled true \
  --minimum-approver-count 2 \
  --creator-vote-counts false \
  --allow-downvotes false \
  --reset-on-source-push true

az repos policy build create \
  --branch main \
  --repository-id <repo-id> \
  --build-definition-id <def-id> \
  --blocking true \
  --enabled true \
  --display-name "Build Validation" \
  --queue-on-source-update-only true

az repos policy comment-required create \
  --branch main \
  --repository-id <repo-id> \
  --blocking true \
  --enabled true

az repos policy work-item-linking create \
  --branch main \
  --repository-id <repo-id> \
  --blocking true \
  --enabled true
```

## Pipeline Commands

### az pipelines

```bash
# Create YAML pipeline
az pipelines create \
  --name "CI-Build" \
  --description "Continuous integration build" \
  --repository MyRepo \
  --repository-type tfsgit \
  --branch main \
  --yaml-path azure-pipelines.yml \
  --skip-first-run true

# Create from GitHub
az pipelines create \
  --name "GitHub-CI" \
  --repository OrgName/RepoName \
  --repository-type github \
  --branch master \
  --service-connection my-github-connection \
  --yaml-path .azure/pipelines/ci.yml

# List pipelines
az pipelines list -o table
az pipelines list --query "[?name contains 'CI']" -o table

# Show pipeline
az pipelines show --name "CI-Build"
az pipelines show --id 17

# Update pipeline
az pipelines update --id 17 --new-name "CI-Build-v2"

# Delete pipeline
az pipelines delete --id 17 --yes
```

### az pipelines run

```bash
# Basic run
az pipelines run --name "CI-Build"

# Run specific branch
az pipelines run --name "CI-Build" --branch feature/test

# Run with variables
az pipelines run --name "CI-Build" \
  --variables "configuration=Release" "platform=x64"

# Run with parameters (YAML parameters)
az pipelines run --name "CI-Build" \
  --parameters "environment=production" "deploy=true"

# Run with commit
az pipelines run --name "CI-Build" --commit-id abc123

# Open in browser after triggering
az pipelines run --name "CI-Build" --open
```

### az pipelines runs

```bash
# List recent runs
az pipelines runs list --pipeline-name "CI-Build" -o table

# List with filters
az pipelines runs list --pipeline-name "CI-Build" --status completed
az pipelines runs list --pipeline-name "CI-Build" --result succeeded
az pipelines runs list --pipeline-name "CI-Build" --branch main
az pipelines runs list --top 5

# Show run details
az pipelines runs show --id 1234

# Get run logs
az pipelines runs artifact download --run-id 1234 --artifact-name logs --path ./logs

# Tag a run
az pipelines runs tag add --run-id 1234 --tags "release" "v1.0.0"
```

### az pipelines variable

```bash
# Create variable
az pipelines variable create \
  --name "BuildConfiguration" \
  --pipeline-name "CI-Build" \
  --value "Release"

# Create secret variable
az pipelines variable create \
  --name "ApiKey" \
  --pipeline-name "CI-Build" \
  --value "super-secret" \
  --secret true

# List variables
az pipelines variable list --pipeline-name "CI-Build" -o table

# Update variable
az pipelines variable update \
  --name "BuildConfiguration" \
  --pipeline-name "CI-Build" \
  --value "Debug"

# Delete variable
az pipelines variable delete \
  --name "BuildConfiguration" \
  --pipeline-name "CI-Build" \
  --yes
```

### az pipelines variable-group

```bash
# Create variable group
az pipelines variable-group create \
  --name "SharedVariables" \
  --variables "apiUrl=https://api.example.com" "timeout=30"

# Create with Key Vault link
az pipelines variable-group create \
  --name "KeyVaultSecrets" \
  --authorize true \
  --key-vault-name "my-keyvault"

# List variable groups
az pipelines variable-group list -o table

# Show variable group
az pipelines variable-group show --id 1

# Add variable to group
az pipelines variable-group variable create \
  --group-id 1 \
  --name "newVariable" \
  --value "newValue"

# Update variable in group
az pipelines variable-group variable update \
  --group-id 1 \
  --name "newVariable" \
  --value "updatedValue"

# Delete variable from group
az pipelines variable-group variable delete \
  --group-id 1 \
  --name "newVariable" \
  --yes

# Delete variable group
az pipelines variable-group delete --id 1 --yes
```

## Work Items Commands

### az boards work-item

```bash
# Create different work item types
az boards work-item create --title "Add dark mode" --type "User Story"
az boards work-item create --title "Login fails on Safari" --type "Bug"
az boards work-item create --title "Implement caching" --type "Task"
az boards work-item create --title "Q1 Feature Release" --type "Epic"
az boards work-item create --title "User Authentication" --type "Feature"

# Create with all fields
az boards work-item create \
  --title "Implement OAuth login" \
  --type "User Story" \
  --assigned-to "user@example.com" \
  --description "As a user, I want to login with Google/GitHub" \
  --area "Project\\Web" \
  --iteration "Project\\Sprint 5" \
  --fields "Microsoft.VSTS.Common.Priority=1" \
           "Microsoft.VSTS.Scheduling.StoryPoints=5"

# Show work item
az boards work-item show --id 123
az boards work-item show --id 123 --fields "System.Title,System.State,System.AssignedTo"

# Update work item
az boards work-item update --id 123 --state "Active"
az boards work-item update --id 123 --assigned-to "newuser@example.com"
az boards work-item update --id 123 \
  --fields "System.Tags=frontend,urgent" \
           "Microsoft.VSTS.Common.Priority=1"

# Delete work item
az boards work-item delete --id 123 --yes
az boards work-item delete --id 123 --destroy  # Permanent delete
```

### az boards work-item relation

```bash
# Add parent-child relation
az boards work-item relation add \
  --id 123 \
  --relation-type "System.LinkTypes.Hierarchy-Forward" \
  --target-id 456

# Add related link
az boards work-item relation add \
  --id 123 \
  --relation-type "System.LinkTypes.Related" \
  --target-id 789

# Link to PR
az boards work-item relation add \
  --id 123 \
  --relation-type "ArtifactLink" \
  --target-url "vstfs:///Git/PullRequestId/..."

# Show relations
az boards work-item relation show --id 123

# Remove relation
az boards work-item relation remove \
  --id 123 \
  --relation-type "System.LinkTypes.Related" \
  --target-id 789
```

### az boards query

```bash
# Run saved query by ID
az boards query --id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Run saved query by path
az boards query --path "Shared Queries/Active Bugs"
az boards query --path "My Queries/Sprint Items"

# Run WIQL query
az boards query --wiql "SELECT [System.Id], [System.Title], [System.State] \
  FROM WorkItems \
  WHERE [System.TeamProject] = @project \
  AND [System.State] = 'Active' \
  ORDER BY [System.CreatedDate] DESC"

# Complex WIQL
az boards query --wiql "SELECT [System.Id], [System.Title] \
  FROM WorkItems \
  WHERE [System.WorkItemType] = 'Bug' \
  AND [System.State] <> 'Closed' \
  AND [System.AssignedTo] = @me \
  AND [System.Tags] CONTAINS 'urgent'"
```

### az boards iteration/area

```bash
# List iterations
az boards iteration project list -o table

# Show iteration details
az boards iteration project show --path "\\Project\\Sprint 1"

# Create iteration
az boards iteration project create --name "Sprint 6" --path "\\Project"

# List areas
az boards area project list -o table

# Create area
az boards area project create --name "Mobile" --path "\\Project"
```

## Project and Team Commands

### az devops project

```bash
# List projects
az devops project list -o table

# Show project
az devops project show --project "MyProject"

# Create project
az devops project create \
  --name "NewProject" \
  --description "A new project" \
  --visibility private \
  --source-control git \
  --process Agile

# Delete project
az devops project delete --id <project-id> --yes
```

### az devops team

```bash
# List teams
az devops team list --project "MyProject" -o table

# Create team
az devops team create --name "Backend Team" --project "MyProject"

# List team members
az devops team list-member --team "Backend Team" --project "MyProject"

# Add team member
az devops team member add --team "Backend Team" --member user@example.com
```

## Service Connections

```bash
# List service connections
az devops service-endpoint list -o table

# Show service connection
az devops service-endpoint show --id <endpoint-id>

# Create Azure RM connection
az devops service-endpoint azurerm create \
  --name "Azure-Production" \
  --azure-rm-service-principal-id <sp-id> \
  --azure-rm-subscription-id <sub-id> \
  --azure-rm-subscription-name "Production" \
  --azure-rm-tenant-id <tenant-id>

# Create GitHub connection
az devops service-endpoint github create \
  --name "GitHub" \
  --github-url https://github.com \
  --github-pat <pat>
```

## Security and Permissions

```bash
# List security namespaces
az devops security permission namespace list

# Show permissions
az devops security permission show \
  --namespace-id <namespace-id> \
  --subject <user-or-group> \
  --token <security-token>

# Update permissions
az devops security permission update \
  --namespace-id <namespace-id> \
  --subject <user-or-group> \
  --token <security-token> \
  --allow-bit 4 \
  --deny-bit 0
```

## Common Relation Types

| Type                                    | Description       |
| --------------------------------------- | ----------------- |
| `System.LinkTypes.Hierarchy-Forward`    | Parent to child   |
| `System.LinkTypes.Hierarchy-Reverse`    | Child to parent   |
| `System.LinkTypes.Related`              | Related work item |
| `System.LinkTypes.Dependency-Forward`   | Successor         |
| `System.LinkTypes.Dependency-Reverse`   | Predecessor       |
| `Microsoft.VSTS.Common.Affects-Forward` | Affects           |
| `Microsoft.VSTS.Common.Affects-Reverse` | Affected by       |

## Work Item Fields Reference

| Field             | Path                                         |
| ----------------- | -------------------------------------------- |
| Title             | `System.Title`                               |
| State             | `System.State`                               |
| Assigned To       | `System.AssignedTo`                          |
| Area              | `System.AreaPath`                            |
| Iteration         | `System.IterationPath`                       |
| Tags              | `System.Tags`                                |
| Priority          | `Microsoft.VSTS.Common.Priority`             |
| Story Points      | `Microsoft.VSTS.Scheduling.StoryPoints`      |
| Original Estimate | `Microsoft.VSTS.Scheduling.OriginalEstimate` |
| Remaining Work    | `Microsoft.VSTS.Scheduling.RemainingWork`    |
| Completed Work    | `Microsoft.VSTS.Scheduling.CompletedWork`    |

## az devops invoke - Deep Dive

Direct REST API access with automatic authentication. More powerful than individual commands.

### Discovering Available APIs

```bash
# List all service areas
az devops invoke --area "" 2>&1 | grep -E "^area:"

# Common areas:
# - git: Repositories, PRs, commits, branches
# - build: Pipelines, builds, artifacts, timeline
# - release: Release pipelines
# - test: Test runs, results, attachments
# - wit: Work items, queries, attachments
# - policy: Branch policies, evaluations
# - core: Projects, teams, processes
# - hooks: Service hooks
# - graph: Users, groups, memberships
```

### Build/Pipeline Operations

#### Get Build Timeline (Critical for CI Debugging)

```bash
# Get full timeline with all tasks
az devops invoke --area build --resource timeline \
  --route-parameters project=engineering buildId=12345 \
  -o json

# Extract failed tasks with their log IDs
az devops invoke --area build --resource timeline \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq '[.records[] | select(.result == "failed") | {
    name, type, result,
    logId: .log.id,
    issues: .issues
  }]'

# Get tasks with warnings (for succeededWithIssues builds)
az devops invoke --area build --resource timeline \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq '.records[] | select(.warningCount > 0) | {name, warningCount, issues}'

# Get all error/warning messages without downloading logs
az devops invoke --area build --resource timeline \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq -r '.records[].issues[]? | "[\(.type)] \(.message)"'

# Track progress - tasks by state
az devops invoke --area build --resource timeline \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq 'group_by(.state) | map({state: .[0].state, count: length})'
```

#### Get Build Logs

```bash
# List all logs
az devops invoke --area build --resource logs \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq '.value[] | {id, lineCount, type}'

# Download specific log
LOG_ID=15
az devops invoke --area build --resource logs \
  --route-parameters project=engineering buildId=12345 logId=$LOG_ID

# Download log to file
az devops invoke --area build --resource logs \
  --route-parameters project=engineering buildId=12345 logId=$LOG_ID > /tmp/build.log
```

#### Build Artifacts

```bash
# List artifacts
az devops invoke --area build --resource artifacts \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq '.value[] | {name, resource: .resource.type}'

# Get specific artifact details
az devops invoke --area build --resource artifacts \
  --route-parameters project=engineering buildId=12345 artifactName=drop \
  -o json
```

#### Queue and Control Builds

```bash
# Queue a build
cat > /tmp/build-request.json << 'EOF'
{
  "definition": {"id": 42},
  "sourceBranch": "refs/heads/feature/my-feature",
  "parameters": "{\"buildConfiguration\": \"Release\"}",
  "reason": "manual"
}
EOF

az devops invoke --area build --resource builds \
  --route-parameters project=engineering \
  --http-method POST \
  --in-file /tmp/build-request.json \
  -o json | jq '{id, buildNumber, status}'

# Cancel a running build
az devops invoke --area build --resource builds \
  --route-parameters project=engineering buildId=12345 \
  --http-method PATCH \
  --in-file <(echo '{"status": "cancelling"}') \
  --api-version 7.1

# Retry a failed stage (YAML pipelines)
az devops invoke --area build --resource stages \
  --route-parameters project=engineering buildId=12345 stageRefName=Build \
  --http-method PATCH \
  --in-file <(echo '{"state": "retry", "forceRetryAllJobs": false}') \
  --api-version 7.1
```

#### Pipeline Definitions

```bash
# Get pipeline definition with variables
az devops invoke --area build --resource definitions \
  --route-parameters project=engineering definitionId=42 \
  -o json | jq '{name, variables, triggers}'

# List all definitions
az devops invoke --area build --resource definitions \
  --route-parameters project=engineering \
  --query-parameters includeAllProperties=true \
  -o json | jq '.value[] | {id, name, path}'
```

### Test Operations

#### Get Test Runs

```bash
# List test runs for a build
az devops invoke --area test --resource runs \
  --route-parameters project=engineering \
  --query-parameters buildUri=vstfs:///Build/Build/12345 \
  -o json | jq '.value[] | {id, name, state, totalTests, passedTests, failedTests}'

# Get specific test run
az devops invoke --area test --resource runs \
  --route-parameters project=engineering runId=6789 \
  -o json
```

#### Get Test Results

```bash
# Get all failed tests
az devops invoke --area test --resource results \
  --route-parameters project=engineering runId=6789 \
  --query-parameters outcomes=Failed \
  -o json | jq '.value[] | {
    test: .testCaseTitle,
    duration: .durationInMs,
    error: .errorMessage,
    stack: .stackTrace
  }'

# Get test results with details
az devops invoke --area test --resource results \
  --route-parameters project=engineering runId=6789 \
  --query-parameters detailsToInclude=iterations \
  -o json
```

#### Test Attachments

```bash
# List test attachments (screenshots, logs)
az devops invoke --area test --resource attachments \
  --route-parameters project=engineering runId=6789 testCaseResultId=1 \
  -o json | jq '.value[] | {id, fileName, size}'

# Download test attachment
ATTACHMENT_ID="abc-123"
az devops invoke --area test --resource attachments \
  --route-parameters project=engineering runId=6789 testCaseResultId=1 attachmentId=$ATTACHMENT_ID \
  > /tmp/screenshot.png
```

### Git/PR Operations

#### PR Threads and Comments

```bash
# Get all PR threads
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  -o json | jq '.value[] | {
    id, status,
    file: .threadContext.filePath,
    line: .threadContext.rightFileEnd.line,
    comments: [.comments[] | {author: .author.displayName, content}]
  }'

# Get only active (unresolved) threads
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  -o json | jq '[.value[] | select(.status == "active")]'

# Create new comment thread
cat > /tmp/thread.json << 'EOF'
{
  "comments": [{"content": "Consider using `guard let` here for safer unwrapping."}],
  "status": "active",
  "threadContext": {
    "filePath": "/Sources/MyClass.swift",
    "rightFileStart": {"line": 42, "offset": 1},
    "rightFileEnd": {"line": 42, "offset": 50}
  }
}
EOF
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  --http-method POST \
  --in-file /tmp/thread.json

# Reply to existing thread
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 threadId=789 \
  --http-method POST \
  --in-file <(echo '{"content": "Good catch! Fixed in latest commit."}')

# Resolve/close a thread
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 threadId=789 \
  --http-method PATCH \
  --in-file <(echo '{"status": "closed"}')
```

#### PR Iterations (Push History)

```bash
# List all iterations (each push to PR)
az devops invoke --area git --resource pullRequestIterations \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  -o json | jq '.value[] | {
    id,
    author: .author.displayName,
    createdDate,
    sourceCommit: .sourceRefCommit.commitId,
    commonCommit: .commonRefCommit.commitId
  }'

# Get changes in specific iteration
ITERATION_ID=3
az devops invoke --area git --resource pullRequestIterationChanges \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 iterationId=$ITERATION_ID \
  -o json | jq '.changeEntries[] | {path: .item.path, changeType}'
```

#### PR Statuses (CI Checks)

```bash
# Get PR status checks
az devops invoke --area git --resource pullRequestStatuses \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  -o json | jq '.value[] | {
    context: .context.name,
    state,
    description,
    targetUrl
  }'

# Post a custom status
cat > /tmp/status.json << 'EOF'
{
  "state": "succeeded",
  "description": "All security checks passed",
  "context": {
    "name": "security-scan",
    "genre": "custom"
  },
  "targetUrl": "https://example.com/report"
}
EOF
az devops invoke --area git --resource pullRequestStatuses \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  --http-method POST \
  --in-file /tmp/status.json
```

### Policy Operations

```bash
# Get all policy evaluations for a PR
az devops invoke --area policy --resource evaluations \
  --route-parameters project=engineering \
  --query-parameters artifactId=vstfs:///CodeReview/CodeReviewId/PROJECT_ID/12345 \
  -o json | jq '.value[] | {
    id: .evaluationId,
    status,
    type: .configuration.type.displayName,
    isBlocking: .configuration.isBlocking
  }'

# Re-queue a policy evaluation (re-run CI)
EVAL_ID="abc-123-def"
az devops invoke --area policy --resource evaluations \
  --route-parameters project=engineering evaluationId=$EVAL_ID \
  --http-method PATCH \
  --in-file <(echo '{"status": "queued"}')
```

### Work Item Operations via Invoke

```bash
# Get work item with all relations
az devops invoke --area wit --resource workItems \
  --route-parameters project=engineering id=12345 \
  --query-parameters '$expand=all' \
  -o json

# Batch get multiple work items
az devops invoke --area wit --resource workItems \
  --route-parameters project=engineering \
  --query-parameters ids=123,456,789 '$expand=relations' \
  -o json

# Update work item (JSON Patch)
cat > /tmp/update.json << 'EOF'
[
  {"op": "add", "path": "/fields/System.State", "value": "Active"},
  {"op": "add", "path": "/fields/System.Tags", "value": "urgent; frontend"},
  {"op": "add", "path": "/fields/System.History", "value": "Started investigation"}
]
EOF
az devops invoke --area wit --resource workItems \
  --route-parameters project=engineering id=12345 \
  --http-method PATCH \
  --in-file /tmp/update.json \
  --api-version 7.1

# Add attachment relation to work item
cat > /tmp/relation.json << 'EOF'
[{
  "op": "add",
  "path": "/relations/-",
  "value": {
    "rel": "AttachedFile",
    "url": "https://dev.azure.com/org/project/_apis/wit/attachments/GUID"
  }
}]
EOF
az devops invoke --area wit --resource workItems \
  --route-parameters project=engineering id=12345 \
  --http-method PATCH \
  --in-file /tmp/relation.json
```

### Release Pipelines

```bash
# List release definitions
az devops invoke --area release --resource definitions \
  --route-parameters project=engineering \
  -o json | jq '.value[] | {id, name}'

# Get release details
az devops invoke --area release --resource releases \
  --route-parameters project=engineering releaseId=100 \
  -o json

# List deployments
az devops invoke --area release --resource deployments \
  --route-parameters project=engineering \
  --query-parameters definitionId=5 \
  -o json | jq '.value[] | {id, status, environment: .releaseEnvironment.name}'
```

## Pipeline Monitoring Script

Complete script for monitoring a CI build with early failure detection:

```bash
#!/bin/bash
set -e

BUILD_ID="$1"
PROJECT="engineering"
MAX_WAIT=3600  # 1 hour timeout

# Set defaults
az devops configure --defaults organization=https://yammer.visualstudio.com project=$PROJECT

echo "Monitoring build $BUILD_ID..."

start_time=$(date +%s)
while true; do
  # Check timeout
  elapsed=$(($(date +%s) - start_time))
  if [ $elapsed -gt $MAX_WAIT ]; then
    echo "Timeout waiting for build"
    exit 1
  fi

  # Get build status
  BUILD=$(az pipelines runs show --id $BUILD_ID -o json)
  STATUS=$(echo "$BUILD" | jq -r '.status')
  RESULT=$(echo "$BUILD" | jq -r '.result // "pending"')

  echo "$(date +%H:%M:%S) - Status: $STATUS, Result: $RESULT"

  # Check if completed
  if [ "$STATUS" = "completed" ]; then
    if [ "$RESULT" = "succeeded" ]; then
      echo "BUILD PASSED"
      exit 0
    else
      echo "BUILD FAILED: $RESULT"

      # Get failed tasks from timeline
      az devops invoke --area build --resource timeline \
        --route-parameters project=$PROJECT buildId=$BUILD_ID \
        -o json | jq -r '.records[] | select(.result == "failed") | "FAILED: \(.name)"'

      # Get error messages
      az devops invoke --area build --resource timeline \
        --route-parameters project=$PROJECT buildId=$BUILD_ID \
        -o json | jq -r '.records[].issues[]? | select(.type == "error") | "ERROR: \(.message)"'

      exit 1
    fi
  fi

  # Check for early failures (don't wait for full build)
  FAILED=$(az devops invoke --area build --resource timeline \
    --route-parameters project=$PROJECT buildId=$BUILD_ID \
    -o json 2>/dev/null | jq -r '.records[] | select(.result == "failed" and .type == "Task") | .name' | head -1)

  if [ -n "$FAILED" ]; then
    echo "Early failure detected: $FAILED"
    # Continue to let build finish or cancel here
  fi

  sleep 30
done
```

## Common API Versions

| Area   | Resource              | Recommended Version |
| ------ | --------------------- | ------------------- |
| build  | timeline              | 7.1                 |
| build  | logs                  | 7.1                 |
| build  | artifacts             | 7.1                 |
| test   | runs                  | 7.1                 |
| test   | results               | 7.1                 |
| git    | pullRequestThreads    | 7.1                 |
| git    | pullRequestIterations | 7.1                 |
| wit    | workItems             | 7.1                 |
| policy | evaluations           | 7.1                 |
