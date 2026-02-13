#!/usr/bin/env python3
"""
Helios Self-Monitoring Dashboard.

Parses brain.db for operational metrics:
- Message count trends
- STM growth rate
- Atom creation rate
- Sub-agent spawn frequency
- Consolidation ratio
- Average messages/day
- Memory growth velocity

Output: JSON at ~/.openclaw/workspace/data/helios-metrics.json
Optional: Prometheus /metrics endpoint on port 8032
"""
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_DEFAULT_DATA_DIR = Path.home() / ".openclaw" / "workspace" / "memory"
DATA_DIR = Path(os.environ.get("CORTEX_DATA_DIR", _DEFAULT_DATA_DIR))
DB_PATH = DATA_DIR / "brain.db"
METRICS_OUTPUT = Path.home() / ".openclaw" / "workspace" / "data" / "helios-metrics.json"


# ---------------------------------------------------------------------------
# Core Metrics Collection
# ---------------------------------------------------------------------------


def collect_metrics(db_path: str = str(DB_PATH)) -> dict:
    """Collect all Helios operational metrics from brain.db.

    Returns a dict suitable for JSON serialization.
    """
    if not Path(db_path).exists():
        return {"error": f"brain.db not found at {db_path}", "collected_at": _now()}

    conn = sqlite3.connect(db_path, timeout=5)
    conn.row_factory = sqlite3.Row

    metrics: Dict[str, Any] = {
        "collected_at": _now(),
        "db_path": db_path,
        "db_size_mb": round(Path(db_path).stat().st_size / (1024 * 1024), 2),
    }

    # ---- Totals ----
    metrics["totals"] = _get_totals(conn)

    # ---- Message trends (daily) ----
    metrics["message_trends"] = _get_daily_counts(conn, "messages", days=30)

    # ---- STM growth ----
    metrics["stm_trends"] = _get_daily_counts(conn, "stm", days=30)

    # ---- Atom creation rate ----
    metrics["atom_trends"] = _get_daily_counts(conn, "atoms", days=30)

    # ---- Averages ----
    metrics["averages"] = _compute_averages(metrics)

    # ---- Sub-agent spawn frequency (messages from/to sub-agents) ----
    metrics["subagent_spawns"] = _count_subagent_messages(conn, days=30)

    # ---- Consolidation ratio ----
    metrics["consolidation"] = _consolidation_stats(conn)

    # ---- Task delegation stats ----
    metrics["tasks"] = _task_stats(conn)

    # ---- Embedding coverage ----
    metrics["embedding_coverage"] = _embedding_coverage(conn)

    conn.close()
    return metrics


def _now() -> str:
    return datetime.now().isoformat()


def _get_totals(conn: sqlite3.Connection) -> dict:
    c = conn.cursor()
    totals = {}
    for table in ["messages", "stm", "atoms", "causal_links", "embeddings",
                   "threads", "working_memory", "categories"]:
        try:
            c.execute(f"SELECT COUNT(*) FROM {table}")
            totals[table] = c.fetchone()[0]
        except sqlite3.OperationalError:
            totals[table] = 0
    return totals


def _get_daily_counts(conn: sqlite3.Connection, table: str, days: int = 30) -> List[dict]:
    """Get daily creation counts for a table with a created_at column."""
    since = (datetime.now() - timedelta(days=days)).isoformat()
    c = conn.cursor()
    try:
        c.execute(f"""
            SELECT DATE(created_at) as day, COUNT(*) as count
            FROM {table}
            WHERE created_at >= ?
            GROUP BY DATE(created_at)
            ORDER BY day
        """, (since,))
        return [{"date": r[0], "count": r[1]} for r in c.fetchall()]
    except sqlite3.OperationalError:
        return []


def _compute_averages(metrics: dict) -> dict:
    """Compute averages from trends data."""
    def _avg(trends: List[dict]) -> float:
        if not trends:
            return 0.0
        counts = [t["count"] for t in trends]
        return round(sum(counts) / max(len(counts), 1), 2)

    def _velocity(trends: List[dict]) -> float:
        """Growth velocity: avg new entries per day over last 7 days."""
        recent = trends[-7:] if len(trends) >= 7 else trends
        return _avg(recent)

    return {
        "messages_per_day": _avg(metrics.get("message_trends", [])),
        "stm_per_day": _avg(metrics.get("stm_trends", [])),
        "atoms_per_day": _avg(metrics.get("atom_trends", [])),
        "stm_growth_velocity_7d": _velocity(metrics.get("stm_trends", [])),
        "atom_growth_velocity_7d": _velocity(metrics.get("atom_trends", [])),
    }


