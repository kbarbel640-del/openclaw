#!/usr/bin/env python3
"""
Analytics module for Liam's Dashboard.
Uses STUMPY for time series pattern detection.
"""

import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd
import stumpy

DB_PATH = Path('/home/liam/clawd/dashboard/dashboard.db')

def get_db():
    """Get database connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def detect_anomalies(metric='cpu_percent', window_size=12, top_n=5):
    """
    Detect anomalies in a metric using STUMPY matrix profile.

    Args:
        metric: Column name (cpu_percent, mem_percent, disk_percent)
        window_size: Subsequence length for pattern matching
        top_n: Number of anomalies to return

    Returns:
        List of anomaly records with timestamp and value
    """
    conn = get_db()
    df = pd.read_sql(
        f'SELECT timestamp, {metric} FROM metrics ORDER BY timestamp',
        conn,
        parse_dates=['timestamp']
    )
    conn.close()

    if len(df) < window_size * 2:
        return []  # Not enough data

    # Compute matrix profile
    mp = stumpy.stump(df[metric].values, m=window_size)

    # Find top N discords (anomalies = highest matrix profile values)
    discord_indices = np.argsort(mp[:, 0])[-top_n:]

    return df.iloc[discord_indices][['timestamp', metric]].to_dict('records')

def find_patterns(metric='cpu_percent', window_size=12, max_motifs=3):
    """
    Find recurring patterns (motifs) in a metric.

    Args:
        metric: Column name
        window_size: Pattern length
        max_motifs: Number of patterns to find

    Returns:
        List of pattern info with indices and values
    """
    conn = get_db()
    df = pd.read_sql(
        f'SELECT timestamp, {metric} FROM metrics ORDER BY timestamp',
        conn,
        parse_dates=['timestamp']
    )
    conn.close()

    if len(df) < window_size * 2:
        return []

    # Compute matrix profile
    mp = stumpy.stump(df[metric].values, m=window_size)

    # Find motifs (recurring patterns = lowest matrix profile values)
    try:
        motif_indices = stumpy.motifs(df[metric].values, mp[:, 0], max_motifs=max_motifs)
        return [
            {
                'pattern_index': int(idx[0]),
                'timestamp': str(df.iloc[int(idx[0])]['timestamp']),
                'value': float(df.iloc[int(idx[0])][metric])
            }
            for idx in motif_indices[1] if len(idx) > 0
        ]
    except Exception:
        return []

def calculate_correlations(days=7):
    """
    Calculate correlations between metrics.

    Args:
        days: Number of days to analyze

    Returns:
        Correlation matrix as dict
    """
    conn = get_db()
    df = pd.read_sql(f'''
        SELECT cpu_percent, mem_percent, active_sessions
        FROM metrics
        WHERE timestamp > datetime('now', '-{days} days')
    ''', conn)
    conn.close()

    if len(df) < 10:
        return {}

    corr = df.corr()
    return corr.round(2).to_dict()

def get_hourly_averages(metric='cpu_percent', days=7):
    """
    Get average metric value by hour of day.

    Args:
        metric: Column name
        days: Number of days to analyze

    Returns:
        List of {hour, avg_value}
    """
    conn = get_db()
    rows = conn.execute(f'''
        SELECT
            strftime('%H', timestamp) as hour,
            AVG({metric}) as avg_value
        FROM metrics
        WHERE timestamp > datetime('now', '-{days} days')
        GROUP BY hour
        ORDER BY hour
    ''').fetchall()
    conn.close()

    return [{'hour': r['hour'], 'avg_value': round(r['avg_value'], 1)} for r in rows]

# === CLI for testing ===
if __name__ == '__main__':
    print("=== Anomaly Detection ===")
    anomalies = detect_anomalies('cpu_percent', window_size=12, top_n=3)
    for a in anomalies:
        print(f"  {a['timestamp']}: {a['cpu_percent']}%")

    print("\n=== Pattern Detection ===")
    patterns = find_patterns('cpu_percent', window_size=12, max_motifs=2)
    for p in patterns:
        print(f"  Pattern at {p['timestamp']}: {p['value']}%")

    print("\n=== Correlations ===")
    corr = calculate_correlations(7)
    print(f"  {corr}")

    print("\n=== Hourly Averages ===")
    hourly = get_hourly_averages('cpu_percent', 7)
    for h in hourly[:5]:
        print(f"  {h['hour']}:00 - {h['avg_value']}%")
