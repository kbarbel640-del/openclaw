#!/usr/bin/env python3
"""
brain_backup — Export/import brain.db to portable JSON.

Usage:
    python3 brain_backup.py export /tmp/brain_export.json
    python3 brain_backup.py import /tmp/brain_export.json --target /tmp/restored.db
    python3 brain_backup.py export /tmp/brain_export.json --stats

Exports all data tables (messages, threads, read_receipts, acks, stm, atoms,
causal_links, embeddings). Embedding BLOBs are base64-encoded for portability.
Atom-level embedding BLOBs (subject_embedding, etc.) are skipped.

FTS5 virtual tables are NOT exported — they're rebuilt on import via
UnifiedBrain._init_schema() + re-population.
"""
import argparse
import base64
import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# Tables to export and their blob columns (base64-encoded) vs skip columns
EXPORT_TABLES = [
    "messages",
    "threads",
    "read_receipts",
    "acks",
    "stm",
    "atoms",
    "causal_links",
    "embeddings",
]

# Columns that contain BLOBs we want to base64-encode (keep in export)
BASE64_COLUMNS = {"embeddings": ["embedding"]}

# Columns that contain BLOBs we skip entirely (atom-level embeddings — large, re-computable)
SKIP_COLUMNS = {
    "atoms": [
        "subject_embedding",
        "action_embedding",
        "outcome_embedding",
        "consequences_embedding",
    ]
}

_DEFAULT_DB = Path(
    os.environ.get(
        "CORTEX_DATA_DIR",
        str(Path.home() / ".openclaw" / "workspace" / "memory"),
    )
) / "brain.db"


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _get_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    """Get column names for a table, excluding skip columns."""
    cursor = conn.execute(f"PRAGMA table_info({table})")
    all_cols = [row["name"] for row in cursor.fetchall()]
    skip = SKIP_COLUMNS.get(table, [])
    return [c for c in all_cols if c not in skip]


def _row_to_dict(row: sqlite3.Row, table: str, columns: list[str]) -> dict:
    """Convert a row to a dict, base64-encoding blob columns."""
    b64_cols = BASE64_COLUMNS.get(table, [])
    d = {}
    for col in columns:
        val = row[col]
        if col in b64_cols and isinstance(val, (bytes, memoryview)):
            d[col] = base64.b64encode(bytes(val)).decode("ascii")
            d[f"_{col}_encoding"] = "base64"
        else:
            d[col] = val
    return d


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


def show_stats(db_path: str) -> dict:
    """Show what would be exported without actually exporting."""
    conn = _connect(db_path)
    stats = {"db_path": db_path, "db_size_mb": 0, "tables": {}}

    try:
        stats["db_size_mb"] = round(Path(db_path).stat().st_size / 1024 / 1024, 2)
    except OSError:
        pass

    total_rows = 0
    for table in EXPORT_TABLES:
        try:
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        except sqlite3.OperationalError:
            count = 0
        stats["tables"][table] = count
        total_rows += count

    stats["total_rows"] = total_rows
    conn.close()
    return stats


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


def export_db(db_path: str, output_path: str) -> dict:
    """Export brain.db to a portable JSON file. Returns summary stats."""
    conn = _connect(db_path)
    export_data = {
        "version": 1,
        "format": "brain_backup",
        "exported_at": datetime.now().isoformat(),
        "source_db": db_path,
        "tables": {},
    }

    summary = {}
    for table in EXPORT_TABLES:
        try:
            columns = _get_columns(conn, table)
        except sqlite3.OperationalError:
            summary[table] = 0
            continue

        col_list = ", ".join(f'"{c}"' for c in columns)
        cursor = conn.execute(f"SELECT {col_list} FROM {table}")
        rows = []
        for row in cursor:
            rows.append(_row_to_dict(row, table, columns))

        export_data["tables"][table] = rows
        summary[table] = len(rows)

    conn.close()

    with open(output_path, "w", encoding="utf-8", errors="replace") as f:
        json.dump(export_data, f, indent=2, default=str, ensure_ascii=False)

    export_data_size = Path(output_path).stat().st_size
    summary["json_size_mb"] = round(export_data_size / 1024 / 1024, 2)
    return summary


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


