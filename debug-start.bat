@echo off
echo Running OpenClaw Debug Mode...
echo Command: node scripts/run-node.mjs gateway run --dev --bind loopback --port 18789 --force
node scripts/run-node.mjs gateway run --dev --bind loopback --port 18789 --force
pause