def _count_subagent_messages(conn: sqlite3.Connection, days: int = 30) -> dict:
    """Count messages involving sub-agents (agents with 'nova' or 'sub' in name)."""
    since = (datetime.now() - timedelta(days=days)).isoformat()
    c = conn.cursor()
    try:
        c.execute("""
            SELECT COUNT(*) FROM messages
            WHERE created_at >= ?
              AND (from_agent LIKE '%nova%' OR from_agent LIKE '%sub%'
                   OR to_agent LIKE '%nova%' OR to_agent LIKE '%sub%')
        """, (since,))
        total = c.fetchone()[0]

        # Daily breakdown
        c.execute("""
            SELECT DATE(created_at) as day, COUNT(*) as count
            FROM messages
            WHERE created_at >= ?
              AND (from_agent LIKE '%nova%' OR from_agent LIKE '%sub%'
                   OR to_agent LIKE '%nova%' OR to_agent LIKE '%sub%')
            GROUP BY DATE(created_at)
            ORDER BY day
        """, (since,))
        daily = [{"date": r[0], "count": r[1]} for r in c.fetchall()]

        return {"total": total, "daily": daily}
    except sqlite3.OperationalError:
        return {"total": 0, "daily": []}


def _consolidation_stats(conn: sqlite3.Connection) -> dict:
    """Stats about memory consolidation."""
    c = conn.cursor()
    try:
        c.execute("SELECT COUNT(*) FROM stm WHERE source LIKE 'consolidation%'")
        consolidated = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM stm")
        total = c.fetchone()[0]
        ratio = round(consolidated / max(total, 1), 4)
        return {
            "total_stm": total,
            "consolidated_entries": consolidated,
            "ratio": ratio,
        }
    except sqlite3.OperationalError:
        return {"total_stm": 0, "consolidated_entries": 0, "ratio": 0.0}


def _task_stats(conn: sqlite3.Connection) -> dict:
    """Stats about delegated tasks."""
    c = conn.cursor()
    try:
        c.execute("SELECT task_status, COUNT(*) FROM messages WHERE task_status IS NOT NULL GROUP BY task_status")
        by_status = dict(c.fetchall())
        return {
            "total": sum(by_status.values()),
            "by_status": by_status,
        }
    except sqlite3.OperationalError:
        return {"total": 0, "by_status": {}}


def _embedding_coverage(conn: sqlite3.Connection) -> dict:
    """What percentage of items have embeddings."""
    c = conn.cursor()
    result = {}
    for table, source_type in [("stm", "stm"), ("messages", "message"), ("atoms", "atom")]:
        try:
            c.execute(f"SELECT COUNT(*) FROM {table}")
            total = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM embeddings WHERE source_type = ?", (source_type,))
            embedded = c.fetchone()[0]
            pct = round(embedded / max(total, 1) * 100, 1)
            result[table] = {"total": total, "embedded": embedded, "coverage_pct": pct}
        except sqlite3.OperationalError:
            result[table] = {"total": 0, "embedded": 0, "coverage_pct": 0.0}
    return result


# ---------------------------------------------------------------------------
# Prometheus /metrics endpoint (optional)
# ---------------------------------------------------------------------------


