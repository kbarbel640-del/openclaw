@echo off
REM MT5 Control Launcher for Windows
REM Easily launch MT5 and run control scripts

set MT5_PATH="C:\Program Files\MetaTrader 5\terminal64.exe"
set PYTHON_SCRIPTS="%~dp0scripts"

echo ======================================
echo MT5 Control - Quick Launcher
echo ======================================
echo.

if "%1"=="" goto :menu
if "%1"=="start" goto :start_mt5
if "%1"=="status" goto :status
if "%1"=="trade" goto :trade
if "%1"=="close" goto :close
if "%1"=="data" goto :data

:menu
echo Commands:
echo   start    - Launch MT5 terminal
echo   status   - Show account status and positions
echo   trade    - Place a trade
echo   close    - Close positions
echo   data     - Get market data
echo.
echo Examples:
echo   mt5-control start
echo   mt5-control status
echo   mt5-control trade EURUSD BUY 0.01
echo   mt5-control close --all
echo   mt5-control data EURUSD H1
goto :end

:start_mt5
echo Launching MT5 terminal...
start "" %MT5_PATH%
echo MT5 launched. Use "mt5-control status" to check connection.
goto :end

:status
python %PYTHON_SCRIPTS%\account_status.py
goto :end

:trade
if "%2"=="" (
    echo Usage: mt5-control trade SYMBOL TYPE VOLUME [SL] [TP] [COMMENT]
    echo Example: mt5-control trade EURUSD BUY 0.01
    echo Example: mt5-control trade XAUUSD SELL 0.1 2400 2300
) else (
    python %PYTHON_SCRIPTS%\quick_trade.py %2 %3 %4 %5 %6 %7
)
goto :end

:close
if "%2"=="" (
    python %PYTHON_SCRIPTS%\close_positions.py
) else (
    python %PYTHON_SCRIPTS%\close_positions.py %2
)
goto :end

:data
if "%2"=="" (
    echo Usage: mt5-control data SYMBOL [TIMEFRAME] [COUNT]
    echo Example: mt5-control data EURUSD H1
    echo Example: mt5-control data XAUUSD M5 50
) else (
    python %PYTHON_SCRIPTS%\market_data.py %2 %3 %4
)
goto :end

:end
