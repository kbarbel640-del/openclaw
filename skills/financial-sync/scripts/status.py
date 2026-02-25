#!/usr/bin/env python3
"""
Financial Sync Status Dashboard
Shows current sync status for all financial data sources.
"""

import json
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

# ANSI color codes
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

# Staleness thresholds (in hours)
TELLER_STALE_HOURS = 24
FIDELITY_STALE_HOURS = 48
RIVER_STALE_HOURS = 48
EXCEL_STALE_HOURS = 72

# File paths
TELLER_DB = Path.home() / "projects/teller-sync/transactions.db"
QUICKEN_DIR = Path.home() / "Shared/quicken-imports"
FIDELITY_STATE = QUICKEN_DIR / "fidelity-state.json"
RIVER_STATE = QUICKEN_DIR / "river-login-state.json"
EXCEL_FILE = Path.home() / ".openclaw/files/finance/documents/finances.xlsx"


def format_time_ago(dt: datetime) -> str:
    """Format a datetime as a human-readable 'time ago' string."""
    now = datetime.now()
    diff = now - dt

    if diff < timedelta(minutes=1):
        return "just now"
    elif diff < timedelta(hours=1):
        mins = int(diff.total_seconds() / 60)
        return f"{mins}m ago"
    elif diff < timedelta(days=1):
        hours = int(diff.total_seconds() / 3600)
        return f"{hours}h ago"
    elif diff < timedelta(days=7):
        days = diff.days
        return f"{days}d ago"
    else:
        return dt.strftime("%Y-%m-%d")


def get_status_color(hours_old: float, stale_threshold: float) -> str:
    """Return color based on how old the data is."""
    if hours_old < stale_threshold * 0.5:
        return GREEN
    elif hours_old < stale_threshold:
        return YELLOW
    else:
        return RED


def get_teller_status() -> dict:
    """Get Teller sync status from SQLite database."""
    result = {
        "available": False,
        "last_sync": None,
        "transaction_count": 0,
        "accounts": [],
        "latest_txn_date": None,
        "warnings": []
    }

    if not TELLER_DB.exists():
        result["warnings"].append("Database not found")
        return result

    try:
        conn = sqlite3.connect(TELLER_DB)
        cursor = conn.cursor()

        # Get transaction count
        cursor.execute("SELECT COUNT(*) FROM transactions")
        result["transaction_count"] = cursor.fetchone()[0]

        # Get last sync time
        cursor.execute("SELECT MAX(synced_at) FROM transactions")
        last_sync = cursor.fetchone()[0]
        if last_sync:
            result["last_sync"] = datetime.fromisoformat(last_sync)

        # Get latest transaction date
        cursor.execute("SELECT MAX(date) FROM transactions")
        latest_date = cursor.fetchone()[0]
        if latest_date:
            result["latest_txn_date"] = latest_date

        # Get accounts by institution
        cursor.execute("""
            SELECT institution_name, COUNT(*),
                   GROUP_CONCAT(name || ' (' || COALESCE(last_four, '****') || ')')
            FROM accounts
            GROUP BY institution_name
        """)
        for row in cursor.fetchall():
            result["accounts"].append({
                "institution": row[0],
                "count": row[1],
                "details": row[2]
            })

        conn.close()
        result["available"] = True

        # Check staleness
        if result["last_sync"]:
            hours_old = (datetime.now() - result["last_sync"]).total_seconds() / 3600
            if hours_old > TELLER_STALE_HOURS:
                result["warnings"].append(f"Data is {int(hours_old)}h old (threshold: {TELLER_STALE_HOURS}h)")

    except Exception as e:
        result["warnings"].append(f"Error reading database: {e}")

    return result


def get_json_state(filepath: Path, name: str, stale_hours: float) -> dict:
    """Get status from a JSON state file."""
    result = {
        "available": False,
        "last_attempt": None,
        "failure_count": 0,
        "warnings": []
    }

    if not filepath.exists():
        result["warnings"].append("State file not found")
        return result

    try:
        with open(filepath) as f:
            data = json.load(f)

        result["available"] = True

        if "last_attempt" in data:
            result["last_attempt"] = datetime.fromtimestamp(data["last_attempt"])

        result["failure_count"] = data.get("failure_count", 0)

        # Check for failures
        if result["failure_count"] > 0:
            result["warnings"].append(f"Failed {result['failure_count']} time(s)")

        # Check staleness
        if result["last_attempt"]:
            hours_old = (datetime.now() - result["last_attempt"]).total_seconds() / 3600
            if hours_old > stale_hours:
                result["warnings"].append(f"Last attempt was {int(hours_old)}h ago")

    except json.JSONDecodeError as e:
        result["warnings"].append(f"Invalid JSON: {e}")
    except Exception as e:
        result["warnings"].append(f"Error: {e}")

    return result


def get_excel_status() -> dict:
    """Get Excel file modification status."""
    result = {
        "available": False,
        "modified": None,
        "warnings": []
    }

    if not EXCEL_FILE.exists():
        result["warnings"].append("File not found")
        return result

    try:
        stat = EXCEL_FILE.stat()
        result["modified"] = datetime.fromtimestamp(stat.st_mtime)
        result["size_kb"] = stat.st_size / 1024
        result["available"] = True

        # Check staleness
        hours_old = (datetime.now() - result["modified"]).total_seconds() / 3600
        if hours_old > EXCEL_STALE_HOURS:
            result["warnings"].append(f"Not modified in {int(hours_old)}h")

    except Exception as e:
        result["warnings"].append(f"Error: {e}")

    return result


