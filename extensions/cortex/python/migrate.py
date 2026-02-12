#!/usr/bin/env python3
"""
One-time migration: synapse.json + stm.json + .atoms.db + .embeddings.db → brain.db

Backs up all source files before migration. Verifies counts post-migration.

Usage:
    python3 extensions/cortex/python/migrate.py [--data-dir ~/.openclaw/workspace/memory]
"""
import json
import os
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Tuple

# Add script dir to path for brain import
SCRIPT_DIR = Path(__file__).parent.resolve()
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

DATA_DIR = Path(os.environ.get("CORTEX_DATA_DIR", "")).expanduser() if os.environ.get("CORTEX_DATA_DIR") else None

# Allow --data-dir CLI arg
for i, arg in enumerate(sys.argv):
    if arg == "--data-dir" and i + 1 < len(sys.argv):
        DATA_DIR = Path(sys.argv[i + 1]).expanduser()

if DATA_DIR is None:
    DATA_DIR = Path.home() / ".openclaw" / "workspace" / "memory"

# Set env for brain.py
os.environ["CORTEX_DATA_DIR"] = str(DATA_DIR)

from brain import UnifiedBrain

# Source files
SYNAPSE_JSON = DATA_DIR / "synapse.json"
STM_JSON = DATA_DIR / "stm.json"
ATOMS_DB = DATA_DIR / ".atoms.db"
EMBEDDINGS_DB = DATA_DIR / ".embeddings.db"
BRAIN_DB = DATA_DIR / "brain.db"
BACKUP_DIR = DATA_DIR / "pre_migration_backup"


