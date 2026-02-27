---
name: honklab
description: Documents honklab network infrastructure, machines, SSH access, shared storage, and distributed iOS build system. Use when needing lab topology or access details.
invocation: user
---

# Honklab Infrastructure Skill

Use this skill when you need to know about the honklab network infrastructure, available machines, their capabilities, or how to connect to them.

## Overview

The honklab is a home network of 6 interconnected machines plus IoT devices, with bidirectional SSH access, shared storage via Syncthing, and a distributed iOS build system.

## Quick Reference

| Machine     | Hostname/IP                         | User  | OS                   | CPU                | RAM   | Role                                    |
| ----------- | ----------------------------------- | ----- | -------------------- | ------------------ | ----- | --------------------------------------- |
| maxblack    | maxblack.local (192.168.1.62)       | klabo | macOS 26.2           | M3 Max (14c)       | 36 GB | Primary workstation, build coordinator  |
| honkbox     | honkbox.local (192.168.1.165)       | klabo | Arch Linux (Omarchy) | i9-9900K (8c/16t)  | 64 GB | Linux workstation, Bitcoin node, Docker |
| honk        | honk.local (192.168.1.44)           | honk  | macOS 26.2           | M1 Pro (10c)       | 16 GB | iOS build worker                        |
| honkair     | honkair.local (192.168.1.134)       | honk  | macOS 26.2           | M1 (8c)            | 16 GB | iOS build worker                        |
| honkpi      | honkpi.local (192.168.1.45)         | pi    | Raspberry Pi OS      | Cortex-A72 (4c)    | 8 GB  | Home automation / IoT                   |
| honkstorage | honkstorage.local (192.168.1.27/28) | klabo | DSM 7.2.1            | Celeron J4125 (4c) | 8 GB  | NAS, Bitcoin data, media server         |

## IoT Devices

### Security Cameras (Eufy)

See `/eufy` skill for camera control via eufy-security-ws.

| Name           | Model                 | MAC               | IP            | Location | Serial           |
| -------------- | --------------------- | ----------------- | ------------- | -------- | ---------------- |
| honkcam-office | Indoor Cam 2K (T8400) | 8C:85:80:DA:6D:A5 | 192.168.1.160 | Office   | T8400P2021380A13 |

**Access:** eufy-security-ws at `ws://honkbox.local:3001`

### Printer (Brother HL-L2370DW)

- **Model:** Brother HL-L2370DW (monochrome laser)
- **Friendly Hostname:** honkprint (add to /etc/hosts)
- **mDNS Hostname:** BRNB422004A3130.local
- **IP:** 192.168.1.7
- **Port:** 631 (IPP)
- **UUID:** e3248000-80ce-11db-8000-b422004a3130
- **Capabilities:** Duplex, Letter/A4/Legal, PCL/PCLXL/URF
- **Admin UI:** `http://honkprint/net/net/airprint.html`
- **CUPS Name:** Brother_HL_L2370DW_series

**Setup hostname on each machine:**

```bash
echo '192.168.1.7 honkprint' | sudo tee -a /etc/hosts
```

**Print from CLI:**

```bash
lp -d Brother_HL_L2370DW_series filename.pdf
```

### BlockClock Mini

- **IP:** 192.168.1.233
- **MAC:** 3c:61:05:4b:f5:64 (Espressif)
- **Firmware:** v1.2.3 (updated 2026-02-01)
- **WiFi:** Klabo 2.4 GHz
- **Config UI:** `http://192.168.1.233`
- **Docs:** https://blockclockmini.com/docs

**Web Interface Pages:**

- `/display` - Configure which values to show (BTC price, block height, sats/dollar, etc.)
- `/prefs` - Update rate, brightness, animation speed, time format
- `/wifi` - Network status and WiFi config
- `/firmware` - OTA updates, SD card upgrade, diagnostics, logs

**Button Controls:**

- Any button → activates menu (SD Card, Network Setup, Power Off)
- Top button → firmware upgrades, Opendime balance
- Bottom button → power off

**Firmware Update Methods:**

1. Web UI "Get Latest" (if internet works)
2. SD Card: FAT32 formatted, place `latest.bin` at root
3. Web UI URL fetch from local server

## SSH Access

From any machine in the lab:

```bash
ssh maxblack    # M3 Max workstation
ssh honkbox     # Arch Linux / Omarchy
ssh honk        # M1 Pro build worker
ssh honkair     # M1 build worker
ssh honkpi      # Raspberry Pi 4 (honkpi.local)
ssh honkstorage # Synology NAS
```

## Machine Details

