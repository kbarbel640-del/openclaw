# OpenClaw Kubernetes Deployment Guide

This guide explains how to deploy OpenClaw to Kubernetes using Helm.

## Prerequisites

- Kubernetes 1.25+ (with support for `apps/v1` and `networking.k8s.io/v1`)
- Helm 3.8+
- kubectl configured to access your cluster
- Container runtime (Docker, containerd, cri-o)
- Default StorageClass available (or configure custom storage)
- For Ingress: nginx-ingress controller or compatible

## Installation

### Quick Start

```bash
# Add the repository (if needed)
helm repo add openclaw https://mzkmnk.github.io/openclaw/
helm repo update

# Create namespace
kubectl create namespace openclaw

# Install OpenClaw with default settings
helm install openclaw openclaw/openclaw \
  --namespace openclaw \
  --wait

# Check status
kubectl -n openclaw get pods
kubectl -n openclaw get svc
```

### Custom Installation

```bash
# Install with custom configuration
helm install openclaw openclaw/openclaw \
  --namespace openclaw \
  --values values-production.yaml \
  --set gateway.replicas=3 \
  --set gateway.auth.token=$(openssl rand -hex 32) \
  --wait
```

### From Local Chart

```bash
# Clone the repository
git clone https://github.com/mzkmnk/openclaw.git
cd openclaw/k8s

# Install from local chart
helm install openclaw . \
  --namespace openclaw \
  --create-namespace \
  --wait
```

## Configuration

### Environment Variables

OpenClaw supports the following environment variables:

- `OPENCLAW_GATEWAY_PORT` - Gateway port (default: 18789)
- `OPENCLAW_GATEWAY_BIND` - Gateway bind address (default: "0.0.0.0")
- `OPENCLAW_GATEWAY_TOKEN` - Gateway authentication token
- `OPENCLAW_HOME` - Home directory for OpenClaw (default: "/home/node/.openclaw")
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `BRAVE_API_KEY` - Your Brave Search API key

### values.yaml Options

Key configuration options in `values.yaml`:

```yaml
gateway:
  replicas: 2                    # Number of gateway replicas
  port: 18789                   # Gateway port
  resources:                    # Resource requests/limits
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"

pvc:
  enabled: true                 # Enable persistent storage
  size: 1Gi                    # PVC size
  storageClass: ""             # Storage class (empty = default)

ingress:
  enabled: false               # Enable Ingress
  hosts:
    - host: openclaw.local
```

## Accessing OpenClaw

### Port Forwarding (Development)

```bash
# Port forward to access locally
kubectl -n openclaw port-forward svc/openclaw-gateway 18789:18789

# Access at http://localhost:18789
```

### Ingress (Production)

```bash
# If ingress is enabled
kubectl -n openclaw get ingress

# Access via configured hostname
openclaw.your-domain.com
```

### Service (Cluster Internal)

```bash
# Access from within the cluster
openclaw-gateway.openclaw.svc.cluster.local:18789
```

## Verification

### Check Pods

```bash
kubectl -n openclaw get pods -l app.kubernetes.io/name=openclaw
```

### Check Health

```bash
# Get token (if using auth)
TOKEN=$(kubectl -n openclaw get secret openclaw-auth -o jsonpath='{.data.token}' | base64 -d)

# Check gateway health
kubectl -n openclaw exec -it <pod-name> -- node dist/index.js health --token "$TOKEN"
```

### Check Logs

```bash
# View gateway logs
kubectl -n openclaw logs -l app.kubernetes.io/component=gateway -f
```

## Upgrading

```bash
# Update the chart repository
helm repo update

# Upgrade OpenClaw
helm upgrade openclaw openclaw/openclaw \
  --namespace openclaw \
  --values values-production.yaml \
  --wait
```

## Uninstalling

```bash
# Remove OpenClaw deployment
helm uninstall openclaw --namespace openclaw

# Optionally remove the namespace
kubectl delete namespace openclaw

# Remove PVC (if desired)
kubectl -n openclaw delete pvc openclaw-pvc
```

## Example Configurations

### Development Configuration

```bash
helm install openclaw openclaw/openclaw \
  --namespace openclaw \
  --values k8s/examples/dev.values.yaml \
  --set gateway.env.LOG_LEVEL=debug
```

### Production Configuration

```bash
helm install openclaw openclaw/openclaw \
  --namespace openclaw \
  --values k8s/examples/prod.values.yaml \
  --set gateway.auth.token=$(openssl rand -hex 32)
```

### Local Storage Configuration

```bash
# First apply local storage
kubectl apply -f k8s/examples/local-storage.yaml

# Then install with local storage
helm install openclaw openclaw/openclaw \
  --namespace openclaw \
  --values k8s/examples/local-storage.values.yaml
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl -n openclaw describe pod <pod-name>

# Check logs
kubectl -n openclaw logs <pod-name>
```

### Common Issues

1. **Image Pull Errors**: Ensure Docker Hub access or use private registry
2. **PVC Binding Issues**: Check StorageClass and available storage
3. **Port Conflicts**: Verify gateway port not in use on host
4. **Auth Failures**: Check token configuration

### Debug Mode

```bash
# Enable debug logging
helm upgrade openclaw openclaw/openclaw \
  --namespace openclaw \
  --set gateway.env.LOG_LEVEL=debug \
  --set gateway.env.DEBUG=true
```

## API Endpoints

Once deployed, OpenClaw exposes the following endpoints:

- `/health` - Health check endpoint
- `/api/v1/*` - API endpoints
- WebSocket: `/ws` - Real-time communication

## Security Considerations

1. **Change Default Tokens**: Always set `gateway.auth.token` to a secure value
2. **Use Secrets**: Store sensitive data in Kubernetes Secrets, not ConfigMaps
3. **RBAC**: Configure appropriate RBAC rules for your use case
4. **Network Policies**: Consider adding NetworkPolicy resources
5. **TLS**: Enable TLS for production deployments

## Advanced Configuration

### Custom openclaw.json

```yaml
configMap:
  openclawJson: |
    {
      "gateway": {
        "mode": "local",
        "bind": "0.0.0.0",
        "port": 18789,
        "auth": { "mode": "token", "token": "your-token" }
      },
      "channels": {
        "whatsapp": { "dmPolicy": "pairing" }
      }
    }
```

### Node Selection

```yaml
gateway:
  nodeSelector:
    kubernetes.io/os: linux
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchLabels:
                app.kubernetes.io/name: openclaw
            topologyKey: kubernetes.io/hostname
```

## Support

For issues and questions:
- GitHub: https://github.com/mzkmnk/openclaw
- Documentation: https://docs.openclaw.ai
- Docker Hub: https://hub.docker.com/r/mzkmnk/openclaw

## License

This chart is provided as-is. See the main repository for license information.