# Domain-Specific Azure Patterns

Patterns for Teams/Yammer-specific Azure DevOps and ECS workflows.

## ECS Configuration Queries

ECS (Experimentation and Configuration Service) controls feature flags. To investigate ECS config changes:

```bash
# Get token for Azure DevOps API
TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)

# Search for ECS config PRs by config ID
az repos pr list \
  --org https://domoreexp.visualstudio.com \
  -p MSTeams \
  --repository ecs-iris-configs \
  --status all \
  --query "[?contains(title, '1653454')]" \
  -o table

# Search by feature flag name in PR descriptions
az repos pr list \
  --org https://domoreexp.visualstudio.com \
  -p MSTeams \
  --repository ecs-iris-configs \
  --status completed \
  --top 50 \
  -o json | jq '.[] | select(.description | contains("trinityAppEnabled"))'
```

**Note:** ECS changes may also be made via:

1. Scheduled deployments (no PR)
2. Direct portal edits (no PR)
3. Automated rollout pipelines

## Entitlements and Access Requests

When you need access to Azure resources, Kusto databases, or other Microsoft services:

| Portal            | URL                                                                                                    | Use For                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **Core Identity** | [coreidentity.microsoft.com/manage/Entitlement](https://coreidentity.microsoft.com/manage/Entitlement) | Primary entitlement portal - search by service name |
| **MyAccess**      | [aka.ms/myaccess](https://aka.ms/myaccess)                                                             | Alternative access request portal                   |
| **Gaia**          | [aka.ms/gaia](https://aka.ms/gaia)                                                                     | Chatbot for access help                             |

**Common entitlements:**

- Search for service/database name (e.g., "TeamsMessagingService", "Teams Engineering")
- Request "Reader" role for read-only access
- Access changes can take up to 30 minutes to propagate

## Pipeline Monitoring with Early Failure Detection

**ALWAYS use this pattern** when watching CI - stop on first failure to save time:

```bash
# Monitor pipeline with early failure detection
BUILD_ID=12345
ORG="https://yammer.visualstudio.com"
PROJECT="engineering"

for i in {1..40}; do
  STATUS=$(az pipelines runs show --org $ORG -p $PROJECT --id $BUILD_ID -o json 2>/dev/null | jq -r '"\(.status)|\(.result // "pending")"')
  CURRENT_STATUS=$(echo "$STATUS" | cut -d'|' -f1)
  RESULT=$(echo "$STATUS" | cut -d'|' -f2)
  echo "$(date +%H:%M:%S) - $CURRENT_STATUS / $RESULT"

  # Exit on completion
  if [ "$CURRENT_STATUS" = "completed" ]; then
    [ "$RESULT" = "succeeded" ] && echo "✓ SUCCEEDED!" || echo "✗ FAILED"
    break
  fi

  # Check for early task failures (stop watching immediately)
  FAILED=$(az devops invoke --area build --resource timeline \
    --route-parameters project=$PROJECT buildId=$BUILD_ID \
    --org $ORG -o json 2>/dev/null | \
    jq -r '.records[] | select(.result == "failed" and .type == "Task") | .name' | head -1)

  if [ -n "$FAILED" ]; then
    echo "✗ Early failure detected: $FAILED"
    echo "Check logs: $ORG/$PROJECT/_build/results?buildId=$BUILD_ID"
    break
  fi

  sleep 30
done
```

This pattern:

- Polls every 30 seconds
- Detects task failures mid-run (don't wait for full completion)
- Prints early failure name so you can investigate immediately
- Saves 10-15 minutes vs waiting for full pipeline completion
