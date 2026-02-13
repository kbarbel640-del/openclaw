---
name: mt5-window-control
description: Control MetaTrader 5 window visibility (hide/show/minimize/restore). Useful for keeping MT5 running in background during automated trading without cluttering the desktop.
metadata:
  {
    "openclaw":
      {
        "emoji": "🖥️",
        "requires": {},
      },
  }
---

# MT5 Window Control

Control MT5 window visibility - hide, show, minimize, or restore the terminal.

## Quick Start

### Hide MT5 Window

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\User\Desktop\openclaw\skills\mt5-control\scripts\hide_mt5.ps1
```

### Show MT5 Window

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\User\Desktop\openclaw\skills\mt5-control\scripts\show_mt5.ps1
```

## Script Details

### hide_mt5.ps1

Hides the MT5 window completely (does not appear in taskbar, but still running).

**Usage:**
```powershell
scripts\hide_mt5.ps1
```

### show_mt5.ps1

Restores and brings the MT5 window to foreground.

**Usage:**
```powershell
scripts\show_mt5.ps1
```

## Windows API Constants

| Value | Constant | Action |
|-------|----------|--------|
| 0 | SW_HIDE | Hide window |
| 1 | SW_SHOWNORMAL | Show normal |
| 2 | SW_SHOWMINIMIZED | Show minimized |
| 6 | SW_MINIMIZE | Minimize window |
| 9 | SW_RESTORE | Restore window |

## Why Hide MT5?

- **Clean Desktop** - MT5 window can take up screen space
- **Automated Trading** - Run trading bots without visual distraction
- **Background Operations** - Keep API connection active while hidden
- **Security** - Hide trading activity from prying eyes

## Note

MT5 process must be running for window control to work. The Python API (`mt5-control`) works regardless of window visibility.

## Integration with mt5-control

Combine with MT5 Control for seamless automation:

```powershell
# Hide window before running automated trading
powershell -ExecutionPolicy Bypass -File scripts\hide_mt5.ps1

# Run trading operations
python scripts/account_status.py

# Show window when needed
powershell -ExecutionPolicy Bypass -File scripts\show_mt5.ps1
```