def import_db(json_path: str, target_db: str) -> dict:
    """Import a brain backup JSON into a fresh brain.db. Returns summary."""
    if Path(target_db).exists():
        print(f"ERROR: Target DB already exists: {target_db}", file=sys.stderr)
        print("Remove it first or choose a different path.", file=sys.stderr)
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8", errors="replace") as f:
        data = json.load(f)

    if data.get("format") != "brain_backup":
        print("ERROR: Not a brain_backup JSON file.", file=sys.stderr)
        sys.exit(1)

    # Use UnifiedBrain to create schema (FTS5 tables, indexes, etc.)
    brain_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(brain_dir))
    os.environ.setdefault(
        "CORTEX_DATA_DIR", str(Path.home() / ".openclaw" / "workspace" / "memory")
    )
    from brain import UnifiedBrain

    brain = UnifiedBrain(target_db)
    conn = sqlite3.connect(target_db)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=OFF")  # Defer FK checks during bulk import

    summary = {}
    fts_messages = []
    fts_stm = []
    fts_atoms = []

    for table in EXPORT_TABLES:
        rows = data.get("tables", {}).get(table, [])
        if not rows:
            summary[table] = 0
            continue

        b64_cols = BASE64_COLUMNS.get(table, [])

        imported = 0
        for row in rows:
            # Decode base64 blobs
            for col in b64_cols:
                encoding_key = f"_{col}_encoding"
                if row.get(encoding_key) == "base64" and col in row:
                    row[col] = base64.b64decode(row[col])
                    del row[encoding_key]

            # Remove any encoding markers that slipped through
            clean_row = {
                k: v for k, v in row.items() if not k.startswith("_") or not k.endswith("_encoding")
            }

            columns = list(clean_row.keys())
            values = list(clean_row.values())
            placeholders = ", ".join("?" * len(columns))
            col_names = ", ".join(f'"{c}"' for c in columns)

            try:
                cursor = conn.execute(
                    f"INSERT OR IGNORE INTO {table} ({col_names}) VALUES ({placeholders})",
                    values,
                )
                if cursor.rowcount > 0:
                    imported += 1

                    # Track rowids for FTS re-population
                    if table == "messages":
                        fts_messages.append(
                            (cursor.lastrowid, clean_row.get("subject", ""), clean_row.get("body", ""))
                        )
                    elif table == "stm":
                        fts_stm.append((cursor.lastrowid, clean_row.get("content", "")))
                    elif table == "atoms":
                        fts_atoms.append(
                            (
                                cursor.lastrowid,
                                clean_row.get("subject", ""),
                                clean_row.get("action", ""),
                                clean_row.get("outcome", ""),
                                clean_row.get("consequences", ""),
                            )
                        )
            except sqlite3.Error as e:
                print(f"  WARN: {table} row skipped: {e}", file=sys.stderr)

        summary[table] = imported

    # Re-populate FTS5 indexes
    for rowid, subject, body in fts_messages:
        try:
            conn.execute(
                "INSERT INTO messages_fts(rowid, subject, body) VALUES (?, ?, ?)",
                (rowid, subject or "", body or ""),
            )
        except sqlite3.Error:
            pass

    for rowid, content in fts_stm:
        try:
            conn.execute(
                "INSERT INTO stm_fts(rowid, content) VALUES (?, ?)",
                (rowid, content or ""),
            )
        except sqlite3.Error:
            pass

    for rowid, subject, action, outcome, consequences in fts_atoms:
        try:
            conn.execute(
                "INSERT INTO atoms_fts(rowid, subject, action, outcome, consequences) VALUES (?, ?, ?, ?, ?)",
                (rowid, subject or "", action or "", outcome or "", consequences or ""),
            )
        except sqlite3.Error:
            pass

    conn.execute("PRAGMA foreign_keys=ON")
    conn.commit()
    conn.close()

    summary["target_db"] = target_db
    summary["target_size_mb"] = round(Path(target_db).stat().st_size / 1024 / 1024, 2)
    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="brain.db backup/export utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python3 brain_backup.py export /tmp/brain_export.json
  python3 brain_backup.py export /tmp/brain_export.json --stats
  python3 brain_backup.py import /tmp/brain_export.json --target /tmp/restored.db
""",
    )
    sub = parser.add_subparsers(dest="command")

    # export
    p_export = sub.add_parser("export", help="Export brain.db to JSON")
    p_export.add_argument("output", help="Output JSON path")
    p_export.add_argument(
        "--source",
        default=str(_DEFAULT_DB),
        help=f"Source brain.db path (default: {_DEFAULT_DB})",
    )
    p_export.add_argument(
        "--stats",
        action="store_true",
        help="Show what would be exported, then export",
    )

    # import
    p_import = sub.add_parser("import", help="Import JSON into a fresh brain.db")
    p_import.add_argument("input", help="Input JSON path")
    p_import.add_argument("--target", required=True, help="Target brain.db path")

    # stats (standalone)
    p_stats = sub.add_parser("stats", help="Show export stats without exporting")
    p_stats.add_argument(
        "--source",
        default=str(_DEFAULT_DB),
        help=f"Source brain.db path (default: {_DEFAULT_DB})",
    )

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "stats":
        stats = show_stats(args.source)
        print(f"brain.db backup stats — {stats['db_path']}")
        print(f"  DB size: {stats['db_size_mb']} MB")
        print(f"  Total rows: {stats['total_rows']}")
        for table, count in stats["tables"].items():
            print(f"    {table:20s} {count:>6d}")

    elif args.command == "export":
        if args.stats:
            stats = show_stats(args.source)
            print(f"brain.db export preview — {stats['db_path']}")
            print(f"  DB size: {stats['db_size_mb']} MB")
            print(f"  Total rows: {stats['total_rows']}")
            for table, count in stats["tables"].items():
                print(f"    {table:20s} {count:>6d}")
            print()

        print(f"Exporting {args.source} -> {args.output} ...")
        summary = export_db(args.source, args.output)
        print(f"Export complete ({summary['json_size_mb']} MB JSON)")
        for table, count in summary.items():
            if table not in ("json_size_mb",):
                print(f"    {table:20s} {count:>6d}")

    elif args.command == "import":
        print(f"Importing {args.input} -> {args.target} ...")
        summary = import_db(args.input, args.target)
        print(f"Import complete ({summary['target_size_mb']} MB)")
        for table, count in summary.items():
            if table not in ("target_db", "target_size_mb"):
                print(f"    {table:20s} {count:>6d}")

        # Verify with stats
        print(f"\nVerification:")
        verify = show_stats(summary["target_db"])
        for table, count in verify["tables"].items():
            print(f"    {table:20s} {count:>6d}")


if __name__ == "__main__":
    main()
