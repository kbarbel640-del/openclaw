# Local Mini-LLM für OpenClaw - Implementierungsguide

> **Status:** Production-Ready  
> **Zielplattform:** Ubuntu 24 VPS (8GB RAM, 2 Cores)  
> **Modell:** Qwen2.5-1.5B-Instruct-Q4_K_M  
> **Datum:** 2026-02-13

---

## 📋 Übersicht

Dieser Guide beschreibt die vollständige Implementierung eines lokalen Mini-LLM auf dem OpenClaw VPS als Utility- und Fallback-Provider.

### Architektur

```
┌─────────────────────────────────────────────────────────┐
│ VPS Ubuntu 24 (8GB RAM, 2 Cores)                        │
│                                                           │
│  ┌──────────────┐         ┌──────────────────────────┐  │
│  │  OpenClaw    │────────▶│  Local LLM Service       │  │
│  │  (Node.js)   │  HTTP   │  (llama.cpp server)      │  │
│  │              │ 127.0.0.1│  Port: 8765              │  │
│  │              │  :8765   │  OpenAI-Compatible API   │  │
│  └──────┬───────┘         └──────────────────────────┘  │
│         │                           ▲                    │
│         │                           │                    │
│         │                     systemd managed            │
│         │                     RAM: ~2-3GB                │
│         │                     Model: Qwen2.5-1.5B-Q4    │
│         │                                                │
│         ▼                                                │
│  ┌──────────────────┐                                   │
│  │  Cloud Providers │                                   │
│  │  - OpenAI        │                                   │
│  │  - Anthropic     │                                   │
│  │  - etc.          │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

### Kernmerkmale

- ✅ **OpenAI-kompatibler Endpoint** (127.0.0.1:8765)
- ✅ **Keine Docker-Abhängigkeit** (Native Installation)
- ✅ **Systemd-Integration** (Auto-Restart, Resource Limits)
- ✅ **Localhost-only** (Maximale Sicherheit)
- ✅ **Intelligentes Routing** (Local für Utility, Cloud für Complex)
- ✅ **Automatisches Fallback** (Bei Cloud-Ausfällen)

---

## 🎯 Ressourcenplanung

### RAM-Aufteilung (8GB Total)

| Komponente | RAM-Bedarf | Beschreibung |
|------------|-----------|--------------|
| OS + Base Services | 1.5 GB | Ubuntu + SSH + Monitoring |
| OpenClaw (Node.js) | 1.5 GB | Hauptanwendung |
| Local LLM | 2.5 GB | Model + Context Buffer |
| Buffer/Cache | 2.5 GB | System-Cache + Reserve |

### LLM-Konfiguration

```yaml
Model:
  Name: Qwen2.5-1.5B-Instruct-Q4_K_M
  Disk Size: ~900 MB
  RAM Usage: 2.0-2.5 GB (mit Context)
  Qualität: Exzellent für Utility-Tasks
  Sprachen: EN, DE, Multi

Runtime:
  Context Window: 2048 tokens
  Threads: 2 (alle CPU-Cores)
  Batch Size: 512
  Parallel Requests: 1 (keine Konkurrenz)
  
Resources:
  Memory Max: 3 GB (Hard Limit)
  Memory High: 2.5 GB (Soft Limit)
  CPU Quota: 200% (beide Cores)
```

### Swap-Konfiguration

```bash
# 4 GB Swap als Sicherheitsnetz (nicht für Inference!)
Size: 4 GB
Type: File-based
Usage: Nur bei System-RAM-Druck
Warning: Swap-Usage für LLM = Performance-Problem
```

---

## 🚀 Schnell-Installation (15 Minuten)

Siehe `scripts/install-local-llm.sh` für vollautomatische Installation.

### Manuelle Schritte:

```bash
# 1. llama.cpp kompilieren
cd /opt
sudo git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
sudo make -j2 LLAMA_CURL=1

# 2. Model Directory
sudo mkdir -p /opt/llm-models
cd /opt/llm-models

# 3. Qwen2.5-1.5B herunterladen
sudo wget https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf

