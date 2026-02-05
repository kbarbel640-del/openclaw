#!/bin/bash
# FD Monitor - 持續監控 clawdbot gateway 的 fd 數量

echo "🔍 Monitoring clawdbot gateway file descriptors..."
echo "Press Ctrl+C to stop"
echo ""

while true; do
  timestamp=$(date '+%H:%M:%S')
  
  # 找到所有 clawdbot 進程
  pids=$(pgrep -f clawdbot | head -5)
  
  if [ -z "$pids" ]; then
    echo "[$timestamp] ⚠️  No clawdbot processes found"
    sleep 5
    continue
  fi
  
  echo "[$timestamp] Checking PIDs: $pids"
  
  for pid in $pids; do
    fd_count=$(lsof -p $pid 2>/dev/null | wc -l | xargs)
    reg_count=$(lsof -p $pid 2>/dev/null | grep REG | wc -l | xargs)
    
    # 警告閾值
    if [ "$fd_count" -gt 500 ]; then
      echo "  ⚠️  PID $pid: $fd_count fds ($reg_count REG) - WARNING!"
    elif [ "$fd_count" -gt 200 ]; then
      echo "  ⚡ PID $pid: $fd_count fds ($reg_count REG) - elevated"
    else
      echo "  ✅ PID $pid: $fd_count fds ($reg_count REG) - normal"
    fi
  done
  
  echo ""
  sleep 10
done
