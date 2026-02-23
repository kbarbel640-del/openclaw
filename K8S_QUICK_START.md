# Kubernetes Quick Start Guide

## 30-Minute Production Deployment

### Step 1: Prerequisites (5 min)

```bash
# Verify kubectl is installed and can access cluster
kubectl cluster-info
kubectl get nodes

# Verify storage class
kubectl get storageclass

# Verify ingress controller
kubectl get ingressclass
```

### Step 2: Deploy with Kubectl (10 min)

```bash
# Option A: Direct manifests
kubectl apply -f k8s/00-namespace-and-core.yaml
kubectl apply -f k8s/01-ingress-and-network.yaml
kubectl apply -f k8s/02-cli-and-jobs.yaml

# Option B: Kustomize (production overlay)
kubectl apply -k k8s/kustomize/overlays/production
```

### Step 3: Wait for Rollout (5 min)

```bash
# Watch pods starting
watch kubectl get pods -n openclaw

# Wait for ready
kubectl wait --for=condition=ready pod \
  -l app=openclaw-gateway -n openclaw --timeout=300s
```

### Step 4: Verify Deployment (5 min)

```bash
# Check pods
kubectl get pods -n openclaw

# Check services
kubectl get svc -n openclaw

# Test health endpoint
kubectl port-forward -n openclaw svc/openclaw-gateway 18789:18789 &
curl http://localhost:18789/health
```

### Step 5: Configure External Access (5 min)

```bash
# Option A: NodePort (quick testing)
kubectl get svc -n openclaw openclaw-gateway-lb
# Access at: <node-ip>:30789

# Option B: LoadBalancer (production)
kubectl get svc -n openclaw openclaw-gateway-lb
# Wait for external IP to be assigned

# Option C: Ingress (production with TLS)
kubectl get ingress -n openclaw
# Update DNS to point to ingress IP
```

## Common Commands

### View Status

```bash
# All resources
kubectl get all -n openclaw

# Detailed pod status
kubectl describe pod -n openclaw deployment/openclaw-gateway

# Logs
kubectl logs -n openclaw deployment/openclaw-gateway -f
kubectl logs -n openclaw deployment/openclaw-gateway -p  # previous (crashed) pod
```

### Scale

```bash
# Manual scale
kubectl scale deployment openclaw-gateway --replicas=5 -n openclaw

# Check HPA
kubectl get hpa -n openclaw
```

### Update Configuration

```bash
# Update ConfigMap
kubectl edit configmap openclaw-config -n openclaw

# Update Secret
kubectl create secret generic openclaw-secrets \
  --from-literal=OPENCLAW_GATEWAY_TOKEN="new-token" \
  --namespace=openclaw --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new config
kubectl rollout restart deployment/openclaw-gateway -n openclaw
```

### Update Image

```bash
# Set new image
kubectl set image deployment/openclaw-gateway \
  openclaw-gateway=ghcr.io/openclaw/openclaw:v2026.3.0 \
  -n openclaw

# Watch rollout
kubectl rollout status deployment/openclaw-gateway -n openclaw
```

### Troubleshooting

```bash
# Port forward to test locally
kubectl port-forward -n openclaw svc/openclaw-gateway 18789:18789

# Execute command in pod
kubectl exec -it -n openclaw deployment/openclaw-gateway -- sh

# View resource usage
kubectl top pod -n openclaw
kubectl top node

# Check events
kubectl get events -n openclaw --sort-by='.lastTimestamp'
```

## Helm Deployment (Alternative)

```bash
# Install
helm install openclaw ./helm/openclaw \
  --namespace openclaw \
  --create-namespace \
  --set gateway.replicaCount=3 \
  --set secrets.OPENCLAW_GATEWAY_TOKEN="your-token"

# List releases
helm list -n openclaw

# Upgrade
helm upgrade openclaw ./helm/openclaw \
  --namespace openclaw \
  --set gateway.replicaCount=5

# Rollback
helm rollback openclaw -n openclaw

# Uninstall
helm uninstall openclaw -n openclaw
```

## Kustomize Deployment (Alternative)

```bash
# Development environment
kubectl apply -k k8s/kustomize/overlays/development

# Production environment
kubectl apply -k k8s/kustomize/overlays/production

# Preview changes
kubectl kustomize k8s/kustomize/overlays/production

# Apply with dry-run
kubectl apply -k k8s/kustomize/overlays/production --dry-run=client
```

## Production Checklist

- [ ] Cluster has 2+ nodes
- [ ] Storage class is configured
- [ ] Ingress controller installed
- [ ] Secrets are set with production values
- [ ] Replicas set to 3+
- [ ] Resource limits are configured
- [ ] Health checks are working
- [ ] Monitoring is enabled (optional but recommended)
- [ ] Backups are scheduled
- [ ] Network policies are applied

## Cleanup

```bash
# Delete all resources in namespace
kubectl delete namespace openclaw

# Delete helm release
helm uninstall openclaw -n openclaw

# Delete kustomize deployment
kubectl delete -k k8s/kustomize/overlays/production
```

## Next Steps

1. Read `K8S_DEPLOYMENT_GUIDE.md` for detailed configuration
2. Set up monitoring with Prometheus
3. Configure backups with Velero
4. Set up CI/CD with ArgoCD or Flux
5. Implement service mesh (optional, with Istio/Linkerd)

## Need Help?

```bash
# Check cluster health
kubectl get nodes
kubectl get persistentvolumes
kubectl get storageclass

# Debug connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://openclaw-gateway.openclaw:18789/health

# Check resource availability
kubectl describe node <node-name>
```

## Resources

- Full guide: `K8S_DEPLOYMENT_GUIDE.md`
- Manifests: `k8s/*.yaml`
- Helm chart: `helm/openclaw/`
- Kustomize: `k8s/kustomize/`
