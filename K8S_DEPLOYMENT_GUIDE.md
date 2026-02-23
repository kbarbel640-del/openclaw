# Production-Grade Kubernetes Deployment Guide

## Overview

This guide covers deploying OpenClaw on Kubernetes in a production-ready configuration with:

- ✅ High availability (3+ replicas, pod disruption budgets, anti-affinity)
- ✅ Auto-scaling (HPA with CPU/memory metrics)
- ✅ Resource management (requests, limits, QoS)
- ✅ Security (RBAC, SecurityContext, NetworkPolicy)
- ✅ Monitoring (Prometheus metrics, ServiceMonitor)
- ✅ Networking (Ingress, Service mesh ready)
- ✅ Storage (Persistent volumes for config and workspace)
- ✅ Health checks (liveness, readiness, startup probes)

## Architecture

```
┌─────────────────────────────────────────────┐
│          Kubernetes Cluster                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Ingress (nginx / Traefik)          │   │
│  │  - TLS termination                  │   │
│  │  - Rate limiting                    │   │
│  └─────────────────────────────────────┘   │
│            ↓                                 │
│  ┌─────────────────────────────────────┐   │
│  │  Service (openclaw-gateway-lb)      │   │
│  │  - LoadBalancer / NodePort          │   │
│  └─────────────────────────────────────┘   │
│            ↓                                 │
│  ┌─────────────────────────────────────┐   │
│  │  Deployment (3+ replicas)           │   │
│  │  - openclaw-gateway-0               │   │
│  │  - openclaw-gateway-1               │   │
│  │  - openclaw-gateway-2               │   │
│  │  ┌──────────────────────────────┐   │   │
│  │  │ PVC (config): 10Gi           │   │   │
│  │  │ PVC (workspace): 50Gi        │   │   │
│  │  │ ConfigMap + Secrets          │   │   │
│  │  └──────────────────────────────┘   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  HPA (3-10 replicas)                │   │
│  │  - CPU: 70%, Memory: 80%            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Monitoring (Prometheus)            │   │
│  │  - ServiceMonitor                   │   │
│  │  - PrometheusRule / Alerts          │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

## Prerequisites

### Cluster Requirements
- Kubernetes 1.24+
- 2+ nodes (for anti-affinity and high availability)
- 4GB+ memory per node
- 40GB+ persistent storage

### Required Components
- Storage provisioner (e.g., local-path, EBS, GCE persistent disks)
- Ingress controller (nginx or Traefik recommended)
- cert-manager (optional, for TLS)
- Prometheus & Grafana (optional, for monitoring)

### Installed Tools
```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify installations
kubectl version --client
helm version
```

## Deployment Methods

### Method 1: Direct Kubernetes Manifests (Recommended for learning)

```bash
# 1. Create namespace and core resources
kubectl apply -f k8s/00-namespace-and-core.yaml

# 2. Apply ingress and network policies
kubectl apply -f k8s/01-ingress-and-network.yaml

# 3. Apply CLI and job resources (optional)
kubectl apply -f k8s/02-cli-and-jobs.yaml

# 4. Verify deployment
kubectl get all -n openclaw
kubectl get pvc -n openclaw
kubectl logs -n openclaw deployment/openclaw-gateway -f
```

### Method 2: Helm Chart (Recommended for production)

```bash
# 1. Create values override file
cat > production-values.yaml << 'EOF'
gateway:
  replicaCount: 5
  resources:
    requests:
      cpu: 1000m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 2Gi
  ingress:
    enabled: true
    hosts:
      - host: openclaw.example.com
        paths:
          - path: /
            pathType: Prefix

storage:
  config:
    size: 20Gi
  workspace:
    size: 100Gi

secrets:
  OPENCLAW_GATEWAY_TOKEN: "your-secure-token-here"
  OPENCLAW_GATEWAY_PASSWORD: "your-secure-password-here"
  CLAUDE_AI_SESSION_KEY: "your-key"
  CLAUDE_WEB_SESSION_KEY: "your-session"
  CLAUDE_WEB_COOKIE: "your-cookie"
EOF

