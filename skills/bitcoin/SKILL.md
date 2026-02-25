---
name: bitcoin
description: Manages Bitcoin Core node on honkbox with blockchain data on honkstorage NAS. Use when starting/stopping bitcoind, checking sync status, managing wallet, or troubleshooting node issues.
invocation: user
---

# Bitcoin Node

Bitcoin Core node running on honkbox with blockchain data stored on honkstorage Synology NAS.

## Quick Reference

| Task                | Command                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| Start node          | `systemctl --user start bitcoind`                                         |
| Stop node           | `systemctl --user stop bitcoind`                                          |
| Check status        | `bitcoin-cli getblockchaininfo`                                           |
| Sync progress       | `bitcoin-cli getblockchaininfo \| jq '.verificationprogress'`             |
| Peer info           | `bitcoin-cli getpeerinfo \| jq '.[].addr'`                                |
| Wallet balance      | `bitcoin-cli getbalance`                                                  |
| View logs           | `journalctl --user -u bitcoind -f`                                        |
| Start electrs       | `systemctl --user start electrs`                                          |
| Electrs status      | `systemctl --user status electrs`                                         |
| Electrs metrics     | `curl -s http://127.0.0.1:4224/metrics \| head`                           |
| LND info            | `docker exec lnd lncli --lnddir /data --network mainnet getinfo`          |
| LND deposit address | `docker exec lnd lncli --lnddir /data --network mainnet newaddress p2wkh` |

## Configuration

### Paths

| Item            | Location                                  |
| --------------- | ----------------------------------------- |
| Config file     | `~/.bitcoin/bitcoin.conf`                 |
| Data directory  | `~/mnt/honkstorage-bitcoin` (NFS mount)   |
| Actual data     | `honkstorage:/volume1/bitcoin`            |
| Logs            | `~/mnt/honkstorage-bitcoin/debug.log`     |
| Systemd service | `~/.config/systemd/user/bitcoind.service` |

### bitcoin.conf

```ini
# Data on NAS
datadir=/home/klabo/mnt/honkstorage-bitcoin

# Network
server=1
listen=1
txindex=1

# RPC
rpcuser=bitcoin
rpcpassword=<see ~/.bitcoin/bitcoin.conf>

# Performance
dbcache=2048
maxconnections=40

# Sparrow integration
rpcallowip=127.0.0.1
rpcbind=127.0.0.1
```

### Sparrow (Runs on honkbox)

- Use Electrum SSL on `127.0.0.1:50002`
- SSL cert: `~/.config/electrs-tls/electrs.crt`

### Sparrow Coldcard (Direct USB)

Sparrow USB connection uses HWI on honkbox. If Coldcard is not detected, install HWI and ensure udev permissions allow access.

```bash
# Install HWI (Arch)
pipx install hwi

# Verify device visibility
hwi enumerate
```

Udev rules (use system group `input`, not `plugdev`):

```udev
# /etc/udev/rules.d/51-coinkite.rules
SUBSYSTEM=="usb",  ATTR{idVendor}=="d13e", ATTR{idProduct}=="cc10", GROUP="input", MODE="0660", TAG+="uaccess"
KERNEL=="hidraw*", ATTRS{idVendor}=="d13e", ATTRS{idProduct}=="cc10", GROUP="input", MODE="0660", TAG+="uaccess"
```

Reload udev after changes:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=usb --action=add
sudo udevadm trigger --subsystem-match=hidraw --action=add
```

## Lightning Node (LND) Details

- Alias: `klabo.world`
- Pubkey: `0276dc1ed542d0d777b518f1bd05f042847f19f312718cf1303288119a0a789a68`
- Color: `#f7931a`
- Network: `mainnet`
- Listen: `0.0.0.0:9735`
- RPC: `127.0.0.1:10009`
- REST: `127.0.0.1:8080`

## LND Helpers (Docker)

```bash
# Node info
docker exec lnd lncli --lnddir /data --network mainnet getinfo

# Get a new on-chain deposit address
docker exec lnd lncli --lnddir /data --network mainnet newaddress p2wkh

# Balances
docker exec lnd lncli --lnddir /data --network mainnet walletbalance
docker exec lnd lncli --lnddir /data --network mainnet channelbalance

# Channels and peers
docker exec lnd lncli --lnddir /data --network mainnet listchannels
docker exec lnd lncli --lnddir /data --network mainnet listpeers
```

