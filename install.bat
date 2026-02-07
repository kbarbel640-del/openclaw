@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: OpenClaw Windows Installer (CMD)
:: Installs Node.js 22+ (if needed) and OpenClaw via npm.
:: Usage:  install.bat [options]
::
:: Options:
::   --method npm|git   Install method (default: npm)
::   --tag <dist-tag>   npm dist-tag: latest, beta (default: latest)
::   --git-dir <path>   Clone directory for git method (default: %USERPROFILE%\openclaw)
::   --no-onboard       Skip onboarding after install
::   --dry-run          Print actions without executing
::   --help             Show this help
:: ============================================================================

set "SCRIPT_NAME=OpenClaw Windows Installer"
set "MIN_NODE_MAJOR=22"
set "INSTALL_METHOD=npm"
set "NPM_TAG=latest"
set "GIT_DIR=%USERPROFILE%\openclaw"
set "NO_ONBOARD=0"
set "DRY_RUN=0"
set "BIN_DIR=%USERPROFILE%\.local\bin"
set "NEED_PATH_UPDATE=0"

:: ---------------------------------------------------------------------------
:: Parse environment variable overrides
:: ---------------------------------------------------------------------------
if defined OPENCLAW_INSTALL_METHOD set "INSTALL_METHOD=%OPENCLAW_INSTALL_METHOD%"
if defined OPENCLAW_GIT_DIR set "GIT_DIR=%OPENCLAW_GIT_DIR%"
if defined OPENCLAW_NO_ONBOARD set "NO_ONBOARD=1"
if defined OPENCLAW_DRY_RUN set "DRY_RUN=1"

:: ---------------------------------------------------------------------------
:: Parse command-line arguments
:: ---------------------------------------------------------------------------
:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--method"       ( set "INSTALL_METHOD=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--install-method" ( set "INSTALL_METHOD=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--tag"          ( set "NPM_TAG=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--git-dir"      ( set "GIT_DIR=%~2" & shift & shift & goto :parse_args )
if /i "%~1"=="--no-onboard"   ( set "NO_ONBOARD=1" & shift & goto :parse_args )
if /i "%~1"=="--dry-run"      ( set "DRY_RUN=1" & shift & goto :parse_args )
if /i "%~1"=="--help"         goto :show_help
if /i "%~1"=="-h"             goto :show_help
echo [ERROR] Unknown option: %~1
echo Run "install.bat --help" for usage.
exit /b 1
:args_done

:: Validate install method
if /i not "%INSTALL_METHOD%"=="npm" if /i not "%INSTALL_METHOD%"=="git" (
    echo [ERROR] Invalid install method: %INSTALL_METHOD%. Must be "npm" or "git".
    exit /b 1
)

echo.
echo  ============================================
echo   %SCRIPT_NAME%
echo  ============================================
echo.
echo  Method : %INSTALL_METHOD%
if /i "%INSTALL_METHOD%"=="npm" echo  Tag    : %NPM_TAG%
if /i "%INSTALL_METHOD%"=="git" echo  GitDir : %GIT_DIR%
if "%DRY_RUN%"=="1" echo  Mode   : DRY RUN
echo.

:: =========================================================================
:: Step 1 - Ensure Node.js 22+
:: =========================================================================
echo [1/4] Checking Node.js ...

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  Node.js not found. Attempting to install ...
    call :install_node
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Could not install Node.js. Please install Node.js 22+ manually from https://nodejs.org
        exit /b 1
    )
    :: Re-check after install
    where node >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Node.js still not found after install. Please restart your terminal and rerun this script.
        exit /b 1
    )
)

:: Validate version
for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
set "NODE_VER=%NODE_VER:v=%"
if !NODE_VER! lss %MIN_NODE_MAJOR% (
    echo  Node.js v!NODE_VER! found, but v%MIN_NODE_MAJOR%+ is required.
    echo  Attempting to upgrade ...
    call :install_node
    for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
    set "NODE_VER=!NODE_VER:v=!"
    if !NODE_VER! lss %MIN_NODE_MAJOR% (
        echo [ERROR] Node.js upgrade failed. Please install Node.js %MIN_NODE_MAJOR%+ manually.
        exit /b 1
    )
)

for /f "delims=" %%v in ('node -v 2^>nul') do set "FULL_NODE_VER=%%v"
echo  Node.js %FULL_NODE_VER% - OK
echo.

