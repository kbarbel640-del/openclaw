#!/usr/bin/env python3
"""
test_brain_concurrent.py — Stress test for concurrent writes to brain.db

Tests WAL mode under realistic multi-writer scenarios:
1. Multiple threads writing STM simultaneously
2. Mixed reads + writes
3. SYNAPSE messages during bulk STM inserts
4. Atom creation during search queries
5. API + CLI + daemon simultaneous access

Uses a temp DB to avoid polluting production.
"""

import os
import sys
import time
import sqlite3
import tempfile
import threading
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Add brain.py to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brain import UnifiedBrain

TEMP_DIR = tempfile.mkdtemp(prefix="brain_concurrent_")
DB_PATH = os.path.join(TEMP_DIR, "brain.db")


def create_brain():
    """Each thread gets its own UnifiedBrain instance (separate connection)."""
    return UnifiedBrain(DB_PATH)


def test_concurrent_stm_writes(n_threads=10, writes_per_thread=50):
    """Test N threads writing STM entries simultaneously."""
    print(f"\n🔨 Test 1: {n_threads} threads × {writes_per_thread} writes = {n_threads * writes_per_thread} STM entries")
    
    errors = []
    timings = []
    
    def writer(thread_id):
        brain = create_brain()
        thread_times = []
        for i in range(writes_per_thread):
            start = time.monotonic()
            try:
                brain.remember(
                    f"Thread {thread_id} entry {i}: concurrent write test data with some padding to make it realistic",
                    importance=1.5,
                    categories=["test"]
                )
                thread_times.append(time.monotonic() - start)
            except Exception as e:
                errors.append((thread_id, i, str(e)))
        return thread_times
    
    start = time.monotonic()
    with ThreadPoolExecutor(max_workers=n_threads) as pool:
        futures = [pool.submit(writer, tid) for tid in range(n_threads)]
        for f in as_completed(futures):
            timings.extend(f.result())
    
    elapsed = time.monotonic() - start
    
    # Verify count
    brain = create_brain()
    stats = brain.stats()
    expected = n_threads * writes_per_thread
    actual = stats['stm_entries']
    
    print(f"  ✅ Completed in {elapsed:.2f}s ({expected/elapsed:.0f} writes/sec)")
    print(f"  📊 Latency: p50={statistics.median(timings)*1000:.1f}ms p95={sorted(timings)[int(len(timings)*0.95)]*1000:.1f}ms p99={sorted(timings)[int(len(timings)*0.99)]*1000:.1f}ms")
    print(f"  📈 Expected {expected} rows, got {actual} {'✅' if actual == expected else '❌ MISMATCH'}")
    print(f"  ❌ Errors: {len(errors)}" if errors else "  ✅ Zero errors")
    
    if errors:
        for tid, i, e in errors[:5]:
            print(f"    thread={tid} write={i}: {e}")
    
    return len(errors) == 0 and actual == expected


def test_mixed_read_write(n_threads=8, ops_per_thread=30):
    """Test mixed reads and writes from multiple threads."""
    print(f"\n🔨 Test 2: {n_threads} threads × {ops_per_thread} mixed ops")
    
    errors = []
    read_times = []
    write_times = []
    
    def mixed_worker(thread_id):
        brain = create_brain()
        for i in range(ops_per_thread):
            try:
                if i % 3 == 0:  # Write
                    start = time.monotonic()
                    brain.remember(f"Mixed test thread {thread_id} entry {i}", importance=1.0)
                    write_times.append(time.monotonic() - start)
                elif i % 3 == 1:  # FTS search
                    start = time.monotonic()
                    brain.unified_search(f"thread {thread_id}", limit=5, types=["stm"])
                    read_times.append(time.monotonic() - start)
                else:  # Get STM
                    start = time.monotonic()
                    brain.get_stm(limit=10)
                    read_times.append(time.monotonic() - start)
            except Exception as e:
                errors.append((thread_id, i, str(e)))
    
    start = time.monotonic()
    with ThreadPoolExecutor(max_workers=n_threads) as pool:
        futures = [pool.submit(mixed_worker, tid) for tid in range(n_threads)]
        for f in as_completed(futures):
            f.result()
    
    elapsed = time.monotonic() - start
    total_ops = n_threads * ops_per_thread
    
    print(f"  ✅ Completed in {elapsed:.2f}s ({total_ops/elapsed:.0f} ops/sec)")
    if write_times:
        print(f"  📝 Writes: p50={statistics.median(write_times)*1000:.1f}ms p95={sorted(write_times)[int(len(write_times)*0.95)]*1000:.1f}ms")
    if read_times:
        print(f"  📖 Reads:  p50={statistics.median(read_times)*1000:.1f}ms p95={sorted(read_times)[int(len(read_times)*0.95)]*1000:.1f}ms")
    print(f"  ❌ Errors: {len(errors)}" if errors else "  ✅ Zero errors")
    
    return len(errors) == 0


