# OpenClaw Kubernetes Production Setup

Complete production-grade Kubernetes configuration for OpenClaw with high availability, auto-scaling, monitoring, and security.

## 📦 What's Included

### Kubernetes Manifests (`k8s/`)
- **00-namespace-and-core.yaml** (8.4 KB)
  - Namespace, ConfigMap, Secrets
  - PersistentVolumeClaims (config + workspace)
  - ServiceAccount, RBAC (Role + RoleBinding)
  - Deployment with 3 replicas
  - Services (ClusterIP + LoadBalancer)
  - HorizontalPodAutoscaler (3-10 replicas)
  - PodDisruptionBudget (min 2 available)

- **01-ingress-and-network.yaml** (4.4 KB)
  - Ingress with TLS support
  - NetworkPolicy (ingress/egress control)
  - cert-manager integration
  - ServiceMonitor for Prometheus
  - PrometheusRule with alerting

- **02-cli-and-jobs.yaml** (5.6 KB)
  - StatefulSet for CLI (optional)
  - Job for initialization
  - CronJob for maintenance/cleanup

### Helm Chart (`helm/openclaw/`)
- **Chart.yaml** - Chart metadata
- **values.yaml** - 100+ configurable parameters
- Production-ready with sensible defaults

### Kustomize Overlays (`k8s/kustomize/`)
- **base/** - Base manifests
- **overlays/production/** - Production configuration
- **overlays/development/** - Development configuration

### Documentation
- **K8S_DEPLOYMENT_GUIDE.md** (14 KB) - Comprehensive deployment guide
- **K8S_QUICK_START.md** (5.2 KB) - 30-minute quick start
- **README_K8S.md** (this file) - Overview

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Check cluster access
kubectl cluster-info
kubectl get nodes

# Verify storage and ingress
kubectl get storageclass
kubectl get ingressclass
```

### 2. Deploy (choose one method)

**Method A: Direct Manifests (simplest)**
```bash
kubectl apply -f k8s/00-namespace-and-core.yaml
kubectl apply -f k8s/01-ingress-and-network.yaml
kubectl apply -f k8s/02-cli-and-jobs.yaml
```

**Method B: Helm (recommended for production)**
```bash
helm install openclaw ./helm/openclaw \
  --namespace openclaw --create-namespace \
  --set secrets.OPENCLAW_GATEWAY_TOKEN="your-token"
```

**Method C: Kustomize (enterprise best practices)**
```bash
kubectl apply -k k8s/kustomize/overlays/production
```

### 3. Verify
```bash
kubectl get pods -n openclaw
kubectl logs -n openclaw deployment/openclaw-gateway -f
```

### 4. Access
```bash
# Port-forward for testing
kubectl port-forward -n openclaw svc/openclaw-gateway 18789:18789

# Get external IP (if using LoadBalancer)
kubectl get svc -n openclaw openclaw-gateway-lb
```

## 📊 Architecture

```
┌─────────────────────────────────────────────────────┐
│ Kubernetes Cluster (Production-Grade)               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Ingress (nginx/Traefik) ← TLS, Rate Limiting       │
│     ↓                                                │
│ LoadBalancer Service                                │
│     ↓                                                │
│ Deployment: 3-10 replicas (HPA)                     │
│   ├─ Pod 1 [openclaw-gateway]                       │
│   ├─ Pod 2 [openclaw-gateway]                       │
│   └─ Pod 3 [openclaw-gateway]                       │
│   └─ ... (scales to 10)                             │
│     ↓                                                │
│ Persistent Storage                                  │
│   ├─ Config PVC (10GB)                              │
│   └─ Workspace PVC (50GB)                           │
│                                                     │
│ Monitoring (Prometheus + Grafana)                   │
│ Logging (optional, e.g., Loki)                      │
│ Security (RBAC, NetworkPolicy, SecurityContext)    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 🔧 Key Features

### High Availability
- ✅ 3+ replicas by default
- ✅ Pod Disruption Budget (min 2 always running)
- ✅ Anti-affinity rules (pods on different nodes)
- ✅ Rolling update strategy (no downtime)

### Auto-Scaling
- ✅ Horizontal Pod Autoscaler (3-10 replicas)
- ✅ CPU trigger: 70% utilization
- ✅ Memory trigger: 80% utilization
- ✅ Scale-up: 0-30s response, 100% increase
- ✅ Scale-down: 5min stabilization, 50% decrease

### Security
- ✅ RBAC (Role-Based Access Control)
- ✅ SecurityContext (non-root, read-only FS)
- ✅ NetworkPolicy (ingress/egress rules)
- ✅ Secrets management integration
- ✅ Pod Security Standards

### Resource Management
- ✅ Requests: 500m CPU, 512Mi memory
- ✅ Limits: 2000m CPU, 2Gi memory
- ✅ QoS Class: Burstable
- ✅ PriorityClass: customizable

### Health Checks
- ✅ Liveness probe (HTTP GET /health, 30s interval)
- ✅ Readiness probe (HTTP GET /health, 10s interval)
- ✅ Startup probe (5s interval, 12 retries = 60s max)

### Storage
- ✅ 2 PersistentVolumeClaims (config + workspace)
- ✅ Configurable storage class
- ✅ Automatic provisioning
- ✅ Backup-friendly

### Monitoring
- ✅ Prometheus ServiceMonitor
- ✅ PrometheusRule with alerts
- ✅ Pod annotations for scraping
- ✅ Custom metrics integration ready

### Networking
- ✅ Ingress with TLS
- ✅ NetworkPolicy
- ✅ Service mesh ready
- ✅ DNS integration

## 📋 Configuration Options

### Helm Values (Production)

```yaml
# helm/openclaw/values.yaml
gateway:
  replicaCount: 3           # Min replicas
  image:
    tag: "main"             # Image version
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 2000m
      memory: 2Gi
  
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  
  ingress:
    enabled: true
    hosts:
      - host: openclaw.example.com
    tls:
      - secretName: openclaw-tls
        hosts:
          - openclaw.example.com

storage:
  config:
    size: 10Gi
    storageClassName: "standard"
  workspace:
    size: 50Gi
    storageClassName: "standard"

secrets:
  OPENCLAW_GATEWAY_TOKEN: "your-token"
  OPENCLAW_GATEWAY_PASSWORD: "your-password"
```

### Environment Variables

```yaml
configMap:
  LOG_LEVEL: "info"
  NODE_ENV: "production"
  OPENCLAW_GATEWAY_BIND: "0.0.0.0"
  OPENCLAW_GATEWAY_PORT: "18789"
  OPENCLAW_BRIDGE_PORT: "18790"
```

## 📈 Scaling Examples

### Manual Scaling
```bash
kubectl scale deployment openclaw-gateway --replicas=5 -n openclaw
```

### Auto-scaling Status
```bash
kubectl get hpa -n openclaw
kubectl describe hpa openclaw-gateway-hpa -n openclaw
```

### Check Resource Usage
```bash
kubectl top pod -n openclaw
kubectl top node
```

## 🔍 Monitoring

### View Logs
```bash
# Current logs
kubectl logs -n openclaw deployment/openclaw-gateway -f

# Last 100 lines
kubectl logs -n openclaw deployment/openclaw-gateway --tail=100

# Previous pod (if crashed)
kubectl logs -n openclaw deployment/openclaw-gateway -p
```

### Port-Forward Services
```bash
# Gateway
kubectl port-forward -n openclaw svc/openclaw-gateway 18789:18789

# Prometheus (if available)
kubectl port-forward -n prometheus svc/prometheus-kube-prometheus-prometheus 9090:9090

# Grafana (if available)
kubectl port-forward -n prometheus svc/prometheus-grafana 3000:3000
```

### Health Endpoint
```bash
curl http://localhost:18789/health
```

## 🔐 Security Considerations

### Secrets Management

**Development (not recommended for production):**
```bash
kubectl create secret generic openclaw-secrets \
  --from-literal=OPENCLAW_GATEWAY_TOKEN="token" \
  -n openclaw
```

**Production (recommended):**
- Use External Secrets Operator (ESO)
- Integrate with AWS Secrets Manager, Vault, or Azure Key Vault
- See `K8S_DEPLOYMENT_GUIDE.md` for details

### RBAC

Current role has minimal permissions:
- Get/list pods and services
- Get configmaps

Customize in `k8s/00-namespace-and-core.yaml` as needed.

### NetworkPolicy

Default policy allows:
- Ingress from nginx-ingress namespace
- Ingress from openclaw namespace
- Egress to DNS (UDP 53)
- Egress to external HTTPS (TCP 443)
- Egress to external HTTP (TCP 80)
- Egress to internal services

## 🚨 Troubleshooting

### Pods Not Starting
```bash
kubectl describe pod -n openclaw <pod-name>
kubectl logs -n openclaw <pod-name>
```

### Service Unreachable
```bash
# Check endpoints
kubectl get endpoints -n openclaw openclaw-gateway

# Check network policy
kubectl describe networkpolicy -n openclaw openclaw-network-policy

# Test connectivity
kubectl run -it --rm debug --image=alpine --restart=Never -- \
  wget http://openclaw-gateway.openclaw:18789/health
```

### Storage Issues
```bash
kubectl get pvc -n openclaw
kubectl describe pvc -n openclaw openclaw-config-pvc
kubectl get pv
```

### Resource Constraints
```bash
kubectl top pod -n openclaw
kubectl top node
kubectl describe node <node-name>
```

## 📚 Documentation Map

| Document | Purpose |
|----------|---------|
| **K8S_QUICK_START.md** | 30-minute quick deployment |
| **K8S_DEPLOYMENT_GUIDE.md** | Comprehensive deployment guide |
| **k8s/*.yaml** | Kubernetes manifests |
| **helm/openclaw/** | Helm chart |
| **k8s/kustomize/** | Kustomize overlays |

## 🔄 CI/CD Integration

### GitOps with ArgoCD

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Create Application
kubectl apply -f - << 'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: openclaw
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/openclaw/openclaw
    targetRevision: main
    path: k8s/kustomize/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: openclaw
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF
```

### GitHub Actions Deployment

```yaml
# .github/workflows/k8s-deploy.yml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]
    paths:
      - 'k8s/**'
      - 'helm/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-kubectl@v3
      - name: Deploy
        run: |
          kubectl config use-context k8s-prod
          kubectl apply -k k8s/kustomize/overlays/production
```

## 🔄 Updates & Rollbacks

### Update Image
```bash
kubectl set image deployment/openclaw-gateway \
  openclaw-gateway=ghcr.io/openclaw/openclaw:v2026.3.0 \
  -n openclaw
```

### Rollback
```bash
kubectl rollout undo deployment/openclaw-gateway -n openclaw
kubectl rollout undo deployment/openclaw-gateway --to-revision=2 -n openclaw
```

### Check Rollout Status
```bash
kubectl rollout status deployment/openclaw-gateway -n openclaw
kubectl rollout history deployment/openclaw-gateway -n openclaw
```

## 📞 Support & Community

- **GitHub Issues**: https://github.com/openclaw/openclaw/issues
- **Documentation**: https://github.com/openclaw/openclaw/tree/main/docs
- **Discussions**: https://github.com/openclaw/openclaw/discussions

## 📜 License

MIT License - See LICENSE file

---

**Version:** 2026.2.23  
**Last Updated:** 2026-02-23  
**Status:** Production-Ready ✅
