# Azure CLI Common Workflows

## CI/CD Pipeline Workflows

### Create Full Feature Branch Workflow

```bash
#!/bin/bash
# Feature branch to PR workflow

FEATURE_NAME="$1"
WORK_ITEM_ID="$2"

# Create and checkout branch
git checkout -b "feature/$FEATURE_NAME"

# ... make changes, commit ...

# Push branch
git push -u origin "feature/$FEATURE_NAME"

# Create PR with work item link and auto-complete
az repos pr create \
  --title "Feature: $FEATURE_NAME" \
  --source-branch "feature/$FEATURE_NAME" \
  --target-branch main \
  --draft true \
  --work-items "$WORK_ITEM_ID" \
  --auto-complete true \
  --delete-source-branch true \
  --squash true
```

### Monitor Pipeline Run

```bash
#!/bin/bash
# Run pipeline and wait for completion

PIPELINE_NAME="$1"

# Trigger pipeline and get run ID
RUN_ID=$(az pipelines run --name "$PIPELINE_NAME" --query "id" -o tsv)
echo "Started pipeline run: $RUN_ID"

# Poll for completion
while true; do
  STATUS=$(az pipelines runs show --id "$RUN_ID" --query "status" -o tsv)
  RESULT=$(az pipelines runs show --id "$RUN_ID" --query "result" -o tsv)

  echo "Status: $STATUS, Result: $RESULT"

  if [ "$STATUS" = "completed" ]; then
    if [ "$RESULT" = "succeeded" ]; then
      echo "Pipeline succeeded!"
      exit 0
    else
      echo "Pipeline failed with result: $RESULT"
      exit 1
    fi
  fi

  sleep 30
done
```

### Deploy with Variable Substitution

```bash
#!/bin/bash
# Deploy to environment with variables

ENVIRONMENT="$1"  # dev, staging, prod

az pipelines run --name "Deploy" \
  --variables \
    "environment=$ENVIRONMENT" \
    "imageTag=$(git rev-parse --short HEAD)" \
    "deployTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

## Resource Management Workflows

### Create Complete Web App Environment

```bash
#!/bin/bash
# Create resource group, App Service plan, and Web App

RG_NAME="myapp-rg"
LOCATION="eastus"
APP_NAME="mywebapp"
PLAN_NAME="myapp-plan"

# Create resource group
az group create --name "$RG_NAME" --location "$LOCATION"

# Create App Service plan
az appservice plan create \
  --name "$PLAN_NAME" \
  --resource-group "$RG_NAME" \
  --location "$LOCATION" \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name "$APP_NAME" \
  --resource-group "$RG_NAME" \
  --plan "$PLAN_NAME" \
  --runtime "NODE:18-lts"

# Configure app settings
az webapp config appsettings set \
  --name "$APP_NAME" \
  --resource-group "$RG_NAME" \
  --settings \
    NODE_ENV=production \
    APP_INSIGHTS_KEY="@Microsoft.KeyVault(SecretUri=...)"

# Enable logging
az webapp log config \
  --name "$APP_NAME" \
  --resource-group "$RG_NAME" \
  --docker-container-logging filesystem \
  --level verbose
```

### AKS Cluster Setup

```bash
#!/bin/bash
# Create AKS cluster with best practices

RG_NAME="aks-rg"
CLUSTER_NAME="myaks"
LOCATION="eastus"

# Create resource group
az group create --name "$RG_NAME" --location "$LOCATION"

# Create AKS cluster
az aks create \
  --resource-group "$RG_NAME" \
  --name "$CLUSTER_NAME" \
  --node-count 3 \
  --node-vm-size Standard_DS2_v2 \
  --enable-managed-identity \
  --enable-addons monitoring \
  --generate-ssh-keys \
  --network-plugin azure \
  --network-policy azure \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 5

# Get credentials
az aks get-credentials --resource-group "$RG_NAME" --name "$CLUSTER_NAME"

# Verify
kubectl get nodes
```

### Storage Account with Containers

```bash
#!/bin/bash
# Create storage account and blob containers

RG_NAME="storage-rg"
STORAGE_NAME="mystorageacct"  # Must be globally unique
LOCATION="eastus"

# Create storage account
az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RG_NAME" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true \
  --min-tls-version TLS1_2

# Get connection string
CONN_STR=$(az storage account show-connection-string \
  --name "$STORAGE_NAME" \
  --resource-group "$RG_NAME" \
  --query connectionString -o tsv)

# Create containers
az storage container create --name "uploads" --connection-string "$CONN_STR"
az storage container create --name "backups" --connection-string "$CONN_STR" --public-access off
az storage container create --name "public" --connection-string "$CONN_STR" --public-access blob
```

## Work Item Workflows

### Sprint Planning Helper

```bash
#!/bin/bash
# Create sprint work items from a list

SPRINT="Sprint 5"
STORIES=(
  "Implement user dashboard"
  "Add export to PDF feature"
  "Optimize database queries"
)

for story in "${STORIES[@]}"; do
  az boards work-item create \
    --title "$story" \
    --type "User Story" \
    --iteration "Project\\$SPRINT"
done
```

### Bulk Update Work Items

```bash
#!/bin/bash
# Update all active bugs assigned to user

USER="user@example.com"
NEW_STATE="Resolved"

# Get bug IDs
BUG_IDS=$(az boards query \
  --wiql "SELECT [System.Id] FROM WorkItems \
          WHERE [System.WorkItemType] = 'Bug' \
          AND [System.State] = 'Active' \
          AND [System.AssignedTo] = '$USER'" \
  --query "[].id" -o tsv)

