# 🚀 Quick-Start: Local LLM für OpenClaw

**Schnellinstallation in 15 Minuten** | Ubuntu 24 VPS | 8GB RAM

---

## ⚡ Voraussetzungen

```bash
# System Check
- Ubuntu 24 LTS
- 8 GB RAM minimum
- 2 CPU Cores
- 5 GB freier Speicher
- Root-Zugriff
```

---

## 📦 Installation

### Option 1: Automatisches Install-Script (Empfohlen)

```bash
# 1. Auf VPS einloggen
ssh user@your-vps

# 2. Ins OpenClaw-Verzeichnis wechseln
cd /path/to/openclaw

# 3. Install-Script ausführbar machen
chmod +x scripts/local-llm/install-local-llm.sh

# 4. Installation starten (als root)
sudo ./scripts/local-llm/install-local-llm.sh

# Das Script führt aus:
# - System-Check
# - llama.cpp kompilieren
# - Qwen2.5-1.5B Model herunterladen (~900MB)
# - systemd Service einrichten
# - Firewall konfigurieren
# - Tests durchführen
```

### Option 2: Manuelle Installation (5 Schritte)

```bash
# 1. llama.cpp kompilieren
cd /opt
sudo git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
sudo make -j2 LLAMA_CURL=1

# 2. Model herunterladen
sudo mkdir -p /opt/llm-models
cd /opt/llm-models
sudo wget https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf

# 3. Service installieren
sudo cp /path/to/openclaw/scripts/local-llm/local-llm.service /etc/systemd/system/
sudo systemctl daemon-reload

# 4. Service starten
sudo systemctl enable local-llm
sudo systemctl start local-llm

# 5. Status prüfen
sudo systemctl status local-llm
```

---

## ✅ Verification

```bash
# Service läuft?
sudo systemctl is-active local-llm
# Sollte ausgeben: active

# API erreichbar?
curl http://127.0.0.1:8765/health
# Sollte ausgeben: {"status":"ok"} oder ähnlich

# Vollständiger Test
./scripts/local-llm/test-local-llm.sh
```

---

## 🔧 OpenClaw Konfigurieren

### Schritt 1: Provider hinzufügen

Bearbeite `claw/config/openclaw.json` und füge unter `models.providers` hinzu:

```json
{
  "models": {
    "providers": {
      "local-llm": {
        "baseUrl": "http://127.0.0.1:8765/v1",
        "apiKey": "not-required",
        "api": "openai-completions",
        "models": [
          {
            "id": "qwen2.5-1.5b-instruct",
            "name": "Qwen 2.5 1.5B (Local)",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0
            },
            "contextWindow": 2048,
            "maxTokens": 1024
          }
        ],
        "enabled": true
      }
    }
  }
}
```

### Schritt 2: Routing konfigurieren (Optional)

Für automatisches Routing zwischen Local und Cloud siehe:
- `config/local-llm-provider.json` - Routing-Regeln
- `docs/LOCAL_LLM_SETUP.md` - Detaillierte Konfiguration

### Schritt 3: OpenClaw neu starten

```bash
# OpenClaw neu starten damit Config geladen wird
sudo systemctl restart openclaw
# oder je nach Setup
pm2 restart openclaw
```

---

## 🧪 Testen

### API direkt testen

```bash
# Chat Completion
curl http://127.0.0.1:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-1.5b-instruct",
    "messages": [
      {"role": "user", "content": "Generate a regex for email validation"}
    ],
    "max_tokens": 100
  }'
```

### Von OpenClaw aus testen

```javascript
// In OpenClaw Chat/Command
@claw use local-llm
Generate a regex for email validation
```

---

## 📊 Monitoring

```bash
# Service Status
sudo systemctl status local-llm

# Live Logs
sudo journalctl -u local-llm -f

# Memory Usage
ps aux | grep llama-server | awk '{print $6/1024 " MB"}'

# Health Check (automatisch)
./scripts/local-llm/llm-health-check.sh

# Metrics sammeln
./scripts/local-llm/llm-metrics-collect.sh
```

---

## 🔥 Häufige Probleme

### Service startet nicht

```bash
# Logs anschauen
sudo journalctl -u local-llm -n 50

# Häufige Ursachen:
# - Model-File fehlt: Prüfe /opt/llm-models/qwen2.5-1.5b-instruct-q4_k_m.gguf
# - Port belegt: sudo netstat -tlnp | grep 8765
# - Permissions: sudo chmod +x /opt/llama.cpp/llama-server
```

### Langsame Antworten (>10s)

```bash
# RAM-Druck prüfen
free -h

# Wenn Swap verwendet wird (BAD!):
# - Context Size reduzieren in Service-Datei: --ctx-size 1024
# - Batch Size reduzieren: --batch-size 256

# Service neu starten
sudo systemctl restart local-llm
```

### OpenClaw erreicht LLM nicht

```bash
# 1. Service läuft?
sudo systemctl status local-llm

# 2. Von OpenClaw-User aus testen
curl http://127.0.0.1:8765/health

# 3. Firewall-Regel prüfen (sollte localhost erlauben)
sudo ufw status
```

---

## 🎯 Use Cases

### ✅ Ideal für Local LLM:
- Code-Reviews (einfach)
- Regex-Generierung
- Log-Parsing
- JSON/YAML Transformationen
- Kurze Q&A (< 500 Tokens)
- Schnelle Syntax-Checks

### ❌ Besser für Cloud:
- Komplexe Architektur-Planung
- Große Code-Generierung
- Multi-Step Reasoning
- Lange Kontexte (> 2k Tokens)
- Kritische Business-Logic

---

## 📚 Weiterführende Docs

- **Vollständige Dokumentation:** [docs/LOCAL_LLM_SETUP.md](../docs/LOCAL_LLM_SETUP.md)
- **Routing-Konfiguration:** [config/local-llm-provider.json](../config/local-llm-provider.json)
- **llama.cpp Docs:** https://github.com/ggerganov/llama.cpp
- **Qwen Models:** https://huggingface.co/Qwen

---

## 🎊 Erfolg!

Wenn alles funktioniert:

```bash
✅ Service läuft: systemctl is-active local-llm
✅ API antwortet: curl http://127.0.0.1:8765/health
✅ OpenClaw erkennt Provider
✅ Erste Inference erfolgreich
```

**Nächste Schritte:**
1. 24h Monitoring aktivieren
2. RAM-Nutzung beobachten
3. Response-Times tracken
4. Routing-Regeln optimieren
5. Bei Bedarf größeres Model (Qwen2.5-3B)

---

**Support:** Bei Problemen siehe [Troubleshooting](../docs/LOCAL_LLM_SETUP.md#troubleshooting) oder Logs prüfen: `journalctl -u local-llm`