:: =========================================================================
:: Step 2 - Ensure Git (required for git method, recommended for npm)
:: =========================================================================
echo [2/4] Checking Git ...

where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if /i "%INSTALL_METHOD%"=="git" (
        echo [ERROR] Git is required for git install method.
        echo  Install Git for Windows from https://git-scm.com/download/win
        exit /b 1
    )
    echo  Git not found ^(optional for npm method^). Some npm packages may need it.
    echo  Install Git for Windows from https://git-scm.com/download/win
) else (
    for /f "delims=" %%v in ('git --version 2^>nul') do echo  %%v - OK
)
echo.

:: =========================================================================
:: Step 3 - Install OpenClaw
:: =========================================================================
echo [3/4] Installing OpenClaw ...

if /i "%INSTALL_METHOD%"=="npm" (
    call :install_npm
) else (
    call :install_git
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Installation failed.
    exit /b 1
)
echo.

:: =========================================================================
:: Step 4 - Post-install
:: =========================================================================
echo [4/4] Post-install ...

:: Update PATH if needed
if "%NEED_PATH_UPDATE%"=="1" (
    call :add_to_path "%BIN_DIR%"
)

:: Verify openclaw is available
where openclaw >nul 2>&1
if %ERRORLEVEL% neq 0 (
    :: Try refreshing PATH inline
    call :refresh_path
    where openclaw >nul 2>&1
)

where openclaw >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [WARN] "openclaw" is not yet in your PATH.
    echo  You may need to restart your terminal or add the npm global bin to PATH:
    for /f "delims=" %%p in ('npm config get prefix 2^>nul') do echo    %%p
    echo.
) else (
    for /f "delims=" %%v in ('openclaw --version 2^>nul') do set "OC_VER=%%v"
    echo  openclaw !OC_VER! installed successfully.

    :: Run doctor (best effort)
    if "%DRY_RUN%"=="0" (
        echo  Running openclaw doctor ...
        openclaw doctor --non-interactive >nul 2>&1
    )

    :: Onboarding
    if "%NO_ONBOARD%"=="0" if "%DRY_RUN%"=="0" (
        echo.
        echo  Starting onboarding ...
        openclaw onboard
    )
)

echo.
echo  ============================================
echo   Installation complete!
echo  ============================================
echo.
echo  Run "openclaw" to get started.
echo.

endlocal
exit /b 0

:: ===========================================================================
:: Subroutines
:: ===========================================================================

:: ---------------------------------------------------------------------------
:install_node
:: Try winget, then chocolatey, then scoop
:: ---------------------------------------------------------------------------
if "%DRY_RUN%"=="1" (
    echo  [DRY RUN] Would install Node.js %MIN_NODE_MAJOR%+
    exit /b 0
)

:: Try winget
where winget >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  Installing Node.js via winget ...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if !ERRORLEVEL! equ 0 (
        call :refresh_path
        exit /b 0
    )
    echo  winget install did not succeed, trying alternatives ...
)

:: Try Chocolatey
where choco >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  Installing Node.js via Chocolatey ...
    choco install nodejs-lts -y
    if !ERRORLEVEL! equ 0 (
        call :refresh_path
        exit /b 0
    )
    echo  choco install did not succeed, trying alternatives ...
)

:: Try Scoop
where scoop >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  Installing Node.js via Scoop ...
    scoop install nodejs-lts
    if !ERRORLEVEL! equ 0 (
        call :refresh_path
        exit /b 0
    )
    echo  scoop install did not succeed.
)

echo [ERROR] No package manager found (winget, Chocolatey, or Scoop).
echo  Please install Node.js %MIN_NODE_MAJOR%+ manually from https://nodejs.org
exit /b 1

:: ---------------------------------------------------------------------------
:install_npm
:: Global npm install
:: ---------------------------------------------------------------------------
echo  Installing openclaw@%NPM_TAG% via npm (global) ...
if "%DRY_RUN%"=="1" (
    echo  [DRY RUN] npm install -g openclaw@%NPM_TAG%
    exit /b 0
)

npm install -g openclaw@%NPM_TAG%
exit /b %ERRORLEVEL%

:: ---------------------------------------------------------------------------
:install_git
:: Clone or update repo, build, install wrapper
:: ---------------------------------------------------------------------------
echo  Installing OpenClaw via git into %GIT_DIR% ...

if "%DRY_RUN%"=="1" (
    echo  [DRY RUN] git clone / pull + pnpm install + pnpm build
    echo  [DRY RUN] Create wrapper at %BIN_DIR%\openclaw.cmd
    exit /b 0
)

