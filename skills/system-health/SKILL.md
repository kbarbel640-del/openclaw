---
name: system-health
description: "Monitor system health: CPU, memory, disk usage, network info, and running processes. Works on macOS and Linux."
homepage: https://docs.openclaw.ai/tools/skills
metadata:
  {
    "openclaw":
      {
        "emoji": "💻",
        "requires": { "bins": ["top", "df", "free"] },
        "platforms": ["macos", "linux"],
      },
  }
---

# System Health Monitor

Monitor your system's health including CPU usage, memory, disk space, network info, and running processes. All commands use built-in system utilities — no installation required.

## Quick System Overview

### macOS

Get a quick snapshot of system resources:

```bash
# One-liner system summary
echo "=== CPU ===" && top -l 1 | head -10 && echo -e "\n=== Memory ===" && vm_stat | head -6 && echo -e "\n=== Disk ===" && df -h / | tail -1
```

### Linux

```bash
# One-liner system summary
echo "=== CPU ===" && top -bn1 | head -5 && echo -e "\n=== Memory ===" && free -h && echo -e "\n=== Disk ===" && df -h / | tail -1
```

## CPU Usage

### macOS

```bash
# Current CPU usage (snapshot)
top -l 1 | grep "CPU usage"

# Detailed CPU info
sysctl -n machdep.cpu.brand_string
sysctl -n hw.ncpu
```

### Linux

```bash
# Current CPU usage
top -bn1 | grep "Cpu(s)" | awk '{print "CPU Usage: " $2 "% user, " $4 "% system, " $8 "% idle"}'

# CPU info
cat /proc/cpuinfo | grep "model name" | head -1
nproc
```

## Memory Usage

### macOS

```bash
# Memory summary (pages → MB conversion)
vm_stat | awk '/Pages free/ {free=$3} /Pages active/ {active=$3} /Pages inactive/ {inactive=$3} /Pages wired/ {wired=$3} END {
  page_size=4096;
  total=free+active+inactive+wired;
  printf "Free: %.0f MB\nActive: %.0f MB\nInactive: %.0f MB\nWired: %.0f MB\nTotal Used: %.0f MB\n",
    free*page_size/1024/1024, active*page_size/1024/1024, inactive*page_size/1024/1024, wired*page_size/1024/1024, (active+wired)*page_size/1024/1024
}'

# Total physical memory
sysctl -n hw.memsize | awk '{printf "Total RAM: %.1f GB\n", $1/1024/1024/1024}'
```

### Linux

```bash
# Human-readable memory usage
free -h

# Memory percentage used
free | awk '/Mem:/ {printf "Memory Usage: %.1f%%\n", $3/$2*100}'
```

## Disk Usage

### Both macOS & Linux

```bash
# All mounted filesystems
df -h

# Root partition only
df -h / | tail -1 | awk '{print "Disk: " $3 " used of " $2 " (" $5 " full)"}'

# Top 10 largest directories in current location
du -sh * 2>/dev/null | sort -hr | head -10

# Largest files (top 10)
find . -type f -exec du -h {} + 2>/dev/null | sort -hr | head -10
```

## Network Information

### macOS

```bash
# Public IP address
curl -s ifconfig.me && echo

# Local IP address (Wi-Fi)
ipconfig getifaddr en0

# All network interfaces
ifconfig | grep "inet " | awk '{print $2}'

# Active connections count
netstat -an | grep ESTABLISHED | wc -l
```

### Linux

```bash
# Public IP address
curl -s ifconfig.me && echo

# Local IP address
hostname -I | awk '{print $1}'

# All network interfaces
ip -4 addr show | grep inet | awk '{print $2}'

# Active connections count
ss -t state established | wc -l
```

## Running Processes

### Both macOS & Linux

```bash
# Top 10 CPU-consuming processes
ps aux --sort=-%cpu | head -11

# Top 10 memory-consuming processes
ps aux --sort=-%mem | head -11

# Count of running processes
ps aux | wc -l
```

### macOS specific

```bash
# Top processes with user-friendly output
top -l 1 -n 10 -stats pid,command,cpu,mem | tail -11
```

## System Uptime

### Both macOS & Linux

```bash
uptime
```

## Battery Status (Laptops)

### macOS

```bash
pmset -g batt | grep -o '[0-9]*%'
pmset -g batt | grep -E "(charging|discharging|charged)"
```

### Linux

```bash
cat /sys/class/power_supply/BAT0/capacity 2>/dev/null && echo "%"
cat /sys/class/power_supply/BAT0/status 2>/dev/null
```

## System Alerts

### Check for high resource usage

```bash
# Alert if CPU > 80% (Linux)
cpu=$(top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8}')
echo "CPU: ${cpu}%" && [ $(echo "$cpu > 80" | bc) -eq 1 ] && echo "⚠️ HIGH CPU USAGE!"

# Alert if disk > 90% full
disk=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
echo "Disk: ${disk}%" && [ "$disk" -gt 90 ] && echo "⚠️ LOW DISK SPACE!"

# Alert if memory > 85% (Linux)
mem=$(free | awk '/Mem:/ {printf "%.0f", $3/$2*100}')
echo "Memory: ${mem}%" && [ "$mem" -gt 85 ] && echo "⚠️ HIGH MEMORY USAGE!"
```

## Notes

- **macOS** uses different commands than Linux — the skill includes both
- Memory reporting differs between systems (vm_stat vs free)
- All commands are non-destructive and read-only
- For continuous monitoring, consider tools like `htop`, `glances`, or `btop`