# 2. Install Helm chart
helm install openclaw helm/openclaw -f production-values.yaml -n openclaw --create-namespace

# 3. Monitor installation
kubectl rollout status deployment/openclaw-gateway -n openclaw

# 4. Upgrade chart (when needed)
helm upgrade openclaw helm/openclaw -f production-values.yaml -n openclaw
```

## Configuration

### 1. Update ConfigMap

Edit `k8s/00-namespace-and-core.yaml` or use Helm values:

```yaml
configMap:
  LOG_LEVEL: "info"
  NODE_ENV: "production"
  OPENCLAW_GATEWAY_BIND: "0.0.0.0"
  OPENCLAW_GATEWAY_PORT: "18789"
```

### 2. Update Secrets

**⚠️ IMPORTANT: Use external secret management in production**

Option A: kubectl secret (development only)
```bash
kubectl create secret generic openclaw-secrets \
  --from-literal=OPENCLAW_GATEWAY_TOKEN="your-token" \
  --from-literal=OPENCLAW_GATEWAY_PASSWORD="your-password" \
  --from-literal=CLAUDE_AI_SESSION_KEY="your-key" \
  --namespace=openclaw
```

Option B: External Secrets Operator (production recommended)
```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: openclaw-secret-store
  namespace: openclaw
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: openclaw

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: openclaw-secrets
  namespace: openclaw
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: openclaw-secret-store
    kind: SecretStore
  target:
    name: openclaw-secrets
    creationPolicy: Owner
  data:
  - secretKey: OPENCLAW_GATEWAY_TOKEN
    remoteRef:
      key: openclaw/gateway-token
```

### 3. Update Storage Classes

Set your preferred storage class in values or manifests:

```yaml
# For AWS EBS
storageClassName: gp3

# For GKE
storageClassName: standard-rwo

# For local storage
storageClassName: local-path
```

### 4. Configure Ingress

Edit ingress hostname and TLS:

```yaml
ingress:
  hosts:
    - host: openclaw.example.com
  tls:
    - secretName: openclaw-tls
      hosts:
        - openclaw.example.com
```

## Verification & Health Checks

```bash
# Check pod status
kubectl get pods -n openclaw
kubectl describe pod -n openclaw deployment/openclaw-gateway

# Check logs
kubectl logs -n openclaw deployment/openclaw-gateway -f

# Check services
kubectl get svc -n openclaw
kubectl get ingress -n openclaw

# Test health endpoint
kubectl port-forward -n openclaw svc/openclaw-gateway 18789:18789 &
curl http://localhost:18789/health

# Check PVCs
kubectl get pvc -n openclaw
kubectl describe pvc -n openclaw openclaw-config-pvc
```

## Scaling

### Manual Scaling
```bash
kubectl scale deployment openclaw-gateway --replicas=5 -n openclaw
```

### Auto-Scaling Configuration

Edit HPA in manifests:

```yaml
spec:
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

Check HPA status:
```bash
kubectl get hpa -n openclaw
kubectl describe hpa openclaw-gateway-hpa -n openclaw
```

## Monitoring & Observability

### Enable Prometheus Monitoring

1. Install Prometheus Operator (if not already installed)
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack
```

2. Enable ServiceMonitor in Helm values:
```yaml
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
```

3. View metrics:
```bash
# Port-forward Prometheus
kubectl port-forward -n prometheus svc/prometheus-kube-prometheus-prometheus 9090:9090

# Port-forward Grafana
kubectl port-forward -n prometheus svc/prometheus-grafana 3000:3000
```

### Create Grafana Dashboard

Import dashboard JSON or use Prometheus queries:

```promql
# CPU usage
rate(container_cpu_usage_seconds_total{pod=~"openclaw-gateway-.*"}[5m])

# Memory usage
container_memory_usage_bytes{pod=~"openclaw-gateway-.*"} / 1024 / 1024

# Request rate
rate(http_requests_total{pod=~"openclaw-gateway-.*"}[5m])

# Error rate
rate(http_requests_total{pod=~"openclaw-gateway-.*",status=~"5.."}[5m])
```

## Backup & Disaster Recovery

### Backup PVCs

```bash
# Snapshot approach
kubectl exec -n openclaw <pod> -- sh -c "tar czf - /home/node/.openclaw" > config-backup.tar.gz