def format_prometheus(metrics: dict) -> str:
    """Format metrics as Prometheus exposition format."""
    lines = []

    def _gauge(name: str, value, help_text: str = ""):
        if help_text:
            lines.append(f"# HELP {name} {help_text}")
        lines.append(f"# TYPE {name} gauge")
        lines.append(f"{name} {value}")

    totals = metrics.get("totals", {})
    _gauge("helios_messages_total", totals.get("messages", 0), "Total SYNAPSE messages")
    _gauge("helios_stm_total", totals.get("stm", 0), "Total STM entries")
    _gauge("helios_atoms_total", totals.get("atoms", 0), "Total atoms")
    _gauge("helios_causal_links_total", totals.get("causal_links", 0), "Total causal links")
    _gauge("helios_embeddings_total", totals.get("embeddings", 0), "Total embeddings")
    _gauge("helios_threads_total", totals.get("threads", 0), "Total threads")
    _gauge("helios_working_memory_pins", totals.get("working_memory", 0), "Working memory pins")
    _gauge("helios_db_size_mb", metrics.get("db_size_mb", 0), "brain.db size in MB")

    avgs = metrics.get("averages", {})
    _gauge("helios_messages_per_day", avgs.get("messages_per_day", 0), "Avg messages per day (30d)")
    _gauge("helios_stm_per_day", avgs.get("stm_per_day", 0), "Avg STM entries per day (30d)")
    _gauge("helios_atoms_per_day", avgs.get("atoms_per_day", 0), "Avg atoms per day (30d)")
    _gauge("helios_stm_growth_velocity_7d", avgs.get("stm_growth_velocity_7d", 0), "STM growth velocity (7d avg)")

    cons = metrics.get("consolidation", {})
    _gauge("helios_consolidation_ratio", cons.get("ratio", 0), "Ratio of consolidated STM entries")

    tasks = metrics.get("tasks", {})
    _gauge("helios_tasks_total", tasks.get("total", 0), "Total delegated tasks")
    for status, count in tasks.get("by_status", {}).items():
        lines.append(f'helios_tasks{{status="{status}"}} {count}')

    cov = metrics.get("embedding_coverage", {})
    for table, data in cov.items():
        _gauge(f"helios_embedding_coverage_{table}_pct", data.get("coverage_pct", 0),
               f"Embedding coverage for {table}")

    return "\n".join(lines) + "\n"


def write_metrics_json(metrics: dict, output_path: str = str(METRICS_OUTPUT)):
    """Write metrics to JSON file."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(metrics, f, indent=2, default=str)


def run_prometheus_server(port: int = 8032, db_path: str = str(DB_PATH)):
    """Run a simple Prometheus-compatible metrics endpoint."""
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class MetricsHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/metrics":
                m = collect_metrics(db_path)
                body = format_prometheus(m).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/health":
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.end_headers()
                self.wfile.write(b"ok")
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, format, *args):
            pass  # Silence request logs

    server = HTTPServer(("0.0.0.0", port), MetricsHandler)
    print(f"📊 Helios metrics server on http://0.0.0.0:{port}/metrics")
    server.serve_forever()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Helios Self-Monitoring Dashboard")
    parser.add_argument("--db", default=str(DB_PATH), help="brain.db path")
    parser.add_argument("--output", default=str(METRICS_OUTPUT), help="JSON output path")
    parser.add_argument("--prometheus", action="store_true", help="Start Prometheus endpoint")
    parser.add_argument("--port", type=int, default=8032, help="Prometheus port")
    parser.add_argument("--json", action="store_true", help="Print JSON to stdout")

    args = parser.parse_args()

    metrics = collect_metrics(args.db)

    if args.json:
        print(json.dumps(metrics, indent=2, default=str))
        return

    if args.prometheus:
        # Write once then serve
        write_metrics_json(metrics, args.output)
        print(f"📊 Wrote {args.output}")
        run_prometheus_server(port=args.port, db_path=args.db)
        return

    # Default: collect, write, print summary
    write_metrics_json(metrics, args.output)

    totals = metrics.get("totals", {})
    avgs = metrics.get("averages", {})
    cons = metrics.get("consolidation", {})

    print(f"📊 Helios Metrics — {metrics['collected_at'][:19]}")
    print(f"   DB Size: {metrics.get('db_size_mb', 0)} MB")
    print(f"\n   Totals:")
    for k, v in totals.items():
        print(f"     {k}: {v}")
    print(f"\n   Averages (30d):")
    print(f"     Messages/day: {avgs.get('messages_per_day', 0)}")
    print(f"     STM/day: {avgs.get('stm_per_day', 0)}")
    print(f"     Atoms/day: {avgs.get('atoms_per_day', 0)}")
    print(f"     STM velocity (7d): {avgs.get('stm_growth_velocity_7d', 0)}")
    print(f"\n   Consolidation:")
    print(f"     Ratio: {cons.get('ratio', 0)*100:.1f}% ({cons.get('consolidated_entries', 0)}/{cons.get('total_stm', 0)})")
    print(f"\n   → Wrote: {args.output}")


if __name__ == "__main__":
    main()
