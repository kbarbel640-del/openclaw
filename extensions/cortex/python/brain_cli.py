#!/usr/bin/env python3
"""
brain — CLI for the Unified Brain (SYNAPSE + Cortex).

Usage:
    brain stats
    brain search <query> [--types message,stm,atom] [--limit 20]
    brain stm [--limit 10] [--category <cat>]
    brain remember <content> [--categories cat1,cat2] [--importance 1.0]
    brain send --from <agent> --to <agent> --subject <subj> --body <body> [--thread <id>] [--priority info]
    brain inbox [--agent helios] [--include-read]
    brain history [--agent helios] [--thread <id>] [--limit 20]
    brain threads [--limit 50]
    brain atoms [--field outcome] [--query <q>]
    brain provenance <knowledge_id>
    brain export-synapse
"""
import argparse
import json
import os
import sys
from pathlib import Path

# Add brain.py directory to path
BRAIN_DIR = Path(__file__).resolve().parent.parent / "Projects/helios/extensions/cortex/python"
sys.path.insert(0, str(BRAIN_DIR))

# Set data dir
os.environ.setdefault("CORTEX_DATA_DIR", str(Path.home() / ".openclaw/workspace/memory"))

from brain import UnifiedBrain

DB_PATH = Path(os.environ["CORTEX_DATA_DIR"]) / "brain.db"


def _brain() -> UnifiedBrain:
    return UnifiedBrain(str(DB_PATH))


def _json_out(data, compact=False):
    if compact:
        print(json.dumps(data, default=str))
    else:
        print(json.dumps(data, indent=2, default=str))


def cmd_stats(args):
    b = _brain()
    s = b.stats()
    a = b.atom_stats()
    wm = b.wm_view()
    print(f"🧠 Unified Brain — {DB_PATH}")
    print(f"  Messages:    {s['messages']}")
    print(f"  Threads:     {s['threads']}")
    print(f"  STM:         {s['stm_entries']}")
    print(f"  Atoms:       {s['atoms']}")
    print(f"  Links:       {s['causal_links']}")
    print(f"  Embeddings:  {s['embeddings']} ({s.get('embeddings_by_type', {})})")
    print(f"  WM Pins:     {wm['count']}")
    print(f"  Avg Conf:    {a.get('avg_confidence', 0):.3f}")
    print(f"  DB Size:     {DB_PATH.stat().st_size / 1024 / 1024:.1f} MB")


def cmd_search(args):
    b = _brain()
    types = args.types.split(",") if args.types else None
    results = b.unified_search(args.query, limit=args.limit, types=types)
    if not results:
        print("No results found.")
        return
    for r in results:
        src = r["source_type"].upper()
        score = r.get("score", 0)
        match = r.get("match_type", "?")
        content = r.get("content", "")[:120].replace("\n", " ")
        print(f"  [{src}] ({match} {score:.2f}) {content}")
    print(f"\n{len(results)} results for \"{args.query}\"")


def cmd_stm(args):
    b = _brain()
    items = b.get_stm(limit=args.limit, category=args.category)
    if not items:
        print("STM is empty.")
        return
    for item in items:
        cats = item.get("categories", [])
        if isinstance(cats, str):
            try:
                cats = json.loads(cats)
            except Exception:
                pass
        imp = item.get("importance", 1.0)
        content = item.get("content", "")[:120].replace("\n", " ")
        print(f"  [{','.join(cats) if isinstance(cats, list) else cats}] (imp={imp}) {content}")
    print(f"\n{len(items)} STM entries")


def cmd_remember(args):
    b = _brain()
    cats = args.categories.split(",") if args.categories else ["general"]
    mem_id = b.remember(args.content, categories=cats, importance=args.importance)
    print(f"✅ Stored: {mem_id} (categories={cats}, importance={args.importance})")


def cmd_send(args):
    b = _brain()
    msg = b.send(
        from_agent=args.from_agent,
        to_agent=args.to_agent,
        subject=args.subject,
        body=args.body,
        priority=args.priority,
        thread_id=args.thread_id,
    )
    print(f"✉️  Sent: {msg['id']} (thread={msg['thread_id']})")
    print(f"   From: {msg['from']} → To: {msg['to']}")
    print(f"   Subject: {msg['subject']}")


def cmd_inbox(args):
    b = _brain()
    messages = b.inbox(args.agent, include_read=args.include_read)
    if not messages:
        print(f"📭 No {'unread ' if not args.include_read else ''}messages for {args.agent}")
        return
    for m in messages:
        pri = m.get("priority", "info")
        subj = m.get("subject", "(no subject)")
        frm = m.get("from_agent", "?")
        ts = m.get("created_at", "")[:19]
        print(f"  {'🔴' if pri == 'urgent' else '🟡' if pri == 'action' else '⚪'} [{frm}→{args.agent}] {subj} ({ts})")
        body_preview = m.get("body", "")[:100].replace("\n", " ")
        print(f"    {body_preview}")
    print(f"\n{len(messages)} messages")


