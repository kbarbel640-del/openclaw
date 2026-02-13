"""
Tests for helios_monitor.py

Usage:
    CORTEX_DATA_DIR=/tmp/monitor_test pytest test_helios_monitor.py -v --tb=short
"""
import json
import os
import sqlite3
import tempfile
from pathlib import Path

import pytest

# Force test data dir
TEST_DIR = tempfile.mkdtemp(prefix="monitor_test_")
os.environ["CORTEX_DATA_DIR"] = TEST_DIR

from brain import UnifiedBrain
from helios_monitor import (
    collect_metrics,
    format_prometheus,
    write_metrics_json,
)


@pytest.fixture
def brain(tmp_path):
    return UnifiedBrain(str(tmp_path / "test.db"))


@pytest.fixture
def populated_brain(brain):
    """Brain with some data for meaningful metrics."""
    # Messages
    brain.send("helios", "nova", "Task 1", "Build feature A")
    brain.send("nova", "helios", "Done", "Feature A built")
    brain.send("helios", "claude", "Review", "Please review")

    # STM
    brain.remember("Trading pattern discovered", categories=["trading"])
    brain.remember("Bug found in pipeline", categories=["coding"])
    brain.remember("Important decision made", categories=["meta"], importance=2.5)

    # Atoms
    brain.create_atom("whale wallet", "accumulates", "concentration visible", "price moves")
    brain.create_atom("high volume", "signals", "breakout imminent", "enters position")

    # Task delegation
    brain.delegate_task("helios", "nova", "Deploy", "Deploy the thing")

    return brain


class TestCollectMetrics:
    def test_returns_dict_with_basic_keys(self, populated_brain):
        m = collect_metrics(str(populated_brain.db_path))
        assert "collected_at" in m
        assert "db_size_mb" in m
        assert "totals" in m
        assert "averages" in m
        assert "consolidation" in m

    def test_totals_match_actual_data(self, populated_brain):
        m = collect_metrics(str(populated_brain.db_path))
        # 3 regular messages + 1 delegate task message = 4
        assert m["totals"]["messages"] >= 3
        assert m["totals"]["stm"] >= 3
        assert m["totals"]["atoms"] >= 2

    def test_nonexistent_db_returns_error(self, tmp_path):
        m = collect_metrics(str(tmp_path / "nonexistent.db"))
        assert "error" in m

    def test_averages_computed(self, populated_brain):
        m = collect_metrics(str(populated_brain.db_path))
        avgs = m["averages"]
        assert "messages_per_day" in avgs
        assert "stm_per_day" in avgs
        assert "atoms_per_day" in avgs
        assert avgs["messages_per_day"] >= 0

    def test_task_stats_present(self, populated_brain):
        m = collect_metrics(str(populated_brain.db_path))
        assert m["tasks"]["total"] >= 1
        assert "pending" in m["tasks"]["by_status"]

    def test_embedding_coverage(self, populated_brain):
        m = collect_metrics(str(populated_brain.db_path))
        cov = m["embedding_coverage"]
        assert "stm" in cov
        assert "messages" in cov
        assert "atoms" in cov
        assert "coverage_pct" in cov["stm"]


class TestPrometheus:
    def test_format_produces_valid_text(self, populated_brain):
        m = collect_metrics(str(populated_brain.db_path))
        prom = format_prometheus(m)
        assert "helios_messages_total" in prom
        assert "helios_stm_total" in prom
        assert "helios_atoms_total" in prom
        assert "# TYPE" in prom


class TestWriteJSON:
    def test_writes_valid_json(self, populated_brain, tmp_path):
        output = str(tmp_path / "metrics.json")
        m = collect_metrics(str(populated_brain.db_path))
        write_metrics_json(m, output)
        assert Path(output).exists()
        loaded = json.loads(Path(output).read_text())
        assert loaded["totals"]["messages"] >= 3