# Update each bug
for id in $BUG_IDS; do
  echo "Updating bug $id..."
  az boards work-item update --id "$id" --state "$NEW_STATE"
done
```

### Link PR to Work Items

```bash
#!/bin/bash
# Create PR and link multiple work items

PR_TITLE="$1"
shift
WORK_ITEMS="$@"  # Remaining args are work item IDs

az repos pr create \
  --title "$PR_TITLE" \
  --source-branch "$(git branch --show-current)" \
  --target-branch main \
  --draft true \
  --work-items $WORK_ITEMS
```

## Monitoring and Diagnostics

### Get VM Diagnostics

```bash
#!/bin/bash
# Collect VM diagnostics

RG_NAME="$1"
VM_NAME="$2"

echo "=== VM Status ==="
az vm get-instance-view \
  --resource-group "$RG_NAME" \
  --name "$VM_NAME" \
  --query "instanceView.statuses[*].{Code:code,Status:displayStatus}" \
  -o table

echo "=== VM Sizes ==="
az vm show \
  --resource-group "$RG_NAME" \
  --name "$VM_NAME" \
  --query "{Size:hardwareProfile.vmSize,OS:storageProfile.osDisk.osType}" \
  -o table

echo "=== Recent Activity ==="
az monitor activity-log list \
  --resource-group "$RG_NAME" \
  --offset 1h \
  --query "[?contains(resourceId,'$VM_NAME')].{Time:eventTimestamp,Operation:operationName.localizedValue,Status:status.value}" \
  -o table
```

### Check Pipeline Health

```bash
#!/bin/bash
# Check recent pipeline runs health

PIPELINE_NAME="$1"
DAYS=7

echo "Pipeline: $PIPELINE_NAME - Last $DAYS days"
echo "========================================="

az pipelines runs list \
  --pipeline-name "$PIPELINE_NAME" \
  --top 20 \
  --query "[].{ID:id,Status:status,Result:result,Branch:sourceBranch,Started:createdDate}" \
  -o table

echo ""
echo "Summary:"
TOTAL=$(az pipelines runs list --pipeline-name "$PIPELINE_NAME" --top 20 --query "length(@)")
SUCCEEDED=$(az pipelines runs list --pipeline-name "$PIPELINE_NAME" --top 20 --query "length([?result=='succeeded'])")
echo "Success rate: $SUCCEEDED / $TOTAL"
```

## Cleanup Workflows

### Delete Old Resources

```bash
#!/bin/bash
# Delete resource groups matching pattern older than N days

PATTERN="test-"
DAYS_OLD=7
CUTOFF_DATE=$(date -d "$DAYS_OLD days ago" +%Y-%m-%d)

# Find and delete old resource groups
az group list \
  --query "[?starts_with(name,'$PATTERN') && tags.createdDate < '$CUTOFF_DATE'].name" \
  -o tsv | while read rg; do
    echo "Deleting resource group: $rg"
    az group delete --name "$rg" --yes --no-wait
done
```

### Clean Up Failed Pipeline Runs

```bash
#!/bin/bash
# List failed pipeline runs for investigation

az pipelines runs list \
  --query "[?result=='failed'].{ID:id,Pipeline:definition.name,Branch:sourceBranch,Time:finishTime}" \
  -o table
```

## Security Workflows

### Rotate Service Principal Secret

```bash
#!/bin/bash
# Rotate service principal secret

APP_ID="$1"

# Create new secret
NEW_SECRET=$(az ad sp credential reset \
  --id "$APP_ID" \
  --query password -o tsv)

echo "New secret created. Update your secrets storage."
echo "Secret: $NEW_SECRET"

# Update in Key Vault (if using)
# az keyvault secret set --vault-name "myvault" --name "sp-secret" --value "$NEW_SECRET"
```

### Audit Resource Access

```bash
#!/bin/bash
# List role assignments for a resource

RESOURCE_ID="$1"

az role assignment list \
  --scope "$RESOURCE_ID" \
  --query "[].{Principal:principalName,Role:roleDefinitionName,Scope:scope}" \
  -o table
```

## Quick One-Liners

```bash
# List all VMs across subscriptions
az vm list --query "[].{Name:name,RG:resourceGroup,Size:hardwareProfile.vmSize,State:powerState}" -o table

# Find unused public IPs
az network public-ip list --query "[?ipConfiguration==null].{Name:name,RG:resourceGroup}" -o table

# List expiring secrets in Key Vault
az keyvault secret list --vault-name "myvault" --query "[?attributes.expires < '2024-01-01'].{Name:name,Expires:attributes.expires}" -o table

# Get cost for resource group
az consumption usage list --start-date 2024-01-01 --end-date 2024-01-31 --query "[?contains(instanceId,'myResourceGroup')].{Cost:pretaxCost,Currency:currency}"

# Export ARM template from resource group
az group export --name "myRG" --output-folder ./templates

# List all tags in subscription
az tag list -o table

# Find resources without tags
az resource list --query "[?tags==null].{Name:name,Type:type,RG:resourceGroup}" -o table
```

## Environment Variables Reference

```bash
# Azure CLI
export AZURE_CONFIG_DIR=~/.azure          # Config directory
export AZURE_DEFAULTS_LOCATION=eastus     # Default location
export AZURE_DEFAULTS_GROUP=myRG          # Default resource group

# Azure DevOps
export AZURE_DEVOPS_EXT_PAT=<pat>        # Personal access token
export AZURE_DEVOPS_ORG_URL=https://dev.azure.com/myorg

# Disable telemetry
export AZURE_CORE_COLLECT_TELEMETRY=false

# Output settings
export AZURE_CORE_OUTPUT=table            # Default output format
export AZURE_CORE_NO_COLOR=true           # Disable colors
```
