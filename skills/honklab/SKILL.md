---
name: honklab
description: Documents honklab network infrastructure, machines, SSH access, shared storage, and distributed iOS build system. Use when needing lab topology or access details.
invocation: user
---

# Honklab Infrastructure Skill

Use this skill when you need to know about the honklab network infrastructure, available machines, their capabilities, or how to connect to them.

## Overview

The honklab is a home network of 6 interconnected machines plus IoT devices, with bidirectional SSH access, shared storage via Syncthing, and a distributed iOS build system.

### Contents

- [references/networking.md](references/networking.md) - Comcast gateway, UniFi REST API, WiFi optimization

## Quick Reference

| Machine     | Hostname/IP                         | User  | OS                   | CPU                | RAM   | Role                                    |
| ----------- | ----------------------------------- | ----- | -------------------- | ------------------ | ----- | --------------------------------------- |
| maxblack    | maxblack.local (192.168.1.63)       | klabo | macOS 26.2           | M3 Max (14c)       | 36 GB | Primary workstation, build coordinator  |
| honkbox     | honkbox.local (192.168.1.165)       | klabo | Arch Linux (Omarchy) | i9-9900K (8c/16t)  | 64 GB | Linux workstation, Bitcoin node, Docker |
| honk        | honk.local (192.168.1.44)           | honk  | macOS 26.2           | M1 Pro (10c)       | 16 GB | iOS build worker                        |
| honkair     | honkair.local (192.168.1.134)       | honk  | macOS 26.2           | M1 (8c)            | 16 GB | iOS build worker                        |
| honkpi      | honkpi.local (192.168.1.45)         | pi    | Raspberry Pi OS      | Cortex-A72 (4c)    | 8 GB  | Home automation / IoT                   |
| honkstorage | honkstorage.local (192.168.1.27/28) | klabo | DSM 7.2.1            | Celeron J4125 (4c) | 8 GB  | NAS, Bitcoin data, media server         |

## IoT Devices

### Govee Smart Lights

Control via `govee` CLI (Cloud API). See `/govee` skill for details.

| Device     | Model | MAC                     |
| ---------- | ----- | ----------------------- |
| H6003_0e0c | H6003 | e5:c4:d4:ad:fc:08:0e:0c |
| H6003_8d75 | H6003 | f9:a4:7c:a6:b0:c1:8d:75 |
| H6003_992e | H6003 | c4:57:d4:ad:fc:08:99:2e |

| Command               | Example                |
| --------------------- | ---------------------- |
| `govee on`            | Turn on all            |
| `govee off 8d75`      | Turn off specific bulb |
| `govee brightness 50` | Set 50%                |
| `govee color 255 0 0` | Red                    |
| `govee color 0 255 0` | Green                  |
| `govee temp 3000`     | Warm white             |

### Security Cameras (Eufy)

See `/eufy` skill for camera control via eufy-security-ws.

| Name           | Model                 | MAC               | IP            | Location | Serial           |
| -------------- | --------------------- | ----------------- | ------------- | -------- | ---------------- |
| honkcam-office | Indoor Cam 2K (T8400) | 8C:85:80:DA:6D:A5 | 192.168.1.160 | Office   | T8400P2021380A13 |

**Access:** eufy-security-ws at `ws://honkbox.local:3001`

## Network Gear (UniFi)

- **UDM** (gateway/router): `192.168.1.1`
- **16-port switch**: set device name to `honk-switch-16` in UniFi Network (Devices > switch > Settings > General > Name).
  - Add a DHCP reservation once its IP is known.

### Displays

- **Vizio 4K TV (HONKDASH kiosk)**
  - Model: `V4K43M-0804` (EDID vendor `VIZ`)
  - Connected host: `honkpi` (HDMI-A-2)
  - Current mode: `4096x2160` (preferred `3840x2160@30Hz`)
  - Access: `ssh honkpi` for display mode/EDID inspection

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

## Audio Interfaces

### Scarlett 2i2 (honkbox)