### maxblack (Primary Workstation)

- **Hardware:** MacBook Pro M3 Max, 14-core CPU, 30-core GPU, 36 GB RAM, 1 TB SSD
- **Hostname:** maxblack.local
- **Role:** Primary development workstation, distributed build coordinator, Syncthing hub, Clawdbot node
- **Services:** PostgreSQL 14, Syncthing, Build Queue Server, Azure DevOps Poller, Clawdbot node (connected to honkbox gateway)
- **Xcode:** 26.1.1 with Swift 6.2.1, full simulator runtimes
- **Network:** 192.168.1.62 (Wi-Fi), 192.168.1.24 (USB Ethernet)

### honkbox (Linux Workstation)

- **Hardware:** 2019 iMac 27", Intel i9-9900K (8c/16t @ 5GHz), 64 GB RAM, RX 580 8GB, 465 GB NVMe
- **Hostname:** honkbox.local
- **Role:** Linux development, Bitcoin full node, Docker host, local AI inference, Clawdbot Gateway
- **OS:** Arch Linux with Omarchy (Hyprland compositor)
- **Services:** Bitcoin Core (mainnet, ~49% synced), Ollama (Qwen 2.5 Coder 14B/32B), Docker, Clawdbot Gateway (ws://192.168.1.165:18789)
- **Storage:** LUKS-encrypted btrfs, 3.5 TB NFS mount to honkstorage for Bitcoin data
- **Note:** Runs hot (100C under load), fan maxed

### honk (iOS Build Worker)

- **Hardware:** MacBook Pro M1 Pro, 10-core CPU, 16 GB RAM, 500 GB SSD
- **Hostname:** honk.local
- **Role:** Primary iOS build worker (priority 100), Clawdbot node
- **Xcode:** 26.1.1 with Swift 6.2.1
- **Simulators:** iOS 18.5, 26.0, 26.1, tvOS, watchOS, visionOS
- **Storage:** 93% used - may need cleanup
- **Network:** 192.168.1.44 (Wi-Fi), 192.168.1.23 (USB Ethernet)
- **Services:** Clawdbot node (connected to honkbox gateway)

### honkair (iOS Build Worker)

- **Hardware:** MacBook Air M1, 8-core CPU, 16 GB RAM, 2 TB SSD
- **Hostname:** honkair.local
- **Role:** Secondary iOS build worker (priority 100), Clawdbot node
- **Xcode:** 26.2 with Swift 6.2.3
- **Simulators:** iOS 26.2, iOS 17.0
- **Storage:** 938 GB free - plenty of space
- **Services:** Clawdbot node (connected to honkbox gateway)

### honkpi (Raspberry Pi 4)

- **Hardware:** Raspberry Pi 4 Model B Rev 1.4, Quad-core Cortex-A72, 8 GB RAM, 64 GB microSD
- **Hostname:** honkpi.local
- **Role:** Home automation, IoT gateway, lightweight services
- **OS:** Raspberry Pi OS (Debian 12 Bookworm), kernel 6.6.51
- **Services:** SSH, Syncthing, Avahi mDNS
- **Status:** Fresh install, ready for configuration
- **Potential uses:** Pi-hole, Home Assistant, Docker host, network monitor

### honkstorage (Synology NAS)

- **Hardware:** DS920+, Intel Celeron J4125, 8 GB RAM
- **Hostname:** honkstorage.local
- **Storage:**
  - Volume 1 (HDD RAID1): 3.5 TB total, 1.7 TB used - Bitcoin data, Time Machine, media
  - Volume 2 (SSD RAID1): 890 GB total, 6 GB used - Plex metadata, downloads
- **Services:** Plex, Radarr, Sonarr, NZBGet, Time Machine, Synology Drive
- **Bitcoin:** Full node data at /volume1/bitcoin (389 GB)
- **Network:** Dual NIC - 192.168.1.27 and 192.168.1.28

## Shared Infrastructure

### ~/Shared Folder (Syncthing)

All machines sync ~/Shared via Syncthing:

- **BuildQueue/** - Distributed iOS build queue
- **skills/** - Claude Code skills (symlinked to ~/.claude/skills)
- **bin/** - Shared scripts
- **notes/** - Shared notes

### Skills Symlink

On every machine:

```bash
~/.claude/skills -> ~/Shared/skills
```

### Distributed iOS Build System

Submit iOS simulator builds from any machine, workers claim and build:

```bash
# Submit build
SCHEME=MyApp WORKSPACE=My.xcworkspace BUNDLE_ID=com.example.app \
    ~/bin/buildqueue-submit-sim.sh

# Check status
~/bin/buildqueue-status.sh
```

**Worker Priority:**

1. honk (M1 Pro) - Priority 100
2. honkair (M1) - Priority 100
3. maxblack (M3 Max) - Priority 10 (fallback after 30s)

## Network Topology

```
                    ┌─────────────────┐
                    │   Router        │
                    │  192.168.1.1    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────┴────┐         ┌─────┴─────┐        ┌─────┴─────┐
   │maxblack │         │ honkstorage│        │  honkbox  │
   │  .62    │◄───────►│  .27/.28   │◄──────►│   .165    │
   │ M3 Max  │  NFS    │  DS920+    │  NFS   │  i9-9900K │
   │Coordinator│       │   NAS      │Bitcoin │   Linux   │
   └────┬────┘         └───────────┬┘        └───────────┘
        │                          │
        │ Syncthing                │ Time Machine
        │                          │
   ┌────┴────┐    ┌────────┐    ┌──┴───────┐
   │  honk   │    │honkair │    │  honkpi  │    ┌──────────┐
   │  .44    │    │ .134   │    │   .45    │    │BlockClock│
   │ M1 Pro  │    │  M1    │    │   Pi 4   │    │  .233    │
   │ Worker  │    │ Worker │    │   IoT    │    │  BTC     │
   └─────────┘    └────────┘    └──────────┘    └──────────┘
```

## Storage Summary

| Machine     | Storage                  | Used          | Free            | Notes            |
| ----------- | ------------------------ | ------------- | --------------- | ---------------- |
| maxblack    | 1 TB NVMe                | 830 GB        | 70 GB           | Main workstation |
| honkbox     | 465 GB NVMe + 3.5 TB NFS | -             | -               | Bitcoin on NFS   |
| honk        | 500 GB NVMe              | 406 GB        | 31 GB           | Needs cleanup    |
| honkair     | 2 TB NVMe                | 896 GB        | 938 GB          | Plenty free      |
| honkpi      | 64 GB microSD            | 2 GB          | 52 GB           | Fresh install    |
| honkstorage | 3.5 TB HDD + 890 GB SSD  | 1.7 TB + 6 GB | 1.9 TB + 884 GB | Main storage     |

## Special Capabilities

### Bitcoin Infrastructure

- **honkbox:** Running Bitcoin Core mainnet full node (~49% synced)
- **honkstorage:** Stores blockchain data (389 GB at /volume1/bitcoin)
- **honkbox:** Lightning regtest environment with LND + LNbits (Docker)

### AI/ML

- **honkbox:** Ollama with Qwen 2.5 Coder (14B and 32B models)
- **maxblack:** Claude proxy service

### Media

- **honkstorage:** Plex Media Server with Radarr/Sonarr automation

### Development

- **maxblack:** Full iOS/macOS dev environment, build coordinator
- **honk/honkair:** iOS build workers with full Xcode
- **honkbox:** Linux dev environment, Docker host

## Common Tasks

### Add SSH key to all machines

```bash
# From any machine, add key to another:
ssh-copy-id maxblack
ssh-copy-id honkbox
ssh-copy-id honk
ssh-copy-id honkair
ssh-copy-id honkpi
```

### Check Syncthing status

```bash
# On macOS:
brew services list | grep syncthing

# On Linux:
systemctl --user status syncthing

# On Pi:
systemctl status syncthing@pi
```

### Monitor Bitcoin sync

```bash
ssh honkbox "bitcoin-cli getblockchaininfo | jq '{blocks, headers, verificationprogress}'"
```

### Submit iOS build

```bash
SCHEME=MyApp WORKSPACE=path/to/My.xcworkspace BUNDLE_ID=com.example.app \
    ~/bin/buildqueue-submit-sim.sh
```

## Troubleshooting

### Machine not responding

1. Check if online: `ping <hostname>.local`
2. Check SSH: `ssh -v <hostname>`
3. Check Syncthing web UI: `http://<ip>:8384`

### honkpi SSH

```bash
# Preferred (mDNS)
ssh pi@honkpi.local

# If you have ~/.ssh/config Host honkpi
ssh honkpi

# Fallback (static IP)
ssh pi@192.168.1.45
```

### Build queue stuck

```bash
# Check status
~/bin/buildqueue-status.sh

# Requeue stale jobs
~/bin/buildqueue-requeue-stale.sh

# Check worker logs (on worker machine)
tail -f /tmp/buildqueue-worker.log
```

### Syncthing not syncing

1. Check service is running
2. Check web UI for conflicts
3. Verify folder is shared with correct device IDs