## Initial Sync Optimizations

During initial blockchain sync, use these aggressive settings:

```ini
# Large dbcache (system has 64GB RAM)
dbcache=8192

# Skip mempool during sync
blocksonly=1

# More parallel validation threads
par=0

# More connections
maxconnections=125

# Disable txindex during sync (enable after)
txindex=0
```

After sync completes:

1. Stop: `systemctl --user stop bitcoind`
2. Edit `~/.bitcoin/bitcoin.conf`: set `txindex=1`, `dbcache=2048`, remove `blocksonly=1`
3. Restart: `systemctl --user start bitcoind`
4. Wait for txindex to build (check logs)

## NFS Mount Setup

### On Synology (honkstorage)

1. Control Panel → Shared Folder → Create `bitcoin` on Volume 1
2. Control Panel → File Services → NFS → Enable
3. Edit folder → NFS Permissions:
   - Hostname: `192.168.1.*`
   - Privilege: Read/Write
   - Squash: Map all users to admin

### On honkbox

```bash
# Create mount point
mkdir -p ~/mnt/honkstorage-bitcoin

# Mount (add to fstab for persistence)
sudo mount -t nfs 192.168.1.28:/volume1/bitcoin ~/mnt/honkstorage-bitcoin
```

## Systemd Service

Located at `~/.config/systemd/user/bitcoind.service`:

```ini
[Unit]
Description=Bitcoin Core Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/bitcoind -daemon=0
ExecStop=/usr/bin/bitcoin-cli stop
Restart=on-failure
RestartSec=30
TimeoutStartSec=infinity
TimeoutStopSec=600
Nice=10
IOSchedulingClass=idle

[Install]
WantedBy=default.target
```

## Electrs (Electrum Server)

Electrs runs on honkbox via Docker and indexes the Bitcoin Core data on the NAS.

### Runtime

| Item         | Value                                              |
| ------------ | -------------------------------------------------- |
| Docker image | `lnliz/electrs:v0.11.0`                            |
| Command      | `/usr/bin/electrs --conf /etc/electrs/config.toml` |

### Paths

| Item            | Location                                 |
| --------------- | ---------------------------------------- |
| Config file     | `~/.config/electrs/config.toml`          |
| DB directory    | `~/mnt/honkstorage-bitcoin/electrs-db`   |
| Systemd service | `~/.config/systemd/user/electrs.service` |

### Ports

| Service      | Address          |
| ------------ | ---------------- |
| Electrum RPC | `0.0.0.0:50001`  |
| Electrum TLS | `0.0.0.0:50002`  |
| Metrics      | `127.0.0.1:4224` |

### Commands

| Task          | Command                           |
| ------------- | --------------------------------- |
| Start electrs | `systemctl --user start electrs`  |
| Stop electrs  | `systemctl --user stop electrs`   |
| Status        | `systemctl --user status electrs` |
| Logs          | `journalctl --user -u electrs -f` |

### Config (example)

```toml
# ~/.config/electrs/config.toml

db_dir = "/data"
daemon_dir = "/root/.bitcoin"
auth = "bitcoin:<rpcpassword>"

electrum_rpc_addr = "0.0.0.0:50001"
monitoring_addr = "127.0.0.1:4224"
```

## Troubleshooting

### Check if NFS is mounted

```bash
df -h ~/mnt/honkstorage-bitcoin
```

### Remount if disconnected

```bash
sudo mount -t nfs 192.168.1.28:/volume1/bitcoin ~/mnt/honkstorage-bitcoin
```

### Check peer connections

```bash
bitcoin-cli getconnectioncount
bitcoin-cli getpeerinfo | jq '.[].addr'
```

### View recent blocks

```bash
bitcoin-cli getblockchaininfo | jq '{blocks, headers, verificationprogress, size_on_disk}'
```

### Electrs TLS (stunnel)

TLS terminator on honkbox wraps Electrum RPC for port 50002.

| Item     | Value                                 |
| -------- | ------------------------------------- |
| Service  | `systemctl --user status electrs-tls` |
| Config   | `~/.config/electrs-tls/stunnel.conf`  |
| Cert     | `~/.config/electrs-tls/electrs.crt`   |
| TLS Port | `0.0.0.0:50002`                       |
