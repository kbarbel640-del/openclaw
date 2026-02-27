# Azure Resources Reference

Detailed commands for Azure resource management including Key Vault, VMs, storage, and Resource Graph.

## Key Vault

Manage secrets, keys, and certificates securely.

### Basic Operations

```bash
# List vaults
az keyvault list -o table

# Create vault
az keyvault create --name my-vault --resource-group myRG --location westus2

# List secrets
az keyvault secret list --vault-name my-vault -o table

# Get secret value
az keyvault secret show --vault-name my-vault --name my-secret --query value -o tsv

# Set secret
az keyvault secret set --vault-name my-vault --name my-secret --value "super-secret-value"

# Delete secret (soft delete)
az keyvault secret delete --vault-name my-vault --name my-secret

# Purge deleted secret (permanent)
az keyvault secret purge --vault-name my-vault --name my-secret
```

### Keys and Certificates

```bash
# Create key
az keyvault key create --vault-name my-vault --name my-key --kty RSA --size 2048

# Import certificate
az keyvault certificate import --vault-name my-vault --name my-cert --file cert.pfx

# Get certificate
az keyvault certificate show --vault-name my-vault --name my-cert
```

### Access Policies

```bash
# Set access policy for user/service principal
az keyvault set-policy --name my-vault \
  --object-id <USER_OR_SP_OBJECT_ID> \
  --secret-permissions get list set delete \
  --key-permissions get list create delete

# Set access policy for managed identity
az keyvault set-policy --name my-vault \
  --object-id $(az identity show -g myRG -n myIdentity --query principalId -o tsv) \
  --secret-permissions get list
```

### Scripting with Secrets

```bash
# Use secret in script (avoid echoing)
DB_PASSWORD=$(az keyvault secret show --vault-name my-vault --name db-password --query value -o tsv)

# Use in environment variable
export API_KEY=$(az keyvault secret show --vault-name my-vault --name api-key --query value -o tsv)

# Bulk export secrets to .env file (be careful with this!)
az keyvault secret list --vault-name my-vault --query "[].name" -o tsv | while read name; do
  value=$(az keyvault secret show --vault-name my-vault --name "$name" --query value -o tsv)
  echo "${name}=${value}" >> .env
done
```

**Security best practices:**

- Never log or echo secret values
- Use managed identities instead of storing credentials
- Enable soft-delete and purge protection
- Rotate secrets regularly
- Use RBAC instead of access policies when possible

## Azure Resource Graph

Query resources across ALL subscriptions with KQL-like syntax.

```bash
# Install extension (if needed)
az extension add --name resource-graph

# Basic query - all VMs
az graph query -q "Resources | where type =~ 'microsoft.compute/virtualmachines'"

# Count resources by type
az graph query -q "Resources | summarize count() by type | order by count_ desc | take 10"

# Find resources by tag
az graph query -q "Resources | where tags.environment == 'production'"

# Query across specific subscriptions
az graph query -q "Resources | where type =~ 'microsoft.storage/storageaccounts'" \
  --subscriptions sub1-id sub2-id

# Get VM sizes and locations
az graph query -q "Resources
  | where type =~ 'microsoft.compute/virtualmachines'
  | project name, location, properties.hardwareProfile.vmSize"

# Find unused disks (not attached to VM)
az graph query -q "Resources
  | where type =~ 'microsoft.compute/disks'
  | where managedBy == ''
  | project name, resourceGroup, sku.name, diskSizeGb"
```

### Resource Graph vs az resource list

| Feature            | `az graph query`  | `az resource list` |
| ------------------ | ----------------- | ------------------ |
| Cross-subscription | All subscriptions | Current only       |
| KQL syntax         | Full KQL          | JMESPath only      |
| Performance        | Fast (indexed)    | Slow (API calls)   |
| Complex joins      | Supported         | Not supported      |

**Always prefer `az graph query` for resource discovery across subscriptions.**

## Virtual Machines

```bash
# Create VM
az vm create --name myVM --resource-group myRG \
  --image Ubuntu2204 --size Standard_B2s \
  --admin-username azureuser --generate-ssh-keys

# List VMs
az vm list -g myRG -o table

# Show VM details
az vm show -g myRG -n myVM -o json

# Start/Stop/Restart
az vm start -g myRG -n myVM
az vm stop -g myRG -n myVM
az vm restart -g myRG -n myVM

# Deallocate (stop billing)
az vm deallocate -g myRG -n myVM

# Get public IP
az vm show -g myRG -n myVM -d --query publicIps -o tsv

# Store VM ID for reuse
VM_ID=$(az vm show -g myRG -n myVM --query id -o tsv)
az vm start --ids $VM_ID
```

## Storage Accounts

```bash
# Create storage account
az storage account create --name mystorageacct --resource-group myRG \
  --sku Standard_LRS --location westus2

# List storage accounts
az storage account list -g myRG -o table

# Get connection string
az storage account show-connection-string --name mystorageacct -g myRG --query connectionString -o tsv

# List containers
az storage container list --account-name mystorageacct -o table

# Create container
az storage container create --name mycontainer --account-name mystorageacct

# Upload blob
az storage blob upload --account-name mystorageacct \
  --container-name mycontainer --name myfile.txt --file ./localfile.txt

# Download blob
az storage blob download --account-name mystorageacct \
  --container-name mycontainer --name myfile.txt --file ./downloaded.txt

# List blobs
az storage blob list --account-name mystorageacct --container-name mycontainer -o table
```

## Azure Kubernetes Service (AKS)

```bash
# Create AKS cluster
az aks create --name myAKS --resource-group myRG \
  --node-count 3 --enable-managed-identity --generate-ssh-keys

# Get credentials (configure kubectl)
az aks get-credentials --name myAKS --resource-group myRG

# List clusters
az aks list -o table

# Show cluster details
az aks show --name myAKS --resource-group myRG -o json

# Scale node pool
az aks scale --name myAKS --resource-group myRG --node-count 5

# Upgrade cluster
az aks upgrade --name myAKS --resource-group myRG --kubernetes-version 1.28.0

# Stop cluster (save costs)
az aks stop --name myAKS --resource-group myRG

# Start cluster
az aks start --name myAKS --resource-group myRG
```

## Resource Groups

```bash
# Create resource group
az group create --name myRG --location westus2

# List resource groups
az group list -o table

# Show resource group
az group show --name myRG

# Delete resource group (and all contents)
az group delete --name myRG --yes --no-wait

# List resources in group
az resource list --resource-group myRG -o table
```