def test_synapse_during_bulk(n_messages=20, bulk_writes=200):
    """Send SYNAPSE messages while bulk STM writes happen."""
    print(f"\n🔨 Test 3: {n_messages} SYNAPSE messages during {bulk_writes} bulk STM writes")
    
    errors = []
    
    def bulk_writer():
        brain = create_brain()
        for i in range(bulk_writes):
            try:
                brain.remember(f"Bulk entry {i}: padding data for realism", importance=1.0)
            except Exception as e:
                errors.append(("bulk", i, str(e)))
    
    def message_sender():
        brain = create_brain()
        for i in range(n_messages):
            try:
                brain.send(
                    from_agent=f"test-{i % 3}",
                    to_agent="helios",
                    subject=f"Stress test {i}",
                    body=f"Test message {i} during bulk writes",
                    thread_id=f"stress-test-{i % 5}"
                )
                time.sleep(0.01)  # Slight stagger
            except Exception as e:
                errors.append(("msg", i, str(e)))
    
    start = time.monotonic()
    t1 = threading.Thread(target=bulk_writer)
    t2 = threading.Thread(target=message_sender)
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    elapsed = time.monotonic() - start
    
    # Verify
    brain = create_brain()
    stats = brain.stats()
    inbox = brain.inbox("helios")
    
    print(f"  ✅ Completed in {elapsed:.2f}s")
    print(f"  📊 STM: {stats['stm_entries']} | Messages: {stats['messages']} | Inbox: {len(inbox)}")
    print(f"  ❌ Errors: {len(errors)}" if errors else "  ✅ Zero errors")
    
    return len(errors) == 0


def test_atom_during_search(n_atoms=30, n_searches=50):
    """Create atoms while search queries run."""
    print(f"\n🔨 Test 4: {n_atoms} atom creates during {n_searches} concurrent searches")
    
    errors = []
    
    # Seed some data first
    brain = create_brain()
    for i in range(20):
        brain.remember(f"Seed data {i}: knowledge about trading patterns and market signals", importance=2.0)
    
    def atom_creator():
        brain = create_brain()
        for i in range(n_atoms):
            try:
                brain.create_atom(
                    subject=f"entity_{i}",
                    action=f"performs action {i}",
                    outcome=f"produces outcome {i}",
                    consequences=f"leads to consequence {i}",
                    confidence=0.8
                )
            except Exception as e:
                errors.append(("atom", i, str(e)))
    
    def searcher():
        brain = create_brain()
        for i in range(n_searches):
            try:
                brain.unified_search("trading patterns", limit=10)
            except Exception as e:
                errors.append(("search", i, str(e)))
    
    start = time.monotonic()
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(atom_creator),
            pool.submit(searcher),
            pool.submit(searcher),
            pool.submit(atom_creator),
        ]
        for f in as_completed(futures):
            f.result()
    
    elapsed = time.monotonic() - start
    
    brain = create_brain()
    stats = brain.stats()
    print(f"  ✅ Completed in {elapsed:.2f}s")
    print(f"  📊 Atoms: {stats['atoms']} | STM: {stats['stm_entries']}")
    print(f"  ❌ Errors: {len(errors)}" if errors else "  ✅ Zero errors")
    
    return len(errors) == 0


