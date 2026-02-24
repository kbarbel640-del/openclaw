@echo off
REM Run OpenClaw cipher from any directory. Add this folder to PATH or use full path.
set REPO=%~dp0..
cd /d "%REPO%"
node openclaw.mjs cipher %*
