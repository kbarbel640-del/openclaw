# Local LLM Scripts and Configuration

This directory contains all necessary files to set up a local Mini-LLM for OpenClaw.

## 📁 Contents

### Installation & Service
- **`install-local-llm.sh`** - Automated installation script (recommended)
- **`local-llm.service`** - systemd service definition
- **`QUICKSTART.md`** - 15-minute quick-start guide

### Monitoring & Testing
- **`llm-health-check.sh`** - Health monitoring script
- **`llm-metrics-collect.sh`** - Performance metrics collection
- **`test-local-llm.sh`** - API test suite

## 🚀 Quick Start

```bash
# 1. Make scripts executable
chmod +x *.sh

# 2. Run installation (as root)
sudo ./install-local-llm.sh

# 3. Verify installation
./test-local-llm.sh
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed instructions.

## 📖 Full Documentation

See [../docs/LOCAL_LLM_SETUP.md](../docs/LOCAL_LLM_SETUP.md) for complete documentation.

## 🔧 Manual Setup

If you prefer manual setup:

1. Install llama.cpp
2. Download Qwen2.5-1.5B model
3. Copy `local-llm.service` to `/etc/systemd/system/`
4. Enable and start service
5. Configure OpenClaw provider

## 📊 Monitoring

Set up automated monitoring:

```bash
# Add to crontab
*/5 * * * * /path/to/llm-health-check.sh
0 6 * * * /path/to/llm-metrics-collect.sh
```

## ⚙️ Configuration

OpenClaw provider configuration template available at:
- `../config/local-llm-provider.json`

## 🆘 Support

- Check logs: `sudo journalctl -u local-llm -f`
- Run tests: `./test-local-llm.sh`
- See troubleshooting: [../docs/LOCAL_LLM_SETUP.md#troubleshooting](../docs/LOCAL_LLM_SETUP.md#troubleshooting)
