@echo off
setlocal

:: Title and styling
title OpenClaw Launcher
color 0F

echo.
echo ========================================================
echo   OpenClaw Launcher
echo ========================================================
echo.

:: Check for uv
where uv >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] 'uv' tool is not found. Please install it first:
    echo pip install uv
    pause
    exit /b 1
)

:: Create venv if not exists
if not exist ".venv" (
    echo [INFO] Creating virtual environment...
    uv venv
)

:: Install requirements if needed
echo [INFO] Checking dependencies...
uv pip install -r requirements-launcher.txt >nul 2>&1

:: Run the Python launcher (which handles the GUI and Tray)
echo [INFO] Launching Application...
uv run python scripts/launcher.py

pause
endlocal