def cmd_history(args):
    b = _brain()
    messages = b.history(agent_id=args.agent, thread_id=args.thread, limit=args.limit)
    if not messages:
        print("No messages found.")
        return
    for m in messages:
        frm = m.get("from_agent", "?")
        to = m.get("to_agent", "all")
        subj = m.get("subject", "")
        ts = m.get("created_at", "")[:19]
        body = m.get("body", "")[:200].replace("\n", " ")
        print(f"  [{ts}] {frm}→{to}: {subj}")
        print(f"    {body}")
        print()
    print(f"{len(messages)} messages")


def cmd_threads(args):
    b = _brain()
    threads = b.list_threads(limit=args.limit)
    if not threads:
        print("No threads.")
        return
    for t in threads:
        subj = t.get("subject", "(no subject)")
        creator = t.get("created_by", "?")
        count = t.get("message_count", 0)
        last = (t.get("last_message_at") or "")[:19]
        print(f"  {t['id']}: {subj} ({count} msgs, by {creator}, last: {last})")
    print(f"\n{len(threads)} threads")


def cmd_atoms(args):
    b = _brain()
    if args.query:
        results = b.search_atoms(args.field, args.query, limit=args.limit)
        for r in results:
            sim = r.get("similarity", 0)
            print(f"  ({sim:.3f}) [{r['subject']}] {r['action']} → {r['outcome']}")
            print(f"    ⇒ {r['consequences']}")
        print(f"\n{len(results)} atoms matching \"{args.query}\" on {args.field}")
    else:
        s = b.atom_stats()
        _json_out(s)


def cmd_provenance(args):
    b = _brain()
    result = b.find_provenance(args.knowledge_id)
    if result:
        print(f"Knowledge type: {result['knowledge_type']}")
        print(f"Content: {result['knowledge_content'][:200]}")
        msg = result.get("source_message")
        if msg:
            print(f"\nSource conversation:")
            print(f"  From: {msg.get('from_agent')} at {msg.get('created_at', '')[:19]}")
            print(f"  Subject: {msg.get('subject')}")
            print(f"  Body: {msg.get('body', '')[:300]}")
    else:
        print(f"No provenance found for {args.knowledge_id}")
        print("(Knowledge item may not have a source_message_id link)")


def cmd_recent(args):
    b = _brain()
    types = args.types.split(",") if args.types else None
    items = b.recent(hours=args.hours, types=types, limit=args.limit)
    if not items:
        print(f"Nothing in the last {args.hours} hours.")
        return
    for item in items:
        t = item.get("type", "?").upper()[:3]
        ts = item.get("created_at", "")[:19]
        summary = item.get("summary", "")
        content = item.get("content", "")[:100].replace("\n", " ")
        print(f"  [{t}] {ts} {summary}")
        print(f"       {content}")
    print(f"\n{len(items)} items in last {args.hours}h")


def cmd_test(args):
    """Comprehensive validation of brain.db."""
    b = _brain()
    import time
    passed = 0
    failed = 0

    def check(name, condition):
        nonlocal passed, failed
        if condition:
            print(f"  ✅ {name}")
            passed += 1
        else:
            print(f"  ❌ {name}")
            failed += 1

    print("🧪 brain.db validation suite\n")

    # 1. Stats
    s = b.stats()
    check("Stats returns data", s["stm_entries"] > 0)
    check("Messages exist", s["messages"] > 0)
    check("Atoms exist", s["atoms"] > 0)
    check("Embeddings exist", s["embeddings"] > 0)

    # 2. STM read/write
    mem_id = b.remember("brain test: validation entry", categories=["test"], importance=0.5)
    check("STM write returns ID", mem_id.startswith("stm_"))
    items = b.get_stm(limit=1, category="test")
    check("STM read finds test entry", len(items) > 0 and "validation" in items[0].get("content", ""))

    # 3. Auto-embed on write
    import sqlite3
    conn = sqlite3.connect(str(DB_PATH))
    row = conn.execute("SELECT count(*) FROM embeddings WHERE source_id = ?", (mem_id,)).fetchone()
    check("Auto-embed on remember()", row[0] > 0)

    # 4. FTS search
    results = b.unified_search("validation entry", limit=5)
    check("FTS5 unified search works", len(results) > 0)

    # 5. SYNAPSE send/inbox
    msg = b.send("helios", "test-agent", "Test subject", "Test body", priority="info")
    check("SYNAPSE send returns msg", msg.get("id", "").startswith("syn_"))
    inbox = b.inbox("test-agent")
    check("SYNAPSE inbox finds message", len(inbox) > 0)

    # 6. Auto-embed on send
    row = conn.execute("SELECT count(*) FROM embeddings WHERE source_id = ?", (msg["id"],)).fetchone()
    check("Auto-embed on send()", row[0] > 0)

    # 7. Provenance chain
    linked_mem = b.remember("Provenance test knowledge", source_message_id=msg["id"])
    chain = b.find_provenance(linked_mem)
    check("Provenance chain works", chain is not None and len(chain) >= 2)
    if chain:
        check("Provenance reaches message", any(c["type"] == "message" for c in chain))

    # 8. Atom stats
    a = b.atom_stats()
    check("Atom stats returns data", a["total_atoms"] > 0)

    # 9. Recent
    recent = b.recent(hours=1, limit=5)
    check("Recent query works", len(recent) > 0)

    # 10. Threads
    threads = b.list_threads()
    check("Thread listing works", len(threads) > 0)

    # Cleanup
    conn.execute("DELETE FROM stm WHERE id IN (?, ?)", (mem_id, linked_mem))
    conn.execute("DELETE FROM messages WHERE id = ?", (msg["id"],))
    conn.execute("DELETE FROM embeddings WHERE source_id IN (?, ?, ?)", (mem_id, msg["id"], linked_mem))
    conn.commit()
    conn.close()

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    if failed == 0:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed — check above")