- **Model:** Focusrite Scarlett 2i2 3rd Gen
- **USB ID:** 1235:8210
- **Host:** honkbox (USB audio)
- **ALSA card:** USB (card 2)
- **PipeWire sink:** `alsa_output.usb-Focusrite_Scarlett_2i2_USB_Y8TVWPH23DFE77-00.HiFi__Line__sink`
- **PipeWire source:** `alsa_input.usb-Focusrite_Scarlett_2i2_USB_Y8TVWPH23DFE77-00.HiFi__Mic1__source`
- **Default device state:** `~/.local/state/wireplumber/default-nodes`
- **Software monitor:** `~/.config/systemd/user/scarlett-mic1-monitor.service`

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
- **Network:** 192.168.1.63 (Wi-Fi), 192.168.1.24 (USB Ethernet)

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

## Shared Infrastructure (OneDrive)

Everything is synced via OneDrive. Syncthing has been removed.

| Resource          | Path                                                  |
| ----------------- | ----------------------------------------------------- |
| Skills            | `~/OneDrive/skills` (symlinked at `~/.claude/skills`) |
| Notes             | `~/OneDrive/notes`                                    |
| Financial imports | `~/OneDrive/quicken-imports`                          |
| Health data       | `~/OneDrive/Health`                                   |

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
   │  .63    │◄───────►│  .27/.28   │◄──────►│   .165    │
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

## UniFi / Ubiquiti (UDM + Switch)

### Console Access

- Local console UI: `https://192.168.1.1`
- Remote UI: `https://unifi.ui.com`
- Local UI uses a self-signed cert; ignore browser warnings when logging in.

### MFA / Login

- Console login uses UI account credentials; email MFA codes arrive from
  `account-noreply@ui.com` and expire after ~10 minutes.
- If you hit a login attempt limit, wait a few minutes before retrying.

### Devices

- UDM (gateway/router): `192.168.1.1`
- 16-port switch: **set name** `honk-switch-16` in UniFi Network (Devices > switch > Settings > General > Name).
  - Add a DHCP reservation once IP is known.

### SSH (Console vs Devices)

- UniFi Consoles (UDM/CloudKey) have SSH **disabled by default**; enable at:
  `Settings > Control Plane > Console > SSH`
- UniFi Network devices (APs/switches) have **separate SSH settings** from the console.
- Console SSH username is `root`, for example:
  `ssh root@192.168.1.1`
- Device SSH credentials are managed in UniFi Network under:
  `Settings > System > Advanced > Device Authentication`
- SSH keys can be added for devices at:
  `Settings > System > Advanced > Device Authentication > SSH Keys`

### Port Forwarding (UniFi Network)

- Network 9.4 path:
  `Settings > Policy Engine > Port Forwarding`
- Network 9.3 path:
  `Settings > Policy Table > Create New Policy > Port Forwarding`
- Typical rule fields:
  - WAN interface (one or all)
  - Incoming IP/port
  - Forward IP/port
  - Protocol (TCP/UDP/Both)
  - Optional syslog

### Troubleshooting Tips

- Port forwarding requires a **public WAN IP**. If WAN IP is private or CGNAT
  (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10), you’re behind
  upstream NAT.
  - Fix by bridging the ISP modem/router, or forward ports on the upstream
    device to the UDM WAN IP.
  - Hairpin NAT may fail: testing the public IP from inside the LAN can time out.
- A WAN port can only be forwarded to **one** internal host. UPnP can
  auto-claim ports; disable UPnP if there’s a conflict.
- If traffic never reaches the UDM WAN, check upstream firewall/ISP blocking.
- If traffic reaches the LAN host but fails, check the **host firewall**.

### DHCP Reservations

Reservations prevent IP drift which breaks SSH configs on honkstorage (uses hardcoded IPs).

| Machine  | MAC               | Reserved IP   | Status |
| -------- | ----------------- | ------------- | ------ |
| honkbox  | (check UniFi)     | 192.168.1.165 | Active |
| maxblack | ca:ad:1b:90:8a:12 | 192.168.1.63  | Active |

**To add via web UI:** Network > Client Devices > click device > Settings > Fixed IP Address > Save

### UniFi API Login (Automated via Playwright)

The UDM API requires email MFA. The curl-based API flow does NOT work for email MFA — there is no documented endpoint to submit email verification codes. Use Playwright (headless browser) instead:

```bash
cd /tmp && node unifi_login.js  # See script below
```

**Playwright login script** (`/tmp/unifi_login.js`):

1. Opens `https://192.168.1.1`, fills login form, submits
2. Lands on MFA page, waits for Resend Code countdown, clicks Resend
3. Reads **Gmail thread** (not individual message) via `gog gmail thread get <threadId>` to get the LATEST code
4. Enters the 6-digit code in the individual input fields
5. Saves session cookies + CSRF token for subsequent API calls

