@echo off
title OpenClaw Force Start
color 0A

echo ========================================================
echo   OpenClaw FORCE START DIAGNOSTIC
echo ========================================================
echo.
echo [INFO] Current Directory: %CD%
echo [INFO] Checking environment... (Outputting to startup_error.log)

(
    echo [INFO] Environment Check:
    echo DATE: %DATE% TIME: %TIME%
    echo CD: %CD%
    
    echo.
    echo [INFO] Checking for 'uv'...
    where uv
    if %errorlevel% neq 0 (
        echo [ERROR] 'uv' command not found in PATH.
        echo PATH: %PATH%
    ) else (
        echo [INFO] 'uv' found.
    )

    echo.
    echo [INFO] Checking for 'python'...
    where python
    if %errorlevel% neq 0 (
        echo [ERROR] 'python' command not found in PATH.
    ) else (
        echo [INFO] 'python' found.
        python --version
    )

    echo.
    echo [INFO] Attempting to launch scripts/launcher.py...
) > startup_error.log 2>&1

:: Attempt 1: Try with uv
echo [INFO] Trying launch with 'uv'...
uv run python scripts/launcher.py
if %errorlevel% neq 0 (
    echo [WARN] 'uv' launch failed (Code: %errorlevel%). Trying direct python...
    echo [WARN] 'uv' launch failed (Code: %errorlevel%). >> startup_error.log
    
    :: Attempt 2: Direct Python
    python scripts/launcher.py
    if %errorlevel% neq 0 (
       echo [ERROR] Direct python launch failed too.
       echo [ERROR] Direct python launch failed too. >> startup_error.log
    )
)

echo.
echo ========================================================
echo   DIAGNOSTIC COMPLETE
echo ========================================================
echo Check startup_error.log for details if it failed.
echo.
pause