def cmd_embed(args):
    b = _brain()
    n = b.embed_pending(batch_size=args.batch)
    print(f"Embedded {n} pending items")
    if n == 0:
        print("All items have embeddings ✅")


def cmd_export_synapse(args):
    b = _brain()
    data = b.export_synapse_json()
    _json_out(data)


def main():
    parser = argparse.ArgumentParser(description="Unified Brain CLI (SYNAPSE + Cortex)")
    sub = parser.add_subparsers(dest="command")

    # stats
    sub.add_parser("stats", help="Show brain statistics")

    # search
    p = sub.add_parser("search", help="Unified search across all knowledge")
    p.add_argument("query")
    p.add_argument("--types", default=None, help="Comma-separated: message,stm,atom")
    p.add_argument("--limit", type=int, default=20)

    # stm
    p = sub.add_parser("stm", help="View short-term memory")
    p.add_argument("--limit", type=int, default=10)
    p.add_argument("--category", default=None)

    # remember
    p = sub.add_parser("remember", help="Store a memory")
    p.add_argument("content")
    p.add_argument("--categories", default=None)
    p.add_argument("--importance", type=float, default=1.0)

    # send
    p = sub.add_parser("send", help="Send a SYNAPSE message")
    p.add_argument("--from", dest="from_agent", required=True)
    p.add_argument("--to", dest="to_agent", required=True)
    p.add_argument("--subject", required=True)
    p.add_argument("--body", required=True)
    p.add_argument("--thread", dest="thread_id", default=None)
    p.add_argument("--priority", default="info", choices=["info", "action", "urgent"])

    # inbox
    p = sub.add_parser("inbox", help="Check inbox")
    p.add_argument("--agent", default="helios")
    p.add_argument("--include-read", action="store_true")

    # history
    p = sub.add_parser("history", help="Message history")
    p.add_argument("--agent", default=None)
    p.add_argument("--thread", default=None)
    p.add_argument("--limit", type=int, default=20)

    # threads
    p = sub.add_parser("threads", help="List threads")
    p.add_argument("--limit", type=int, default=50)

    # atoms
    p = sub.add_parser("atoms", help="Search/stats for atoms")
    p.add_argument("--query", default=None)
    p.add_argument("--field", default="outcome", choices=["subject", "action", "outcome", "consequences"])
    p.add_argument("--limit", type=int, default=10)

    # provenance
    p = sub.add_parser("provenance", help="Find source conversation for knowledge")
    p.add_argument("knowledge_id")

    # recent
    p = sub.add_parser("recent", help="Recent items across all types")
    p.add_argument("--hours", type=int, default=24)
    p.add_argument("--types", default=None, help="Comma-separated: message,stm,atom")
    p.add_argument("--limit", type=int, default=20)

    # test
    sub.add_parser("test", help="Run comprehensive validation suite")

    # embed
    p = sub.add_parser("embed", help="Embed pending items (fills gaps)")
    p.add_argument("--batch", type=int, default=100, help="Batch size")

    # export
    sub.add_parser("export-synapse", help="Export messages as JSON (legacy compat)")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    cmd_map = {
        "stats": cmd_stats,
        "search": cmd_search,
        "stm": cmd_stm,
        "remember": cmd_remember,
        "send": cmd_send,
        "inbox": cmd_inbox,
        "history": cmd_history,
        "threads": cmd_threads,
        "atoms": cmd_atoms,
        "provenance": cmd_provenance,
        "recent": cmd_recent,
        "test": cmd_test,
        "embed": cmd_embed,
        "export-synapse": cmd_export_synapse,
    }

    func = cmd_map.get(args.command)
    if func:
        func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
