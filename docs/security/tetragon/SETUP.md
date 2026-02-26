# Tetragon Setup Guide for OpenClaw

Step-by-step instructions for deploying Tetragon alongside OpenClaw and routing security events through the OTel Collector.

## Prerequisites

- Linux host or Kubernetes cluster running OpenClaw
- Kernel 4.19+ (5.x+ recommended for full BPF feature support)
- OTel Collector installed (or planned; see step 4)

## 1. Install Tetragon

### Option A: Helm (Kubernetes)

```bash
helm repo add cilium https://helm.cilium.io
helm repo update
helm install tetragon cilium/tetragon \
  --namespace kube-system \
  --set tetragon.exportFilename=/var/log/tetragon/tetragon.log
```

### Option B: Package (bare metal / VM)

```bash
# Debian/Ubuntu
curl -sL https://github.com/cilium/tetragon/releases/latest/download/tetragon-linux-amd64.tar.gz \
  | sudo tar -xz -C /usr/local/bin/

# Create systemd unit
sudo tee /etc/systemd/system/tetragon.service > /dev/null <<'UNIT'
[Unit]
Description=Tetragon eBPF Security Agent
After=network.target

[Service]
ExecStart=/usr/local/bin/tetragon \
  --export-filename /var/log/tetragon/tetragon.log \
  --btf /sys/kernel/btf/vmlinux
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

sudo mkdir -p /var/log/tetragon
sudo systemctl daemon-reload
sudo systemctl enable --now tetragon
```

### Verify installation

```bash
# Check Tetragon is running
sudo systemctl status tetragon   # bare metal
kubectl -n kube-system get pods -l app.kubernetes.io/name=tetragon  # K8s

# Confirm events are being written
tail -1 /var/log/tetragon/tetragon.log | jq .
```

## 2. Apply TracingPolicies

Apply each policy from the `policies/` directory. On Kubernetes, use `kubectl apply`; on bare metal, place them in Tetragon's policy directory.

### Kubernetes

```bash
kubectl apply -f policies/01-process-exec.yaml
kubectl apply -f policies/02-sensitive-files.yaml
kubectl apply -f policies/03-privilege-escalation.yaml
kubectl apply -f policies/04-dangerous-commands.yaml
```

### Bare metal

```bash
sudo mkdir -p /etc/tetragon/tetragon.tp.d
sudo cp policies/*.yaml /etc/tetragon/tetragon.tp.d/
sudo systemctl restart tetragon
```

### Verify policies are loaded

```bash
# Kubernetes
kubectl get tracingpolicies

# Bare metal - trigger a test event
cat /etc/passwd > /dev/null
tail -5 /var/log/tetragon/tetragon.log | jq 'select(.process_kprobe != null)'
```

## 3. Configure log output

Tetragon writes JSON events to the configured export file. The default path used in this guide is `/var/log/tetragon/tetragon.log`.

For log rotation, configure logrotate:

```bash
sudo tee /etc/logrotate.d/tetragon > /dev/null <<'LOGROTATE'
/var/log/tetragon/tetragon.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
LOGROTATE
```

## 4. Set up OTel Collector

Use the provided [collector-config.yaml](/security/tetragon/collector-config) as a starting point.

### Install the Collector

```bash
# Download the contrib distribution (includes filelog receiver)
curl -sL https://github.com/open-telemetry/opentelemetry-collector-releases/releases/latest/download/otelcol-contrib_linux_amd64.tar.gz \
  | sudo tar -xz -C /usr/local/bin/
```

### Configure

Copy or merge the provided config into your collector configuration:

```bash
sudo mkdir -p /etc/otelcol
sudo cp collector-config.yaml /etc/otelcol/config.yaml
```

Set your backend endpoint:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="https://your-backend:4317"
export OTEL_EXPORTER_OTLP_HEADERS_AUTH="your-api-key"
```

### Run

```bash
otelcol-contrib --config /etc/otelcol/config.yaml
```

Or as a systemd service:

```bash
sudo tee /etc/systemd/system/otelcol.service > /dev/null <<'UNIT'
[Unit]
Description=OpenTelemetry Collector
After=network.target

[Service]
EnvironmentFile=/etc/otelcol/env
ExecStart=/usr/local/bin/otelcol-contrib --config /etc/otelcol/config.yaml
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now otelcol
```

## 5. Verify events are flowing

### Check Tetragon events

```bash
# Trigger a test: read a sensitive file
cat /etc/passwd > /dev/null

# Verify it appears in the log
tail -20 /var/log/tetragon/tetragon.log | jq 'select(.process_kprobe != null) | {event: .process_kprobe.function_name, file: .process_kprobe.args[0].file_arg}'
```

### Check OTel Collector

```bash
# The collector logs should show successful exports
journalctl -u otelcol -f --no-pager | head -20
```

### Check your backend

Query for logs where `service.name = "openclaw-security"` in your observability backend. You should see Tetragon events appearing within a few seconds of the batch interval.

## Combining with diagnostics-otel

For a complete picture, run the OpenClaw `diagnostics-otel` plugin alongside Tetragon:

- **diagnostics-otel** provides application-level spans: message processing, tool calls, token usage, and security pattern detection
- **Tetragon** provides kernel-level events: actual process execution, file access, privilege changes

Both can export to the same backend using the same OTel Collector instance. Use `service.name` to distinguish between `openclaw` (application) and `openclaw-security` (kernel) telemetry.