def test_wal_checkpoint():
    """Verify WAL mode is active and checkpoint works."""
    print(f"\n🔨 Test 5: WAL mode verification")
    
    brain = create_brain()
    
    # Check journal mode
    conn = sqlite3.connect(DB_PATH)
    mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    print(f"  Journal mode: {mode} {'✅' if mode == 'wal' else '❌'}")
    
    # Write some data to generate WAL
    for i in range(100):
        brain.remember(f"WAL test entry {i}", importance=1.0)
    
    # Check WAL file size
    wal_path = DB_PATH + "-wal"
    wal_exists = os.path.exists(wal_path)
    wal_size = os.path.getsize(wal_path) if wal_exists else 0
    print(f"  WAL file: {'exists' if wal_exists else 'missing'} ({wal_size/1024:.1f}KB)")
    
    # Force checkpoint
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    wal_size_after = os.path.getsize(wal_path) if os.path.exists(wal_path) else 0
    print(f"  After checkpoint: {wal_size_after/1024:.1f}KB {'✅' if wal_size_after < wal_size else '⚠️'}")
    
    conn.close()
    return mode == 'wal'


def test_high_contention(n_threads=20, duration_seconds=3):
    """Maximum contention: 20 threads hammering for 3 seconds."""
    print(f"\n🔨 Test 6: HIGH CONTENTION — {n_threads} threads for {duration_seconds}s")
    
    stop_event = threading.Event()
    counters = {"writes": 0, "reads": 0, "errors": 0}
    lock = threading.Lock()
    
    def hammer(thread_id):
        brain = create_brain()
        local_w = 0
        local_r = 0
        local_e = 0
        while not stop_event.is_set():
            try:
                if thread_id % 2 == 0:
                    brain.remember(f"Hammer {thread_id} t={time.time()}", importance=1.0)
                    local_w += 1
                else:
                    brain.get_stm(limit=5)
                    local_r += 1
            except Exception:
                local_e += 1
        with lock:
            counters["writes"] += local_w
            counters["reads"] += local_r
            counters["errors"] += local_e
    
    threads = [threading.Thread(target=hammer, args=(i,)) for i in range(n_threads)]
    start = time.monotonic()
    for t in threads:
        t.start()
    
    time.sleep(duration_seconds)
    stop_event.set()
    
    for t in threads:
        t.join(timeout=5)
    
    elapsed = time.monotonic() - start
    total = counters["writes"] + counters["reads"]
    
    print(f"  ✅ {total} ops in {elapsed:.2f}s ({total/elapsed:.0f} ops/sec)")
    print(f"  📝 Writes: {counters['writes']} | 📖 Reads: {counters['reads']}")
    print(f"  {'❌' if counters['errors'] else '✅'} Errors: {counters['errors']}")
    
    return counters["errors"] == 0


if __name__ == "__main__":
    print("=" * 60)
    print("brain.db CONCURRENT WRITE STRESS TEST")
    print(f"DB: {DB_PATH}")
    print("=" * 60)
    
    results = []
    
    results.append(("Concurrent STM writes", test_concurrent_stm_writes()))
    results.append(("WAL mode", test_wal_checkpoint()))
    results.append(("Mixed read/write", test_mixed_read_write()))
    results.append(("SYNAPSE during bulk", test_synapse_during_bulk()))
    results.append(("Atoms during search", test_atom_during_search()))
    results.append(("High contention", test_high_contention()))
    
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    all_pass = True
    for name, passed in results:
        icon = "✅" if passed else "❌"
        print(f"  {icon} {name}")
        if not passed:
            all_pass = False
    
    # Final DB stats
    brain = create_brain()
    stats = brain.stats()
    print(f"\n📊 Final DB: {stats['stm_entries']} STM | {stats['messages']} msgs | {stats['atoms']} atoms")
    print(f"   DB size: {os.path.getsize(DB_PATH)/1024/1024:.2f} MB")
    
    # Cleanup
    import shutil
    shutil.rmtree(TEMP_DIR)
    print(f"\n🧹 Cleaned up {TEMP_DIR}")
    
    print(f"\n{'✅ ALL TESTS PASSED' if all_pass else '❌ SOME TESTS FAILED'}")
    sys.exit(0 if all_pass else 1)
