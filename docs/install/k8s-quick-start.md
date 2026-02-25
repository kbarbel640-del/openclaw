---
summary: "Kubernetes-based setup and onboarding for OpenClaw"
read_when:
  - You want to run OpenClaw on Kubernetes
title: "Kubernetes"
---

# Kubernetes

This guide covers how to deploy OpenClaw on a Kubernetes cluster using the provided manifest.

## Prerequisites

- A Kubernetes cluster (local or remote)
- `kubectl` configured to talk to your cluster
- Docker (for building the image)

## 1. Build the Image

First, build the OpenClaw image.

### Standard Build (Recommended)
This builds the core image without the headless browser. It is smaller and faster to build.

Run this command from the root of the repository:

```bash
docker build --platform linux/amd64 -t openclaw:local -f Dockerfile .
```

### Build with Browser Support (Optional)
If you want the agent to be able to browse the web (e.g., visit URLs, extract content), you can include the browser dependencies in the image. 

```bash
docker build --platform linux/amd64 -t openclaw:local --build-arg OPENCLAW_INSTALL_BROWSER=1 -f Dockerfile .
```

> **Note**: If you are using a remote cluster (not Kind/Minikube/Docker Desktop), you must tag and push this image to a container registry accessible by your cluster, and update the `image` field in `deploy/k8s/openclaw.yaml`.

## 2. Configure Secrets

Open `deploy/k8s/openclaw.yaml` and locate the `Secret` object named `openclaw-secret`. You need to configure your LLM provider and API Key here.

Find the `stringData` section and uncomment/configure your provider. The configuration may require `LLM_BASE_URL` and `LLM_MODEL_ID` depending on the provider.

For example, to use **Z.AI (GLM)**:

```yaml
  # ...
  # --- Option 4: Z.AI (GLM) ---
  LLM_PROVIDER: "zai"
  LLM_BASE_URL: "https://api.z.ai/api/paas/v4"
  LLM_API_KEY: "your-api-key-here"
  LLM_MODEL_ID: "zai/glm-4.7"
  # ...
```

Or for **Moonshot (Kimi)**:

```yaml
  # ...
  # --- Option 3: Moonshot (Kimi) ---
  LLM_PROVIDER: "moonshot"
  LLM_BASE_URL: "https://api.moonshot.ai/v1"
  LLM_API_KEY: "sk-..."
  LLM_MODEL_ID: "moonshot/kimi-k2.5"
  # ...
```

Make sure to set a valid `LLM_API_KEY` and other required fields for your chosen provider.

## 3. Deploy to Kubernetes

Apply the configuration to your cluster:

```bash
kubectl apply -f deploy/k8s/openclaw.yaml
```

Wait for the pod to be ready:

```bash
kubectl get pods -w
```

## 4. Access OpenClaw

The service is exposed as a `NodePort` (port 31889) by default. For local development, port forwarding is the easiest way to access it.

```bash
kubectl port-forward svc/openclaw-gateway 18789:18789
```

Now open your browser and visit: [http://localhost:18789](http://localhost:18789)

### Connect to Gateway

1. In the OpenClaw Web UI, go to the **Overview** page (or click the connection status icon).
2. You will be asked to authenticate with the gateway.
3. Enter the default token configured in the Secret: `openclaw-token-123`.
4. Click "Connect" button and confirm status is healthy.

## 5. Usage Guide

1. Chat on Dashboard: just talk with the agent on the dashboard.
2. Enter container by `kubectl exec -it deploy/openclaw-gateway -- bash`, then you can use `openclaw` CLI.
