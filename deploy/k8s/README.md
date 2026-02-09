# OpenClaw K8s Manifests (local K3s)

Deploy OpenClaw (gateway + auto-scaling worker nodes) on a local K3s cluster
using ServiceAccount Trust authentication.

## Prerequisites

- K3s installed locally (`curl -sfL https://get.k3s.io | sh -`)
- `kubectl` configured (`export KUBECONFIG=/etc/rancher/k3s/k3s.yaml`)
- OpenClaw container image built and importable

## Quick Start

```bash
# Build the container image
docker build -t openclaw:local .

# Import into K3s
sudo k3s ctr images import <(docker save openclaw:local)

# Apply all manifests in order
kubectl apply -f namespace.yaml
kubectl apply -f gateway-config.yaml
kubectl apply -f rbac.yaml
kubectl apply -f gateway.yaml
kubectl apply -f worker.yaml
kubectl apply -f networkpolicy.yaml

# Or apply everything at once
kubectl apply -f .
```

## Verify

```bash
# Check pods
kubectl -n openclaw get pods

# Check gateway logs
kubectl -n openclaw logs -l app=openclaw-gateway -f

# Check worker logs
kubectl -n openclaw logs -l app=openclaw-worker -f

# Check HPA
kubectl -n openclaw get hpa

# Port-forward to access Control UI
kubectl -n openclaw port-forward svc/openclaw-gateway 19000:18789
```

## Architecture

```
namespace: openclaw
├── ServiceAccount: openclaw-gateway  (can call TokenReview API)
├── ServiceAccount: openclaw-worker   (JWT used for SA Trust auth)
├── StatefulSet: openclaw-gateway     (1 replica, PVC for config)
├── Service: openclaw-gateway         (ClusterIP, port 18789)
├── Deployment: openclaw-worker       (2 replicas, HPA 2→10)
├── HorizontalPodAutoscaler           (CPU target 70%)
└── NetworkPolicy                     (restrict gateway access)
```
