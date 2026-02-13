# Manual Installation Steps - Fortsetzung nach CMake Build

## Status
- ✅ System-Check abgeschlossen (7.8GB RAM, 91GB Disk, 2 Cores)
- ✅ Dependencies installiert (cmake, build-essential, etc.)
- ✅ llama.cpp geclont nach /opt/llama.cpp
- ⏳ CMake Build läuft (cmake --build build --config Release -j2)
- ⏳ Warte auf Fertigstellung (~5-10 Minuten)

## Nächste Schritte (nachdem Build fertig ist)

### 1. Build-Status verifizieren

```bash
ssh root@vps
cd /opt/llama.cpp

# Prüfe ob Binary existiert
ls -lh build/bin/llama-server

# Sollte ~50-100MB groß sein
```

### 2. Model herunterladen

```bash
# Model Directory erstellen
mkdir -p /opt/llm-models
cd /opt/llm-models

# Qwen2.5-1.5B herunterladen (~900MB)
wget https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf

# Größe prüfen (sollte ~900MB sein)
ls -lh qwen2.5-1.5b-instruct-q4_k_m.gguf
```

### 3. Systemd Service installieren

```bash
# Service-Datei kopieren
cp /opt/openclaw-llm-setup/scripts/local-llm.service /etc/systemd/system/

# Daemon neu laden
systemctl daemon-reload

# Service aktivieren und starten
systemctl enable local-llm
systemctl start local-llm

# Status prüfen
systemctl status local-llm
```

### 4. Logs überwachen

```bash
# Live-Logs anschauen
journalctl -u local-llm -f

# Sollte zeigen:
# - Loading model...
# - Model loaded
# - Server listening on 127.0.0.1:8765
```

### 5. API testen

```bash
# Health Check
curl http://127.0.0.1:8765/health

# Models Endpoint
curl http://127.0.0.1:8765/v1/models

# Chat Completion Test
curl http://127.0.0.1:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-1.5b-instruct",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 20
  }'
```

### 6. Swap-File erstellen (empfohlen)

```bash
# 4GB Swap anlegen
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Permanent machen
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Verifizieren
free -h
```

### 7. Firewall konfigurieren

```bash
# Port 8765 nur localhost
ufw deny 8765
ufw allow from 127.0.0.1 to any port 8765

# Status prüfen
ufw status verbose
```

### 8. Monitoring-Scripts installieren

```bash
cd /opt/openclaw-llm-setup/scripts

# Scripts nach /opt kopieren
mkdir -p /opt/llm-scripts
cp llm-health-check.sh /opt/llm-scripts/
cp llm-metrics-collect.sh /opt/llm-scripts/
cp test-local-llm.sh /opt/llm-scripts/
chmod +x /opt/llm-scripts/*.sh

# Test-Suite ausführen
/opt/llm-scripts/test-local-llm.sh
```

### 9. Cron-Jobs einrichten

```bash
# Health-Check alle 5 Minuten
echo "*/5 * * * * root /opt/llm-scripts/llm-health-check.sh >> /var/log/llm-health.log 2>&1" > /etc/cron.d/llm-monitor

# Metrics stündlich
echo "0 * * * * root /opt/llm-scripts/llm-metrics-collect.sh >> /var/log/llm-metrics.log 2>&1" >> /etc/cron.d/llm-monitor

# Permissions
chmod 644 /etc/cron.d/llm-monitor
```

### 10. OpenClaw Provider konfigurieren

```bash
# Finde OpenClaw config
find /opt /home /data -name "openclaw.json" 2>/dev/null | head -5

# Beispiel-Config liegt in:
cat /opt/openclaw-llm-setup/config/local-llm-provider.json

# Provider hinzufügen zu OpenClaw config (manuell editieren)
# Oder siehe QUICKSTART.md für Details
```

## Verification Checklist

Nach Installation prüfen:

```bash
# 1. Service läuft
systemctl is-active local-llm
# Sollte: active

# 2. Port offen (localhost only)
netstat -tlnp | grep 8765
# Sollte: 127.0.0.1:8765

# 3. Memory Usage
ps aux | grep llama-server | awk '{print $6/1024 " MB"}'
# Sollte: 2000-2500 MB

# 4. API antwortet
curl -s http://127.0.0.1:8765/health
# Sollte: JSON Response

# 5. Logs clean
journalctl -u local-llm -n 50 | grep -i error
# Sollte: keine Errors
```

## Troubleshooting

### Build failed
```bash
# Logs prüfen
cd /opt/llama.cpp
cat build/CMakeFiles/CMakeOutput.log | tail -100

# Neu bauen
rm -rf build
cmake -B build
cmake --build build --config Release -j2
```

### Service startet nicht
```bash
# Logs anschauen
journalctl -u local-llm -n 100

# Manuell testen
/opt/llama.cpp/build/bin/llama-server \
  --model /opt/llm-models/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  --host 127.0.0.1 \
  --port 8765
```

### Out of Memory
```bash
# Context Size reduzieren
# In /etc/systemd/system/local-llm.service:
# --ctx-size 1024 (statt 2048)

systemctl daemon-reload
systemctl restart local-llm
```

## Nächste Schritte nach erfolgreicher Installation

1. 24h Monitoring
   - RAM-Usage tracken
   - Response-Times messen
   - Error-Rate prüfen

2. OpenClaw Integration
   - Provider konfigurieren
   - Routing-Regeln testen
   - Fallback verifizieren

3. Optimierung
   - Performance-Tuning
   - Größeres Model erwägen
   - Prometheus-Integration

---

**Kontakt:** Siehe Hauptdokumentation in docs/LOCAL_LLM_SETUP.md
