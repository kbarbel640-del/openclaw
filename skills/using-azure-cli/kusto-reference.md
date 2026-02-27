# Azure Data Explorer (Kusto) CLI Reference

Manage Azure Data Explorer clusters, databases, and run queries via Azure CLI.

## Contents

- [Prerequisites](#prerequisites)
- [Cluster Management](#cluster-management)
- [Database Management](#database-management)
- [Running Queries](#running-queries)
- [Data Operations](#data-operations)
- [Monitoring and Diagnostics](#monitoring-and-diagnostics)
- [az rest for Kusto APIs](#az-rest-for-kusto-apis)

## Prerequisites

```bash
# Install kusto extension
az extension add --name kusto

# Verify installation
az extension show --name kusto
```

## Cluster Management

### List and Show Clusters

```bash
# List all clusters in subscription
az kusto cluster list -o table

# List clusters in resource group
az kusto cluster list -g myResourceGroup -o table

# Show cluster details
az kusto cluster show -g myRG -n myCluster -o json

# Get cluster URI for queries
az kusto cluster show -g myRG -n myCluster --query uri -o tsv
# Returns: https://myCluster.westus2.kusto.windows.net
```

### Cluster Operations

```bash
# Start stopped cluster
az kusto cluster start -g myRG -n myCluster

# Stop cluster (to save costs)
az kusto cluster stop -g myRG -n myCluster

# Check cluster state
az kusto cluster show -g myRG -n myCluster --query state -o tsv
# States: Running, Stopped, Starting, Stopping

# Scale cluster
az kusto cluster update -g myRG -n myCluster \
  --sku name=Standard_D13_v2 tier=Standard capacity=4
```

### List Available SKUs

```bash
# List SKUs for a location
az kusto cluster list-sku --location westus2 -o table
```

## Database Management

### List and Show Databases

```bash
# List databases in cluster
az kusto database list -g myRG --cluster-name myCluster -o table

# Show database details
az kusto database show -g myRG --cluster-name myCluster -n myDatabase

# Get database connection string
CLUSTER_URI=$(az kusto cluster show -g myRG -n myCluster --query uri -o tsv)
echo "${CLUSTER_URI}/myDatabase"
```

### Database Operations

```bash
# Create read-write database
az kusto database create -g myRG --cluster-name myCluster \
  --database-name myDatabase \
  --read-write-database soft-delete-period=P365D hot-cache-period=P31D

# Delete database
az kusto database delete -g myRG --cluster-name myCluster -n myDatabase --yes
```

## Running Queries

### Using az rest for Queries

The `az kusto` extension doesn't have a direct query command. Use `az rest` instead:

```bash
# Get cluster URI
CLUSTER_URI="https://myCluster.westus2.kusto.windows.net"
DATABASE="myDatabase"

# Run a KQL query
az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/query" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \"trace | take 10\"}"

# Run query and extract results
az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/query" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \"trace | count\"}" \
  | jq '.Tables[0].Rows'
```

### Management Commands (.show, .create)

```bash
# Show tables
az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/mgmt" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \".show tables\"}"

# Show table schema
az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/mgmt" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \".show table MyTable schema as json\"}"

# Show database policies
az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/mgmt" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \".show database ${DATABASE} policy retention\"}"
```

### Helper Function for Queries

```bash
# Add to your script or shell config
kusto_query() {
  local cluster="$1"
  local db="$2"
  local query="$3"

  az rest --method POST \
    --uri "${cluster}/v1/rest/query" \
    --headers "Content-Type=application/json" \
    --body "{\"db\": \"${db}\", \"csl\": \"${query}\"}" \
    | jq -r '.Tables[0] | [.Columns[].ColumnName] as $cols | .Rows[] | [$cols, .] | transpose | map("\(.[0]): \(.[1])") | join("\n")'
}

# Usage
kusto_query "https://myCluster.kusto.windows.net" "myDB" "trace | take 5"
```

## Data Operations

### Ingestion

```bash
# Ingest from blob storage (via management command)
INGEST_CMD='.ingest into table MyTable (h@"https://storage.blob.core.windows.net/container/file.csv;SECRET") with (format="csv", ignoreFirstRecord=true)'

az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/mgmt" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \"${INGEST_CMD}\"}"
```

### Export Data

```bash
# Export to blob storage
EXPORT_CMD='.export to csv (h@"https://storage.blob.core.windows.net/export/data.csv;SECRET") <| MyTable | where Timestamp > ago(1d)'

az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/mgmt" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \"${EXPORT_CMD}\"}"
```

## Monitoring and Diagnostics

### Cluster Health

```bash
# Get cluster principal assignments (access)
az kusto cluster-principal-assignment list -g myRG --cluster-name myCluster

# Get database principals
az kusto database-principal-assignment list -g myRG --cluster-name myCluster --database-name myDB
```

### Diagnostic Settings

```bash
# List diagnostic settings
az monitor diagnostic-settings list \
  --resource $(az kusto cluster show -g myRG -n myCluster --query id -o tsv)

# Create diagnostic setting to send logs to Log Analytics
az monitor diagnostic-settings create \
  --name "kusto-diagnostics" \
  --resource $(az kusto cluster show -g myRG -n myCluster --query id -o tsv) \
  --workspace $(az monitor log-analytics workspace show -g myRG -n myWorkspace --query id -o tsv) \
  --logs '[{"category": "SucceededIngestion", "enabled": true}, {"category": "FailedIngestion", "enabled": true}]'
```

## az rest for Kusto APIs

For operations not covered by `az kusto`, use the REST API directly:

### Cluster Operations via REST

```bash
# Get cluster details via ARM API
az rest --method GET \
  --uri "https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Kusto/clusters/{cluster}?api-version=2023-08-15"

# List databases via ARM API
az rest --method GET \
  --uri "https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Kusto/clusters/{cluster}/databases?api-version=2023-08-15"
```

### Query Performance

```bash
# Show running queries
az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/mgmt" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \".show queries\"}"

# Show query stats
az rest --method POST \
  --uri "${CLUSTER_URI}/v1/rest/mgmt" \
  --headers "Content-Type=application/json" \
  --body "{\"db\": \"${DATABASE}\", \"csl\": \".show queries | where StartedOn > ago(1h) | summarize count(), avg(Duration) by User\"}"
```

## Common Clusters

| Name          | URI                                      | Databases             |
| ------------- | ---------------------------------------- | --------------------- |
| Aria          | `kusto.aria.microsoft.com`               | Teams iOS telemetry   |
| Teams         | `teams.kusto.windows.net`                | TeamsMessagingService |
| Yammer        | `yammer.kusto.windows.net`               | Yammer production     |
| Yammer EngSys | `yammerengsys.westus2.kusto.windows.net` | ADO data              |

## Verification

After running kusto commands:

1. **Verify extension:** `az extension show --name kusto` succeeds
2. **Verify cluster access:** `az kusto cluster show -g myRG -n myCluster` returns data
3. **Verify query access:** Query returns results (check authentication)
4. **Verify VPN:** For Aria cluster, ensure Azure VPN is connected

## Related

- `/querying-azure-data-explorer` - Custom Python tool for queries
- `/creating-adx-dashboards` - Dashboard creation
- [query-patterns.md](../querying-azure-data-explorer/query-patterns.md) - KQL patterns