:: Ensure git is available (already checked above for git method)
if not exist "%GIT_DIR%\.git" (
    echo  Cloning repository ...
    git clone https://github.com/openclaw/openclaw.git "%GIT_DIR%"
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] git clone failed.
        exit /b 1
    )
) else (
    echo  Updating existing checkout ...
    pushd "%GIT_DIR%"
    git pull --rebase
    if !ERRORLEVEL! neq 0 (
        echo [WARN] git pull failed; continuing with current checkout.
    )
    popd
)

pushd "%GIT_DIR%"

:: Install pnpm if needed
where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  Installing pnpm ...
    npm install -g pnpm
)

echo  Installing dependencies ...
pnpm install
if !ERRORLEVEL! neq 0 (
    echo [ERROR] pnpm install failed.
    popd
    exit /b 1
)

echo  Building ...
pnpm build
if !ERRORLEVEL! neq 0 (
    echo [ERROR] pnpm build failed.
    popd
    exit /b 1
)

popd

:: Create wrapper script
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

(
    echo @echo off
    echo node "%GIT_DIR%\dist\entry.js" %%*
) > "%BIN_DIR%\openclaw.cmd"

echo  Wrapper created at %BIN_DIR%\openclaw.cmd

set "NEED_PATH_UPDATE=1"
exit /b 0

:: ---------------------------------------------------------------------------
:add_to_path
:: Add a directory to the user PATH (persistent)
:: ---------------------------------------------------------------------------
set "DIR_TO_ADD=%~1"
echo  Adding %DIR_TO_ADD% to user PATH ...

if "%DRY_RUN%"=="1" (
    echo  [DRY RUN] Would add "%DIR_TO_ADD%" to user PATH
    exit /b 0
)

:: Check if already in PATH
echo "%PATH%" | findstr /i /c:"%DIR_TO_ADD%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  Already in PATH.
    exit /b 0
)

:: Read current user PATH from registry
for /f "tokens=2,*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%b"

if not defined USER_PATH (
    set "NEW_PATH=%DIR_TO_ADD%"
) else (
    set "NEW_PATH=%USER_PATH%;%DIR_TO_ADD%"
)

reg add "HKCU\Environment" /v Path /t REG_EXPAND_SZ /d "%NEW_PATH%" /f >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo  PATH updated. Changes take effect in new terminals.
    :: Broadcast WM_SETTINGCHANGE so Explorer picks up the change
    rundll32.exe user32.dll,UpdatePerUserSystemParameters 1, True >nul 2>&1
) else (
    echo  [WARN] Could not update PATH automatically.
    echo  Please add "%DIR_TO_ADD%" to your PATH manually.
)

:: Also update current session
set "PATH=%PATH%;%DIR_TO_ADD%"
exit /b 0

:: ---------------------------------------------------------------------------
:refresh_path
:: Reload PATH from registry for the current session
:: ---------------------------------------------------------------------------
for /f "tokens=2,*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
for /f "tokens=2,*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%b"
if defined SYS_PATH if defined USR_PATH set "PATH=%SYS_PATH%;%USR_PATH%"
if defined SYS_PATH if not defined USR_PATH set "PATH=%SYS_PATH%"
exit /b 0

:: ---------------------------------------------------------------------------
:show_help
:: ---------------------------------------------------------------------------
echo.
echo  %SCRIPT_NAME%
echo.
echo  Usage: install.bat [options]
echo.
echo  Options:
echo    --method npm^|git    Install method (default: npm)
echo    --tag ^<dist-tag^>    npm dist-tag: latest, beta (default: latest)
echo    --git-dir ^<path^>    Clone directory for git method
echo                         (default: %%USERPROFILE%%\openclaw)
echo    --no-onboard         Skip onboarding after install
echo    --dry-run            Print actions without executing
echo    --help, -h           Show this help
echo.
echo  Environment variables:
echo    OPENCLAW_INSTALL_METHOD   npm or git
echo    OPENCLAW_GIT_DIR          Clone directory
echo    OPENCLAW_NO_ONBOARD       Set to 1 to skip onboarding
echo    OPENCLAW_DRY_RUN          Set to 1 for dry run
echo.
echo  Examples:
echo    install.bat
echo    install.bat --method git
echo    install.bat --tag beta --no-onboard
echo    install.bat --dry-run
echo.
exit /b 0
