#!/usr/bin/env python3
"""
Embeddings Manager — brain.db backend

Thin wrapper around UnifiedBrain for backward-compatible embeddings operations.
All reads/writes go to brain.db unified store.

The original .embeddings.db is superseded; this module provides the same API
for cortex-bridge.ts callers.
"""
import json
import hashlib
import os
from datetime import datetime, timedelta
from pathlib import Path

# Data directory
DATA_DIR = Path(os.environ.get("CORTEX_DATA_DIR", Path(__file__).parent))

from brain import UnifiedBrain

_brain = None

def _get_brain() -> UnifiedBrain:
    global _brain
    if _brain is None:
        _brain = UnifiedBrain()  # Uses brain.py's default path (~/.openclaw/workspace/memory/brain.db)
    return _brain


def init_db():
    """No-op — brain.db schema is managed by UnifiedBrain.__init__."""
    _get_brain()  # Ensures schema exists


def memory_id(content, timestamp):
    """Generate deterministic ID for a memory."""
    return hashlib.sha256(f"{content}{timestamp}".encode()).hexdigest()[:16]


def add_memory(content, source="manual", category=None, categories=None, importance=1.0, timestamp=None):
    """Add a memory to brain.db STM."""
    b = _get_brain()

    # Normalize categories
    if categories is not None:
        cats = categories if isinstance(categories, list) else [categories]
    elif category is not None:
        cats = [category] if isinstance(category, str) else [category]
    else:
        cats = ["general"]

    mem_id = b.remember(content, categories=cats, importance=importance, source=source)
    return mem_id


def search_memories(query, limit=10, temporal_weight=0.7, date_range=None, category=None):
    """Search memories with temporal weighting.

    Uses brain.db unified_search (FTS5 + semantic) with temporal reranking.
    """
    b = _get_brain()

    # Use unified search for combined FTS5 + semantic
    types = ["stm"]  # embeddings_manager historically searched STM/collections
    raw_results = b.unified_search(query or "", limit=limit * 3, types=types)

    # Also do direct STM query for broader results
    if category:
        stm_items = b.get_stm(limit=limit * 3, category=category)
    else:
        stm_items = b.get_stm(limit=limit * 3)

    # Merge: use unified search results + filter STM by text match
    seen_ids = {r.get("id") for r in raw_results}
    
    if query:
        query_lower = query.lower()
        for item in stm_items:
            if item.get("id") not in seen_ids:
                content = item.get("content", "")
                if query_lower in content.lower():
                    raw_results.append({
                        "source_type": "stm",
                        "id": item["id"],
                        "content": content,
                        "created_at": item.get("created_at", ""),
                        "score": 0.5,
                        "match_type": "text",
                    })
                    seen_ids.add(item["id"])

    # Score with temporal weighting
    now = datetime.now()
    scored = []

    for r in raw_results:
        content = r.get("content", "")
        timestamp = r.get("created_at", now.isoformat())

        # Parse timestamp
        try:
            ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            if ts.tzinfo is not None:
                ts = ts.replace(tzinfo=None)
        except (ValueError, AttributeError):
            ts = now

        # Date range filter
        if date_range:
            if isinstance(date_range, str):
                if date_range == "today":
                    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                    if ts < start:
                        continue
                elif date_range == "yesterday":
                    start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                    end = now.replace(hour=0, minute=0, second=0, microsecond=0)
                    if ts < start or ts >= end:
                        continue
                elif date_range == "last_week":
                    if ts < now - timedelta(days=7):
                        continue
                elif date_range == "last_month":
                    if ts < now - timedelta(days=30):
                        continue
            elif isinstance(date_range, (tuple, list)):
                start_str, end_str = date_range
                if ts.isoformat() < start_str or ts.isoformat() > end_str:
                    continue

        # Category filter
        if category:
            item_cats = r.get("categories", [])
            if isinstance(item_cats, str):
                try:
                    item_cats = json.loads(item_cats)
                except Exception:
                    item_cats = [item_cats]
            if category not in item_cats:
                continue

        # Recency score
        days_ago = max((now - ts).days + 1, 1)
        recency_score = 1.0 / days_ago

        # Semantic score from unified search
        semantic_score = r.get("score", 0.5)

        # Combined
        final_score = (semantic_score * (1 - temporal_weight)) + (recency_score * temporal_weight)

        scored.append({
            "id": r.get("id", ""),
            "content": content[:500],
            "source": r.get("source_type", "stm"),
            "category": category,
            "timestamp": timestamp,
            "importance": r.get("importance", 1.0),
            "access_count": 0,
            "score": final_score,
            "recency_score": recency_score,
            "semantic_score": semantic_score,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def sync_from_collections():
    """No-op — brain.db is the unified store."""
    return 0


def sync_from_stm():
    """No-op — STM already lives in brain.db."""
    return 0


def stats():
    """Get database statistics from brain.db."""
    b = _get_brain()
    s = b.stats()
    return {
        "total": s.get("stm_entries", 0) + s.get("messages", 0),
        "by_category": {},  # Would need a GROUP BY query
        "by_source": {},
        "model": "all-MiniLM-L6-v2",
        "backend": "brain.db",
    }


if __name__ == "__main__":
    print("Initializing brain.db backend...")
    init_db()

    s = stats()
    print(f"Total memories: {s['total']}")
    print(f"Backend: {s['backend']}")

    print("\nTesting search...")
    results = search_memories("trading", limit=5)
    print(f"Found {len(results)} results for 'trading':")
    for r in results:
        print(f"  [{r['score']:.3f}] {r['content'][:60]}...")