# Restore
kubectl exec -n openclaw <pod> -- sh -c "tar xzf - -C /" < config-backup.tar.gz
```

### Backup manifests

```bash
# Save all resources
kubectl get all,pvc,cm,secret -n openclaw -o yaml > openclaw-backup.yaml

# Restore
kubectl apply -f openclaw-backup.yaml
```

## Troubleshooting

### Pod not starting

```bash
# Check events
kubectl describe pod -n openclaw <pod-name>

# Check logs
kubectl logs -n openclaw <pod-name>

# Check resource constraints
kubectl top pod -n openclaw
kubectl top node
```

### Service unreachable

```bash
# Check service endpoints
kubectl get endpoints -n openclaw openclaw-gateway

# Check network policy
kubectl get networkpolicy -n openclaw
kubectl describe networkpolicy openclaw-network-policy -n openclaw

# Test connectivity
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
# Inside pod: wget http://openclaw-gateway:18789/health
```

### Storage issues

```bash
# Check PVC status
kubectl get pvc -n openclaw
kubectl describe pvc -n openclaw openclaw-config-pvc

# Check persistent volume status
kubectl get pv
```

## Production Best Practices

### 1. Security

- [ ] Use secrets management system (HashiCorp Vault, AWS Secrets Manager)
- [ ] Enable RBAC and NetworkPolicy
- [ ] Use SecurityContext with non-root user
- [ ] Regularly update images
- [ ] Enable Pod Security Policies

### 2. High Availability

- [ ] Minimum 3 replicas per pod
- [ ] Pod Disruption Budgets enabled
- [ ] Anti-affinity rules for pod distribution
- [ ] Cluster autoscaling enabled
- [ ] Multi-zone deployment

### 3. Resource Management

- [ ] Set requests and limits
- [ ] Use Horizontal Pod Autoscaler
- [ ] Monitor resource utilization
- [ ] Plan for growth

### 4. Monitoring & Logging

- [ ] Prometheus metrics enabled
- [ ] Alerting rules configured
- [ ] Centralized logging (ELK, Loki)
- [ ] Log retention policies
- [ ] Distributed tracing (optional)

### 5. Disaster Recovery

- [ ] Regular backups of PVCs
- [ ] Manifest version control
- [ ] Documented recovery procedures
- [ ] Regular disaster recovery drills
- [ ] Multi-region setup (optional)

## Updates & Rollbacks

### Rolling Update

```bash
# Update image
kubectl set image deployment/openclaw-gateway \
  openclaw-gateway=ghcr.io/openclaw/openclaw:v2026.3.0 \
  -n openclaw

# Check rollout status
kubectl rollout status deployment/openclaw-gateway -n openclaw

# View rollout history
kubectl rollout history deployment/openclaw-gateway -n openclaw
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/openclaw-gateway -n openclaw

# Rollback to specific revision
kubectl rollout undo deployment/openclaw-gateway --to-revision=2 -n openclaw
```

## Cost Optimization

### Resource Requests

Reduce request/limit if metrics show lower usage:

```yaml
resources:
  requests:
    cpu: 250m      # Reduced from 500m
    memory: 256Mi   # Reduced from 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

### Spot Instances (if using cloud)

```yaml
nodeSelector:
  cloud.google.com/gke-preemptible: "true"  # GKE spot
tolerations:
- key: cloud.google.com/gke-preemptible
  operator: Equal
  value: "true"
  effect: NoSchedule
```

### Cluster Autoscaling

Enable autoscaler to scale down unused nodes:

```bash
# GKE
gcloud container clusters update CLUSTER --enable-autoscaling \
  --min-nodes 2 --max-nodes 10

# AWS EKS
eksctl create nodegroup --cluster=CLUSTER --nodes=2 --nodes-max=10
```

## Links & Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Helm Documentation](https://helm.sh/docs/)
- [Kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [Cert-manager](https://cert-manager.io/)
- [External Secrets Operator](https://external-secrets.io/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
