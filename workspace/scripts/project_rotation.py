#!/usr/bin/env python3
"""
Project Rotation Suggestion
Reads PROJECT_REGISTRY.md and suggests 1-2 projects to push.
"""

import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

TPE = timezone(timedelta(hours=8))


def _parse_dt(text: str):
    text = text.strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=TPE)
        except Exception:
            continue
    return None


def _priority_weight(text: str) -> int:
    if "🔴" in text:
        return 0
    if "⚙️" in text:
        return 0
    if "🟡" in text:
        return 1
    if "🟢" in text:
        return 2
    return 3


def _load_table(lines):
    rows = []
    in_table = False
    for line in lines:
        if line.strip().startswith("| # |"):
            in_table = True
            continue
        if in_table:
            if not line.strip().startswith("|"):
                break
            if "---" in line:
                continue
            cols = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cols) < 6:
                continue
            rows.append({
                "idx": cols[0],
                "name": cols[1],
                "priority": cols[2],
                "status": cols[3],
                "last_checked": cols[4],
                "next_action": cols[5],
            })
    return rows


def _load_table_with_indices(lines):
    rows = []
    in_table = False
    for i, line in enumerate(lines):
        if line.strip().startswith("| # |"):
            in_table = True
            continue
        if in_table:
            if not line.strip().startswith("|"):
                break
            if "---" in line:
                continue
            cols = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cols) < 6:
                continue
            rows.append({
                "idx": cols[0],
                "name": cols[1],
                "priority": cols[2],
                "status": cols[3],
                "last_checked": cols[4],
                "next_action": cols[5],
                "line_index": i,
                "cols": cols,
            })
    return rows


def suggest(count: int, registry_path: Path, update: bool = False):
    if not registry_path.exists():
        print("PROJECT_REGISTRY.md not found")
        return 1
    lines = registry_path.read_text().splitlines()
    rows = _load_table(lines)
    if not rows:
        print("No projects found in registry")
        return 1

    enriched = []
    for r in rows:
        dt = _parse_dt(r["last_checked"])
        enriched.append({
            **r,
            "last_dt": dt,
            "prio": _priority_weight(r["priority"]),
        })

    # Sort by priority then oldest last check
    def sort_key(item):
        last_ts = item["last_dt"].timestamp() if item["last_dt"] else 0
        return (item["prio"], last_ts)

    enriched.sort(key=sort_key)
    picks = enriched[:count]

    print("🔄 專案輪值建議")
    for i, p in enumerate(picks, 1):
        last = p["last_checked"] or "未知"
        print(f"{i}. {p['name']} | {p['priority']} | 上次: {last}")
        if p["next_action"]:
            print(f"   下一步: {p['next_action']}")

    if update:
        _update_registry(lines, picks, registry_path)
    return 0


def _update_registry(lines, picks, registry_path: Path):
    now = datetime.now(TPE)
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M")

    rows = _load_table_with_indices(lines)
    row_by_name = {r["name"]: r for r in rows}

    for p in picks:
        row = row_by_name.get(p["name"])
        if not row:
            continue
        cols = row["cols"]
        cols[4] = f"{date_str} {time_str}"
        lines[row["line_index"]] = "| " + " | ".join(cols) + " |"

    # Append rotation log entries
    insert_at = None
    in_log_table = False
    for i, line in enumerate(lines):
        if line.strip().startswith("## 🕐 輪值記錄"):
            in_log_table = True
            continue
        if in_log_table:
            if line.strip().startswith("| 日期 |"):
                continue
            if line.strip().startswith("|---"):
                continue
            if line.strip().startswith("|"):
                insert_at = i + 1
                continue
            # first non-table line
            insert_at = i if insert_at is None else insert_at
            break

    if insert_at is None:
        insert_at = len(lines)

    new_lines = []
    for p in picks:
        new_lines.append(
            f"| {date_str} | {time_str} | {p['name']} | 輪值建議（自動） | ⏳ |"
        )

    lines[insert_at:insert_at] = new_lines
    try:
        registry_path.write_text("\n".join(lines) + "\n")
    except Exception as e:
        print(f"registry:WARN {e}")


def main():
    parser = argparse.ArgumentParser(description="Suggest projects to rotate")
    parser.add_argument("--count", type=int, default=2, help="Number of projects to suggest")
    parser.add_argument("--registry", default="~/clawd/PROJECT_REGISTRY.md")
    parser.add_argument("--update", action="store_true", help="Update PROJECT_REGISTRY.md")
    args = parser.parse_args()

    registry_path = Path(args.registry).expanduser()
    return suggest(args.count, registry_path, update=args.update)


if __name__ == "__main__":
    raise SystemExit(main())