def backup_sources():
    """Backup all source files before migration."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = BACKUP_DIR / ts

    if backup.exists():
        print(f"  Backup dir already exists: {backup}")
        return str(backup)

    backup.mkdir(parents=True)

    for src in [SYNAPSE_JSON, STM_JSON, ATOMS_DB, EMBEDDINGS_DB]:
        if src.exists():
            shutil.copy2(src, backup / src.name)
            print(f"  Backed up {src.name} ({src.stat().st_size:,} bytes)")

    return str(backup)


def count_sources() -> dict:
    """Count items in all source files."""
    counts = {}

    if SYNAPSE_JSON.exists():
        with open(SYNAPSE_JSON, "r") as f:
            data = json.load(f)
        counts["synapse_messages"] = len(data.get("messages", []))
    else:
        counts["synapse_messages"] = 0

    if STM_JSON.exists():
        with open(STM_JSON, "r") as f:
            data = json.load(f)
        counts["stm_entries"] = len(data.get("short_term_memory", []))
    else:
        counts["stm_entries"] = 0

    if ATOMS_DB.exists():
        conn = sqlite3.connect(str(ATOMS_DB))
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM atoms")
        counts["atoms"] = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM causal_links")
        counts["causal_links"] = c.fetchone()[0]
        conn.close()
    else:
        counts["atoms"] = 0
        counts["causal_links"] = 0

    if EMBEDDINGS_DB.exists():
        conn = sqlite3.connect(str(EMBEDDINGS_DB))
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM memories")
        counts["embeddings"] = c.fetchone()[0]
        conn.close()
    else:
        counts["embeddings"] = 0

    return counts


def migrate_synapse(brain: UnifiedBrain) -> int:
    """Import synapse.json messages into brain.db."""
    if not SYNAPSE_JSON.exists():
        print("  No synapse.json found, skipping")
        return 0

    with open(SYNAPSE_JSON, "r") as f:
        data = json.load(f)

    messages = data.get("messages", [])
    if not messages:
        return 0

    conn = sqlite3.connect(str(brain.db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    c = conn.cursor()

    # Collect threads first
    threads = {}
    for msg in messages:
        tid = msg.get("thread_id")
        if tid and tid not in threads:
            threads[tid] = {
                "id": tid,
                "subject": msg.get("subject"),
                "created_by": msg.get("from", "unknown"),
                "created_at": msg.get("timestamp", datetime.now().isoformat()),
                "last_message_at": msg.get("timestamp"),
                "message_count": 0,
                "status": "active",
            }
        if tid:
            threads[tid]["message_count"] += 1
            if msg.get("timestamp", "") > (threads[tid]["last_message_at"] or ""):
                threads[tid]["last_message_at"] = msg["timestamp"]

    # Insert threads
    for t in threads.values():
        c.execute(
            """INSERT OR IGNORE INTO threads (id, subject, created_by, created_at, last_message_at, message_count, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (t["id"], t["subject"], t["created_by"], t["created_at"],
             t["last_message_at"], t["message_count"], t["status"]),
        )

    # Insert messages
    count = 0
    for msg in messages:
        msg_id = msg.get("id", f"syn_migrated_{count}")
        thread_id = msg.get("thread_id", "thr_migrated_default")
        from_agent = msg.get("from", "unknown")
        to_agent = msg.get("to")
        priority = msg.get("priority", "info")
        subject = msg.get("subject")
        body = msg.get("body", "")
        created_at = msg.get("timestamp", datetime.now().isoformat())

        c.execute(
            """INSERT OR IGNORE INTO messages (id, thread_id, from_agent, to_agent,
                   priority, subject, body, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (msg_id, thread_id, from_agent, to_agent, priority, subject, body, created_at),
        )

        if c.rowcount > 0:
            # FTS sync
            rowid = c.lastrowid
            c.execute(
                "INSERT INTO messages_fts(rowid, subject, body) VALUES (?, ?, ?)",
                (rowid, subject or "", body),
            )

            # Read receipts
            for reader in msg.get("read_by", []):
                c.execute(
                    "INSERT OR IGNORE INTO read_receipts (message_id, agent_id, read_at) VALUES (?, ?, ?)",
                    (msg_id, reader, created_at),
                )

            # Ack
            status = msg.get("status", "unread")
            if status == "acknowledged":
                ack_body = msg.get("ack_body")
                # Use first reader as acker, or from_agent as fallback
                acker = msg.get("read_by", [to_agent])[0] if msg.get("read_by") else (to_agent or "unknown")
                c.execute(
                    "INSERT OR IGNORE INTO acks (message_id, agent_id, ack_body, acked_at) VALUES (?, ?, ?, ?)",
                    (msg_id, acker, ack_body, created_at),
                )

            count += 1

    conn.commit()
    conn.close()
    return count


def _sanitize_text(text: str) -> str:
    """Remove surrogate characters that SQLite/Python can't encode."""
    return text.encode("utf-8", errors="replace").decode("utf-8")


def migrate_stm(brain: UnifiedBrain) -> int:
    """Import stm.json entries into brain.db."""
    if not STM_JSON.exists():
        print("  No stm.json found, skipping")
        return 0

    with open(STM_JSON, "r", errors="surrogateescape") as f:
        raw = f.read()
    # Clean surrogates before JSON parse
    raw = raw.encode("utf-8", errors="replace").decode("utf-8")
    data = json.loads(raw)

    items = data.get("short_term_memory", [])
    if not items:
        return 0

    conn = sqlite3.connect(str(brain.db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    c = conn.cursor()

    count = 0
    for i, item in enumerate(items):
        content = _sanitize_text(item.get("content", ""))
        if not content:
            continue

        # Handle categories (old format has both 'category' and 'categories')
        cats = item.get("categories")
        if cats is None:
            cat = item.get("category", "general")
            cats = [cat] if isinstance(cat, str) else cat
        cats_json = json.dumps(cats) if isinstance(cats, list) else json.dumps([cats] if cats else ["general"])

        importance = item.get("importance", 1.0)
        access_count = item.get("access_count", 0)
        created_at = item.get("timestamp", datetime.now().isoformat())
        stm_id = f"stm_mig_{i:04d}"

        c.execute(
            """INSERT OR IGNORE INTO stm (id, content, categories, importance, access_count, created_at, source)
               VALUES (?, ?, ?, ?, ?, ?, 'migrated')""",
            (stm_id, content, cats_json, importance, access_count, created_at),
        )

        if c.rowcount > 0:
            rowid = c.lastrowid
            c.execute("INSERT INTO stm_fts(rowid, content) VALUES (?, ?)", (rowid, content))
            count += 1

    conn.commit()
    conn.close()
    return count


def migrate_atoms(brain: UnifiedBrain) -> Tuple[int, int]:
    """Import .atoms.db atoms and causal_links into brain.db."""
    if not ATOMS_DB.exists():
        print("  No .atoms.db found, skipping")
        return 0, 0

    src = sqlite3.connect(str(ATOMS_DB))
    src_c = src.cursor()

    dst = sqlite3.connect(str(brain.db_path))
    dst.execute("PRAGMA journal_mode=WAL")
    dst_c = dst.cursor()

    # Migrate atoms
    src_c.execute("""
        SELECT id, subject, action, outcome, consequences,
               subject_embedding, action_embedding, outcome_embedding, consequences_embedding,
               confidence, access_count, created_at, source, source_memory_id
        FROM atoms
    """)

    atom_count = 0
    for row in src_c.fetchall():
        (aid, subj, act, out, cons,
         subj_emb, act_emb, out_emb, cons_emb,
         conf, acc, created, source, src_mem_id) = row

        dst_c.execute(
            """INSERT OR IGNORE INTO atoms (id, subject, action, outcome, consequences,
                   confidence, source, created_at, access_count,
                   subject_embedding, action_embedding, outcome_embedding, consequences_embedding)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (aid, subj, act, out, cons,
             conf or 1.0, source or "migrated", created or datetime.now().isoformat(), acc or 0,
             subj_emb, act_emb, out_emb, cons_emb),
        )

        if dst_c.rowcount > 0:
            rowid = dst_c.lastrowid
            dst_c.execute(
                "INSERT INTO atoms_fts(rowid, subject, action, outcome, consequences) VALUES (?, ?, ?, ?, ?)",
                (rowid, subj, act, out, cons),
            )
            atom_count += 1

    # Migrate causal links
    src_c.execute("SELECT from_atom_id, to_atom_id, link_type, strength, observation_count, last_observed FROM causal_links")

    link_count = 0
    for row in src_c.fetchall():
        from_id, to_id, link_type, strength, obs_count, last_obs = row
        dst_c.execute(
            """INSERT OR IGNORE INTO atom_links (from_atom_id, to_atom_id, link_type, strength,
                   observation_count, last_observed, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (from_id, to_id, link_type or "causes", strength or 0.5,
             obs_count or 1, last_obs, last_obs or datetime.now().isoformat()),
        )
        if dst_c.rowcount > 0:
            link_count += 1

    dst.commit()
    src.close()
    dst.close()
    return atom_count, link_count


def migrate_embeddings(brain: UnifiedBrain) -> int:
    """Import .embeddings.db memories into brain.db embeddings table (as STM-sourced content)."""
    if not EMBEDDINGS_DB.exists():
        print("  No .embeddings.db found, skipping")
        return 0

    src = sqlite3.connect(str(EMBEDDINGS_DB))
    src_c = src.cursor()

    dst = sqlite3.connect(str(brain.db_path))
    dst.execute("PRAGMA journal_mode=WAL")
    dst_c = dst.cursor()

    # The old embeddings DB has: id, content, source, category, timestamp, importance, access_count, embedding_text
    # We store these in the stm table (they're memories) with source='embeddings_db'
    # Note: these overlap with STM entries but have different IDs and possibly different content
    src_c.execute("SELECT id, content, source, category, timestamp, importance, access_count FROM memories")

    count = 0
    for row in src_c.fetchall():
        emb_id, content, source, category, timestamp, importance, access_count = row
        if not content:
            continue

        # Parse category (might be JSON array or plain string)
        cats = ["general"]
        if category:
            try:
                parsed = json.loads(category)
                if isinstance(parsed, list):
                    cats = parsed
                else:
                    cats = [str(parsed)]
            except (json.JSONDecodeError, TypeError):
                cats = [category]

        cats_json = json.dumps(cats)

        # Use a prefixed ID to avoid collision with STM entries
        dst_id = f"emb_{emb_id}"

        dst_c.execute(
            """INSERT OR IGNORE INTO stm (id, content, categories, importance, access_count,
                   created_at, source)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (dst_id, content, cats_json, importance or 1.0, access_count or 0,
             timestamp or datetime.now().isoformat(), f"migrated:{source or 'unknown'}"),
        )

        if dst_c.rowcount > 0:
            rowid = dst_c.lastrowid
            dst_c.execute("INSERT INTO stm_fts(rowid, content) VALUES (?, ?)", (rowid, content))
            count += 1

    dst.commit()
    src.close()
    dst.close()
    return count


def verify(brain: UnifiedBrain, source_counts: dict) -> bool:
    """Verify migration counts."""
    conn = sqlite3.connect(str(brain.db_path))
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM messages")
    msg_count = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM stm")
    stm_count = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM atoms")
    atom_count = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM atom_links")
    link_count = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM threads")
    thread_count = c.fetchone()[0]

    conn.close()

    expected_stm = source_counts["stm_entries"] + source_counts["embeddings"]

    print("\n=== Migration Verification ===")
    print(f"  Messages:     {msg_count:>6} (expected {source_counts['synapse_messages']})")
    print(f"  Threads:      {thread_count:>6}")
    print(f"  STM entries:  {stm_count:>6} (expected ~{expected_stm} = {source_counts['stm_entries']} STM + {source_counts['embeddings']} embeddings)")
    print(f"  Atoms:        {atom_count:>6} (expected {source_counts['atoms']})")
    print(f"  Causal links: {link_count:>6} (expected {source_counts['causal_links']})")

    ok = True
    if msg_count < source_counts["synapse_messages"]:
        print(f"  WARNING: Messages count mismatch!")
        ok = False
    if atom_count < source_counts["atoms"]:
        print(f"  WARNING: Atoms count mismatch!")
        ok = False
    if link_count < source_counts["causal_links"]:
        print(f"  WARNING: Links count mismatch!")
        ok = False

    if ok:
        print("\n  All counts match or exceed source data.")
    return ok


def main():
    print(f"=== UnifiedBrain Migration ===")
    print(f"Data dir: {DATA_DIR}")
    print(f"Brain DB: {BRAIN_DB}")
    print()

    if BRAIN_DB.exists():
        print(f"WARNING: brain.db already exists at {BRAIN_DB}")
        print("To re-run migration, delete or rename the existing brain.db first.")
        print("Aborting.")
        sys.exit(1)

    # Count sources
    print("Counting source data...")
    source_counts = count_sources()
    for k, v in source_counts.items():
        print(f"  {k}: {v}")
    print()

    # Backup
    print("Backing up source files...")
    backup_path = backup_sources()
    print(f"  Backup at: {backup_path}")
    print()

    # Initialize brain
    print("Initializing brain.db schema...")
    brain = UnifiedBrain(str(BRAIN_DB))
    print("  Schema created.")
    print()

    # Migrate
    print("Migrating SYNAPSE messages...")
    msg_count = migrate_synapse(brain)
    print(f"  Migrated {msg_count} messages")

    print("Migrating STM entries...")
    stm_count = migrate_stm(brain)
    print(f"  Migrated {stm_count} STM entries")

    print("Migrating atoms + causal links...")
    atom_count, link_count = migrate_atoms(brain)
    print(f"  Migrated {atom_count} atoms, {link_count} causal links")

    print("Migrating embeddings DB memories...")
    emb_count = migrate_embeddings(brain)
    print(f"  Migrated {emb_count} embedding memories → STM")

    # Verify
    ok = verify(brain, source_counts)

    # Final stats
    print()
    stats = brain.stats()
    print("=== brain.db Stats ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")

    db_size = BRAIN_DB.stat().st_size
    print(f"\n  Database size: {db_size:,} bytes ({db_size / 1024 / 1024:.1f} MB)")

    if ok:
        print("\nMigration complete. brain.db is ready.")
    else:
        print("\nMigration completed with warnings. Check counts above.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
