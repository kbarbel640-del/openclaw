# OpenClaw Helm Chart - Summary

This document provides a comprehensive overview of the OpenClaw Kubernetes Helm chart.

## Chart Structure

```
k8s/
├── Chart.yaml                 # Chart metadata
├── values.yaml                # Default values
├── values.schema.json         # JSON schema for values validation
├── README.md                  # User documentation
├── CHART_SUMMARY.md          # This file
├── templates/                 # Helm templates
│   ├── _helpers.tpl           # Template helpers (names, labels, etc.)
│   ├── deployment.yaml        # Gateway and Agent deployments
│   ├── service.yaml           # ClusterIP service
│   ├── configmap.yaml         # OpenClaw configuration
│   ├── pvc.yaml               # PersistentVolumeClaim
│   ├── serviceaccount.yaml    # RBAC service account
│   ├── role.yaml              # RBAC role
│   ├── rolebinding.yaml       # RBAC role binding
│   └── ingress.yaml           # Optional ingress for external access
└── examples/                  # Example configurations
    ├── dev.values.yaml        # Development settings
    ├── prod.values.yaml       # Production settings
    ├── simple.values.yaml     # Minimal configuration
    ├── local-storage.yaml     # Local storage class example
    ├── local-storage.values.yaml # Local storage values
    └── secrets.yaml           # Secrets management guide
```

## Resources Created

| Resource | Description | HA Support |
|----------|-------------|------------|
| Deployment | Gateway pod(s) with rolling updates | ✅ (replicas: 2+) |
| Service | ClusterIP for internal communication | ✅ |
| ConfigMap | OpenClaw configuration (openclaw.json) | ✅ |
| PVC | Persistent storage for .openclaw directory | ✅ |
| ServiceAccount | RBAC identity | ✅ |
| Role | RBAC permissions | ✅ |
| RoleBinding | Grants permissions to ServiceAccount | ✅ |
| Ingress | External HTTP access (optional) | ✅ |

## Configuration Options

### Basic Configuration

```yaml
gateway:
  replicas: 2          # Number of replicas for HA
  port: 18789          # Gateway port
  auth:
    token: ""          # Security token

pvc:
  enabled: true        # Enable persistent storage
  size: 1Gi           # Storage size
```

### Resource Management

```yaml
gateway:
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
```

### Liveness/Readiness Probes

```yaml
gateway:
  livenessProbe:
    initialDelaySeconds: 30
    periodSeconds: 10
  readinessProbe:
    initialDelaySeconds: 10
    periodSeconds: 5
```

### Example: Development Setup

```bash
helm install openclaw ./k8s \
  --namespace openclaw \
  --create-namespace \
  --values ./k8s/examples/dev.values.yaml
```

### Example: Production Setup

```bash
# Generate secure token
TOKEN=$(openssl rand -hex 32)

# Install with production settings
helm install openclaw ./k8s \
  --namespace openclaw \
  --create-namespace \
  --values ./k8s/examples/prod.values.yaml \
  --set gateway.auth.token="$TOKEN"
```

## Security Considerations

1. **Authentication**: Always set `gateway.auth.token` in production
2. **RBAC**: Configure minimal required permissions in `rbac.role.rules`
3. **Secrets**: Use Kubernetes Secrets for sensitive data (API keys, tokens)
4. **Network Policies**: Consider adding NetworkPolicy resources
5. **TLS**: Enable TLS for production using Ingress

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl -n openclaw describe pod <pod-name>

# Check logs
kubectl -n openclaw logs <pod-name>
```

### Configuration Issues

```bash
# Validate Helm template
helm template test ./k8s

# Check rendered values
helm show values ./k8s
```

## Updating the Chart

```bash
# Update dependencies
helm dependency update ./k8s

# Package the chart
helm package ./k8s

# Push to chart repository
helm push openclaw-*.tgz oci://ghcr.io/mzkmnk/charts
```

## Version History

- **0.1.0**: Initial release
  - Gateway deployment with HA support
  - Agent deployment (optional)
  - PVC for data persistence
  - RBAC configuration
  - Ingress support
  - Multiple example configurations

## Support

For issues and questions:
- GitHub Issues: https://github.com/mzkmnk/openclaw/issues
- Documentation: https://docs.openclaw.ai
- Docker Hub: https://hub.docker.com/r/mzkmnk/openclaw
