# Azure DevOps Commands Reference

Detailed commands for Azure DevOps including `az devops invoke` REST API access.

## az devops invoke - Direct REST API Access

`az devops invoke` provides direct access to ANY Azure DevOps REST API with automatic authentication. This is **more powerful** than individual commands and replaces most `curl` calls.

### Basic Syntax

```bash
az devops invoke \
  --area <service-area> \
  --resource <resource> \
  --route-parameters key=value \
  --query-parameters key=value \
  --http-method GET|POST|PATCH|DELETE \
  --in-file input.json \
  -o json
```

### Discovering Areas and Resources

```bash
# List all available areas (service areas)
az devops invoke --area "" --resource "" 2>&1 | grep "area:"

# Common areas:
#   git       - Repositories, PRs, commits
#   build     - Pipelines, builds, artifacts
#   wit       - Work items, queries
#   test      - Test runs, results
#   policy    - Branch policies
#   core      - Projects, teams
```

### Git Operations (PRs, Commits, Threads)

```bash
# Get PR threads (comments)
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  -o json | jq '.value[] | {id, status, comments: [.comments[].content]}'

# Get PR iterations (each push)
az devops invoke --area git --resource pullRequestIterations \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  -o json | jq '.value[] | {id, sourceRefCommit: .sourceRefCommit.commitId}'

# Get PR statuses (checks)
az devops invoke --area git --resource pullRequestStatuses \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  -o json | jq '.value[] | {context: .context.name, state}'

# Post a comment to PR thread
echo '{"content": "Thanks, fixed!"}' > /tmp/comment.json
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 threadId=789 \
  --http-method POST \
  --in-file /tmp/comment.json \
  --api-version 7.1

# Create new PR thread
cat > /tmp/thread.json << 'EOF'
{
  "comments": [{"content": "This looks risky - could cause a retain cycle"}],
  "status": "active",
  "threadContext": {
    "filePath": "/src/MyClass.swift",
    "rightFileStart": {"line": 42, "offset": 1},
    "rightFileEnd": {"line": 42, "offset": 50}
  }
}
EOF
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=engineering repositoryId=ios pullRequestId=12345 \
  --http-method POST \
  --in-file /tmp/thread.json
```

### Build Operations (Pipelines)

```bash
# Get build timeline (task status)
az devops invoke --area build --resource timeline \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq '.records[] | select(.result == "failed")'

# Get build logs
az devops invoke --area build --resource logs \
  --route-parameters project=engineering buildId=12345 logId=15

# Queue a new build
cat > /tmp/build.json << 'EOF'
{
  "definition": {"id": 42},
  "sourceBranch": "refs/heads/feature/x",
  "parameters": "{\"env\": \"staging\"}"
}
EOF
az devops invoke --area build --resource builds \
  --route-parameters project=engineering \
  --http-method POST \
  --in-file /tmp/build.json

# Retry failed stage
az devops invoke --area build --resource stages \
  --route-parameters project=engineering buildId=12345 stageRefName=Build \
  --http-method PATCH \
  --in-file <(echo '{"state": "retry", "forceRetryAllJobs": false}')

# Get build artifacts
az devops invoke --area build --resource artifacts \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq '.value[].name'
```

### Test Operations

```bash
# Get test runs for a build
az devops invoke --area test --resource runs \
  --route-parameters project=engineering \
  --query-parameters buildUri=vstfs:///Build/Build/12345 \
  -o json | jq '.value[] | {id, name, totalTests, passedTests}'

# Get failed test results
RUN_ID=6789
az devops invoke --area test --resource results \
  --route-parameters project=engineering runId=$RUN_ID \
  --query-parameters outcomes=Failed \
  -o json | jq '.value[] | {test: .testCaseTitle, error: .errorMessage}'

# Get test attachments (screenshots, logs)
az devops invoke --area test --resource attachments \
  --route-parameters project=engineering runId=$RUN_ID testCaseResultId=1 \
  -o json | jq '.value[].fileName'
```

### Work Item Operations via invoke