def print_header():
    """Print dashboard header."""
    print()
    print(f"{BOLD}{'=' * 60}{RESET}")
    print(f"{BOLD}          FINANCIAL SYNC STATUS DASHBOARD{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}")
    print(f"{DIM}  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{RESET}")
    print()


def print_section(title: str, status_char: str, color: str):
    """Print a section header."""
    print(f"{color}{BOLD}[{status_char}] {title}{RESET}")


def print_row(label: str, value: str, indent: int = 4):
    """Print a labeled value row."""
    print(f"{' ' * indent}{DIM}{label}:{RESET} {value}")


def print_warnings(warnings: list, indent: int = 4):
    """Print warning messages."""
    for warning in warnings:
        print(f"{' ' * indent}{YELLOW}! {warning}{RESET}")


def main():
    print_header()

    all_warnings = []

    # Teller Status
    teller = get_teller_status()
    if teller["available"] and teller["last_sync"]:
        hours_old = (datetime.now() - teller["last_sync"]).total_seconds() / 3600
        color = get_status_color(hours_old, TELLER_STALE_HOURS)
        status_char = "OK" if color == GREEN else ("!" if color == YELLOW else "X")
    else:
        color = RED
        status_char = "X"

    print_section("TELLER (Bank Transactions)", status_char, color)
    if teller["available"]:
        if teller["last_sync"]:
            print_row("Last Sync", format_time_ago(teller["last_sync"]))
        print_row("Transactions", f"{teller['transaction_count']:,}")
        if teller["latest_txn_date"]:
            print_row("Latest Txn", teller["latest_txn_date"])
        for acct in teller["accounts"]:
            print_row(acct["institution"], f"{acct['count']} accounts")
    print_warnings(teller["warnings"])
    all_warnings.extend([(f"Teller: {w}") for w in teller["warnings"]])
    print()

    # Fidelity Status
    fidelity = get_json_state(FIDELITY_STATE, "Fidelity", FIDELITY_STALE_HOURS)
    if fidelity["available"] and fidelity["failure_count"] == 0:
        if fidelity["last_attempt"]:
            hours_old = (datetime.now() - fidelity["last_attempt"]).total_seconds() / 3600
            color = get_status_color(hours_old, FIDELITY_STALE_HOURS)
        else:
            color = YELLOW
        status_char = "OK" if color == GREEN else ("!" if color == YELLOW else "X")
    else:
        color = RED if fidelity["failure_count"] > 0 else YELLOW
        status_char = "X" if fidelity["failure_count"] > 0 else "?"

    print_section("FIDELITY (Investments)", status_char, color)
    if fidelity["available"]:
        if fidelity["last_attempt"]:
            print_row("Last Attempt", format_time_ago(fidelity["last_attempt"]))
        status_text = f"{RED}FAILED{RESET}" if fidelity["failure_count"] > 0 else f"{GREEN}OK{RESET}"
        print_row("Status", status_text)
    print_warnings(fidelity["warnings"])
    all_warnings.extend([(f"Fidelity: {w}") for w in fidelity["warnings"]])
    print()

    # River Status
    river = get_json_state(RIVER_STATE, "River", RIVER_STALE_HOURS)
    if river["available"] and river["failure_count"] == 0:
        if river["last_attempt"]:
            hours_old = (datetime.now() - river["last_attempt"]).total_seconds() / 3600
            color = get_status_color(hours_old, RIVER_STALE_HOURS)
        else:
            color = YELLOW
        status_char = "OK" if color == GREEN else ("!" if color == YELLOW else "X")
    else:
        color = RED if river["failure_count"] > 0 else YELLOW
        status_char = "X" if river["failure_count"] > 0 else "?"

    print_section("RIVER (Bitcoin)", status_char, color)
    if river["available"]:
        if river["last_attempt"]:
            print_row("Last Attempt", format_time_ago(river["last_attempt"]))
        status_text = f"{RED}FAILED{RESET}" if river["failure_count"] > 0 else f"{GREEN}OK{RESET}"
        print_row("Status", status_text)
    print_warnings(river["warnings"])
    all_warnings.extend([(f"River: {w}") for w in river["warnings"]])
    print()

    # Excel Status
    excel = get_excel_status()
    if excel["available"]:
        hours_old = (datetime.now() - excel["modified"]).total_seconds() / 3600
        color = get_status_color(hours_old, EXCEL_STALE_HOURS)
        status_char = "OK" if color == GREEN else ("!" if color == YELLOW else "X")
    else:
        color = RED
        status_char = "X"

    print_section("EXCEL (finances.xlsx)", status_char, color)
    if excel["available"]:
        print_row("Last Modified", format_time_ago(excel["modified"]))
        print_row("Size", f"{excel['size_kb']:.1f} KB")
    print_warnings(excel["warnings"])
    all_warnings.extend([(f"Excel: {w}") for w in excel["warnings"]])
    print()

    # Summary
    print(f"{BOLD}{'=' * 60}{RESET}")
    if all_warnings:
        print(f"{YELLOW}{BOLD}  {len(all_warnings)} WARNING(S){RESET}")
        for warning in all_warnings:
            print(f"  {YELLOW}- {warning}{RESET}")
    else:
        print(f"{GREEN}{BOLD}  ALL SYSTEMS OK{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}")
    print()


if __name__ == "__main__":
    main()