**Critical: Gmail threads MFA emails.** All codes from `account-noreply@ui.com` land in one thread. Use `gog gmail thread get <threadId>` and take the LAST code, not `gog gmail get <messageId>` (which only returns the first message).

**MFA thread ID** (may change if thread breaks): `19c67e55cac17395`

**After login, API calls use:**

```bash
# Cookies and CSRF saved by Playwright script
curl -sk -b /tmp/unifi_session_cookies -H "x-csrf-token: $(cat /tmp/unifi_csrf_token)" \
  'https://192.168.1.1/proxy/network/api/s/default/rest/networkconf'
```

**Gotchas:**

- SSO rate-limits after ~5 failed attempts. Wait 10-15 min before retrying.
- MFA codes expire in 10 minutes. Playwright must login → resend → get code → enter within that window.
- Gmail threads all MFA emails. `gog gmail search` returns the thread once; `gog gmail thread get` reveals all messages.
- `gog` must be set up with `gog auth add joelklabo@gmail.com --services gmail` (credentials.json from maxblack).
- Console SSH is **disabled by default**. Enable at Settings > Control Plane > Console > SSH for CLI access.
- Playwright installed via: `cd /tmp && npm init -y && npm install playwright && npx playwright install chromium`

### Local Notes

- Use DHCP reservations for servers (e.g., `honkbox` at `192.168.1.165`)
  so port forward targets stay stable.
- Public service: `lnbits.klabo.world` → `honkbox` (`192.168.1.165`)
- Cloudflare DNS: `A` record (DNS only) pointing to current public IP
- LNbits basic-auth credentials are stored in 1Password item `LNBits`.
- UDM policies:
  - `lnbits-https` (WAN 443 → `192.168.1.165:443`, TCP)
  - `lnbits-http` (WAN 80 → `192.168.1.165:80`, TCP)
  - `lnd-p2p` (WAN 9735 → `192.168.1.165:9735`, TCP)
- UDM local DNS record: `lnbits.klabo.world` → `192.168.1.165` (avoids hairpin issues)
- Protocol note: for HTTPS use **TCP 443**. Add **TCP 80** only if you want HTTP
  redirect or HTTP-01. Add **UDP 443** only if you plan to serve HTTP/3 (QUIC).
- Device SSH Authentication keys: `HonkBox` (ed25519), `Honk-Macs` (rsa).
- LND advertises external address via `externalip=73.71.178.128:9735` (update if ISP IP changes).

### Advanced Networking

Comcast/Xfinity gateway config, UniFi REST API, and WiFi optimization details: see [references/networking.md](references/networking.md).

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

### SSH connectivity audit

Run a full mesh test from any machine:

```bash
for src in honk maxblack honkbox honkpi honkstorage; do
  echo "FROM $src:"; ssh $src 'for h in honk maxblack honkbox honkpi honkstorage; do
    [ "$h" = "$(hostname -s)" ] && continue
    printf "  → %-12s " "$h:"; ssh -o ConnectTimeout=5 -o BatchMode=yes $h "echo OK" 2>&1
  done'; echo
done
```

### SSH broken? Common fixes

| Symptom                              | Cause                       | Fix                                                              |
| ------------------------------------ | --------------------------- | ---------------------------------------------------------------- |
| `Could not resolve hostname X.local` | mDNS not working (Synology) | Use IP in SSH config                                             |
| `Host key verification failed`       | Machine was reinstalled     | `ssh-keygen -R <hostname>` then reconnect                        |
| `Permission denied (publickey)`      | Key not in authorized_keys  | `ssh-copy-id <host>` or add pubkey via a machine that has access |
| `Connection timed out`               | IP changed (DHCP drift)     | Check real IP with `ping <host>.local`, update config            |
| ControlMaster errors                 | Missing sockets directory   | `mkdir -p ~/.ssh/sockets && chmod 700 ~/.ssh/sockets`            |

### SSH config rules

- **macOS/Linux machines**: Use `.local` mDNS hostnames (immune to IP changes)
- **honkstorage (Synology)**: Must use hardcoded IPs (no mDNS resolution)
- **Each machine has its own local `~/.ssh/config`** — do NOT symlink to shared/synced configs
- **honkpi uses `honklab_ed25519`** key for outbound, others use `id_ed25519`

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