```bash
# Get work item with all fields
az devops invoke --area wit --resource workItems \
  --route-parameters project=engineering id=12345 \
  --query-parameters '$expand=all' \
  -o json

# Update work item (JSON Patch format)
cat > /tmp/update.json << 'EOF'
[
  {"op": "add", "path": "/fields/System.State", "value": "Active"},
  {"op": "add", "path": "/fields/System.AssignedTo", "value": "user@example.com"}
]
EOF
az devops invoke --area wit --resource workItems \
  --route-parameters project=engineering id=12345 \
  --http-method PATCH \
  --in-file /tmp/update.json \
  --api-version 7.1

# Link work item to PR
cat > /tmp/link.json << 'EOF'
[{
  "op": "add",
  "path": "/relations/-",
  "value": {
    "rel": "ArtifactLink",
    "url": "vstfs:///Git/PullRequestId/PROJECT_ID%2FREPO_ID%2F12345"
  }
}]
EOF
az devops invoke --area wit --resource workItems \
  --route-parameters project=engineering id=789 \
  --http-method PATCH \
  --in-file /tmp/link.json
```

### Policy Operations (Branch Policies)

```bash
# List PR policy evaluations
az devops invoke --area policy --resource evaluations \
  --route-parameters project=engineering \
  --query-parameters artifactId=vstfs:///CodeReview/CodeReviewId/PROJECT_ID/12345 \
  -o json | jq '.value[] | {id, status, context: .configuration.type.displayName}'

# Re-queue a policy evaluation
EVAL_ID="abc-123"
az devops invoke --area policy --resource evaluations \
  --route-parameters project=engineering evaluationId=$EVAL_ID \
  --http-method PATCH \
  --in-file <(echo '{"status": "queued"}')
```

### az devops invoke vs curl vs az rest

| Feature        | `az devops invoke`  | `az rest`       | `curl`          |
| -------------- | ------------------- | --------------- | --------------- |
| Auto auth      | Automatic           | With --resource | Manual token    |
| DevOps routing | Built-in            | Full URL needed | Full URL needed |
| Binary upload  | No                  | Corrupts files  | `--data-binary` |
| API discovery  | Error shows options | None            | None            |

**When to use each:**

- `az devops invoke` - Most DevOps operations (PRs, builds, work items)
- `az rest` - Non-DevOps Azure APIs, generic REST
- `curl --data-binary` - Binary file uploads ONLY

## Work Items (az boards)

```bash
# Create bug
az boards work-item create --title "Login broken" --type Bug

# Update state
az boards work-item update --id 123 --state "Active"

# Show details
az boards work-item show --id 123 -o json

# Query (WIQL)
az boards query --wiql "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.State] = 'Active'"

# Query by Area Path (use UNDER for hierarchy)
az boards query --wiql "SELECT [System.Id] FROM WorkItems WHERE [System.AreaPath] UNDER 'Project\\Team\\Feature'"
```

**WIQL Tips:**

- Use `UNDER` for Area Path hierarchies (not `CONTAINS`)
- Escape backslashes: `'Project\\Team\\Feature'`
- Common states: New, Active, Resolved, Closed

## Cross-Organization Queries

**ALWAYS specify `--org` when querying non-default organizations:**

```bash
# List PRs from Teams iOS repo (different org than default)
az repos pr list \
  --org https://domoreexp.visualstudio.com \
  -p MSTeams \
  --repository Teamspace-iOS \
  --status active

# Show PR details (pr show only takes --id and --org, NOT -p/--repository)
az repos pr show --id 1437707 --org https://domoreexp.visualstudio.com

# Get PR commits
az repos pr show --id 1437707 --org https://domoreexp.visualstudio.com \
  --query "commits[].commitId" -o tsv
```

**Common gotcha:** `az repos pr show` does NOT accept `-p` or `--repository` flags - only `--id` and `--org`.

## Pipeline Logs and Artifacts

```bash
# Get build timeline (all tasks with status)
az devops invoke --area build --resource timeline \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq '.records[] | {name, state, result}'

# Get specific task log
LOG_ID=15  # from timeline .log.id field
az devops invoke --area build --resource logs \
  --route-parameters project=engineering buildId=12345 logId=$LOG_ID

# List build artifacts
az devops invoke --area build --resource artifacts \
  --route-parameters project=engineering buildId=12345 \
  -o json | jq '.value[].name'

# Download artifact
az pipelines runs artifact download --artifact-name drop --path ./output --run-id 12345
```

## Pipeline Variables and Parameters

```bash
# Run pipeline with variables
az pipelines run --name "CI" --variables "env=staging" "debug=true"

# Run with parameters (YAML pipelines)
az pipelines run --name "Deploy" --parameters "environment=prod" "region=westus2"

# Get pipeline variables
az devops invoke --area build --resource definitions \
  --route-parameters project=engineering definitionId=42 \
  -o json | jq '.variables'
```