# 4. Systemd Service
sudo cp scripts/systemd/local-llm.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable local-llm
sudo systemctl start local-llm

# 5. Verification
sudo systemctl status local-llm
curl http://127.0.0.1:8765/v1/models
```

---

## ⚙️ Konfiguration

### OpenClaw Provider Setup

Die Provider-Konfiguration findet sich in `config/openclaw.json`:

```json
{
  "providers": {
    "local-llm": {
      "type": "openai-compatible",
      "apiKey": "not-required",
      "baseURL": "http://127.0.0.1:8765/v1",
      "defaultModel": "qwen2.5-1.5b-instruct",
      "maxTokens": 1024,
      "temperature": 0.3,
      "timeout": 30000,
      "retries": 1,
      "enabled": true,
      "tags": ["local", "utility", "fallback", "fast"]
    }
  }
}
```

### Routing-Regeln

```javascript
// Automatisches Routing basierend auf Task-Type
Local LLM wird genutzt für:
- task.type === 'code-review'
- task.type === 'simple-qa'
- task.type === 'log-parsing'
- task.tokens < 500

Cloud LLM wird genutzt für:
- task.priority === 'high'
- task.type === 'complex-reasoning'
- task.tokens > 2000
- Local LLM nicht verfügbar
```

---

## 🔒 Sicherheit

### Network Security

```yaml
Binding: 127.0.0.1 only (NIEMALS 0.0.0.0)
Port: 8765 (nicht öffentlich erreichbar)
Firewall: UFW deny 8765 von extern
TLS: Nicht erforderlich (localhost only)
```

### Process Security

```yaml
User: nobody (unprivileged)
Group: nogroup
PrivateTmp: yes
NoNewPrivileges: true
ProtectSystem: strict
ProtectHome: yes
```

### Resource Limits

```yaml
MemoryMax: 3G (Hard Limit - verhindert OOM)
MemoryHigh: 2.5G (Soft Limit - Warnung)
CPUQuota: 200% (nutzt beide Cores)
```

### Firewall Setup

```bash
# UFW-Regeln
sudo ufw deny 8765
sudo ufw allow from 127.0.0.1 to any port 8765
sudo ufw status verbose
```

---

## 📊 Monitoring

### Health Checks

```bash
# Service Status
sudo systemctl status local-llm

# Live Logs
sudo journalctl -u local-llm -f

# Memory Usage
ps aux | grep llama-server | awk '{print $6/1024 " MB"}'

# API Health
curl http://127.0.0.1:8765/health

# Metrics Endpoint
curl http://127.0.0.1:8765/metrics
```

### Automatisiertes Monitoring

```bash
# Health-Check Script (jede 5 Minuten)
/opt/scripts/llm-health-check.sh

# Logs
/var/log/llm-health.log
/var/log/llm-metrics.log
```

### Schwellwerte

```yaml
Warnung:
  - RAM > 2.8 GB
  - Response Time > 10s
  - HTTP 503 > 5/min

Critical:
  - Service Down > 2 min
  - OOM Kill detected
  - Restart Count > 3/h
```

---

## 🎯 Performance-Leitplanken

### Must-Have Constraints

```yaml
Model Size: < 1.5 GB on disk
RAM Usage: < 2.5 GB (mit Context)
Context Window: ≤ 2048 tokens
Response Time: < 5s für 100 tokens
Parallel Requests: 1 (keine Konkurrenz)
```

### Optimization Flags

```bash
--mlock           # Lock model in RAM (verhindert Swap)
--no-mmap         # Vollständig in RAM laden
--cont-batching   # Effizientere Batch-Verarbeitung
--metrics         # Prometheus-kompatible Metriken
```

---

## 🧪 Testing

### Basis-Tests

```bash
# 1. Service läuft
systemctl is-active local-llm

# 2. Port erreichbar
nc -zv 127.0.0.1 8765

# 3. API Response
curl http://127.0.0.1:8765/v1/models

# 4. Inference Test
curl http://127.0.0.1:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-1.5b-instruct",
    "messages": [{"role": "user", "content": "Say OK"}],
    "max_tokens": 10
  }'
