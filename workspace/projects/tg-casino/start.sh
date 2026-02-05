#!/bin/bash
cd /Users/sulaxd/clawd/projects/tg-casino
./venv/bin/python -m src.main >> bot.log 2>&1 &
echo $! > bot.pid
echo "Bot started with PID $(cat bot.pid)"