```

### Integration-Tests (OpenClaw)

```javascript
// Test Local Provider
const response = await openclaw.chat({
  provider: 'local-llm',
  message: 'Generate a regex for email validation'
});

// Test Fallback
// (Stoppe local-llm, verify cloud fallback funktioniert)
```

---

## 🔧 Troubleshooting

### Service startet nicht

```bash
# Logs prüfen
sudo journalctl -u local-llm -n 50

# Häufige Ursachen:
# - Model-File fehlt oder falscher Pfad
# - Port 8765 bereits belegt
# - Keine Berechtigung für /opt/llama.cpp/llama-server

# Manueller Test
/opt/llama.cpp/llama-server --model /opt/llm-models/qwen2.5-1.5b-instruct-q4_k_m.gguf --host 127.0.0.1 --port 8765
```

### Hoher RAM-Verbrauch

```bash
# Current Usage
ps aux | grep llama-server

# Wenn > 3 GB:
# 1. Context Size reduzieren: --ctx-size 1024
# 2. Kleineres Model: Qwen2.5-0.5B
# 3. Batch Size reduzieren: --batch-size 256
```

### Langsame Response Times

```bash
# Ursachen checken:
# 1. System-Load zu hoch
top

# 2. Swap-Usage (BAD!)
free -h

# 3. Concurrent Requests (sollte 1 sein)
curl http://127.0.0.1:8765/metrics | grep requests

# Fixes:
# - --threads erhöhen (max 2)
# - Context Window reduzieren
# - Kleineres Model
```

### OpenClaw kann LLM nicht erreichen

```bash
# 1. Service läuft?
sudo systemctl status local-llm

# 2. Port offen?
sudo netstat -tlnp | grep 8765

# 3. Von OpenClaw-Process aus testen
curl http://127.0.0.1:8765/health

# 4. Firewall-Regeln prüfen
sudo ufw status
```

---

## 📈 Optimierungen (Phase 2)

### Nach 7 Tagen Monitoring

1. **Größeres Model (wenn RAM verfügbar)**
   ```bash
   # Qwen2.5-3B-Instruct-Q4_K_M
   # Disk: ~2 GB, RAM: ~3.5 GB
   # Bessere Qualität für komplexere Utility-Tasks
   ```

2. **Swap-File anlegen**
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

3. **Prometheus Integration**
   ```bash
   # llama.cpp --metrics endpoint
   # Scrape mit Prometheus
   # Grafana Dashboard
   ```

4. **Advanced Routing**
   ```javascript
   // Token-basiertes Routing
   // Sentiment-Analysis lokal
   // Code-Generation nur Cloud
   ```

---

## ✅ Checkliste vor Production

- [ ] systemd Service läuft stabil (24h+)
- [ ] localhost-only Binding verifiziert
- [ ] Memory Limits getestet (keine OOM)
- [ ] Health Check funktioniert
- [ ] OpenClaw erreicht Local LLM
- [ ] Fallback zu Cloud getestet
- [ ] Logs rotieren automatisch
- [ ] Firewall-Regeln aktiv
- [ ] Monitoring aufgesetzt
- [ ] Backup-Strategie für Model-Files

---

## 📚 Referenzen

- **llama.cpp:** https://github.com/ggerganov/llama.cpp
- **Qwen2.5 Models:** https://huggingface.co/Qwen
- **OpenAI API Spec:** https://platform.openai.com/docs/api-reference
- **systemd Service Hardening:** https://www.freedesktop.org/software/systemd/man/systemd.exec.html

---

## 📞 Support

Bei Problemen:
1. Logs prüfen: `sudo journalctl -u local-llm -n 100`
2. Health-Check: `/opt/scripts/llm-health-check.sh`
3. Manual Test: Start llama-server manuell
4. OpenClaw Logs: Check Routing & Fallback

**Erfolgsmetriken nach 7 Tagen:**
- 🎯 90% der Utility-Tasks lokal
- 🎯 < 5s Average Response Time
- 🎯 0 OOM-Kills
- 🎯 99% Uptime
