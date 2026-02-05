#!/usr/bin/env python3
"""Heartbeat state cache and notification throttle."""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import fcntl
except Exception:  # pragma: no cover
    fcntl = None

TPE = timezone(timedelta(hours=8))
STATE_PATH = Path(os.environ.get("HEARTBEAT_STATE", "~/clawd/memory/heartbeat-state.json")).expanduser()

DEFAULT_LAST_CHECKS = {
    "email": None,
    "calendar": None,
    "weather": None,
    "telegram": None,
    "pipelines": None,
    "sessions": None,
}


def _now():
    return datetime.now(TPE)


def _iso(dt):
    return dt.isoformat()


def _parse(ts):
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TPE)
        return dt
    except Exception:
        return None


def _default_state():
    return {
        "meta": {"version": 2, "updated_at": _iso(_now())},
        "tasks": {},
        "events": {"fingerprints": {}},
        "lastSummary": None,
        "lastChecks": DEFAULT_LAST_CHECKS.copy(),
    }


def _load_state(f):
    f.seek(0)
    raw = f.read().strip()
    if not raw:
        return _default_state()
    try:
        data = json.loads(raw)
    except Exception:
        return _default_state()
    # Backfill keys
    data.setdefault("meta", {"version": 2, "updated_at": _iso(_now())})
    data.setdefault("tasks", {})
    data.setdefault("events", {"fingerprints": {}})
    data.setdefault("lastSummary", None)
    data.setdefault("lastChecks", DEFAULT_LAST_CHECKS.copy())
    return data


def _save_state(f, state):
    state.setdefault("meta", {})
    state["meta"]["updated_at"] = _iso(_now())
    f.seek(0)
    f.truncate()
    f.write(json.dumps(state, ensure_ascii=False, indent=2))
    f.write("\n")
    f.flush()


def _with_lock(fn):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_PATH, "a+") as f:
        if fcntl:
            fcntl.flock(f, fcntl.LOCK_EX)
        try:
            return fn(f)
        finally:
            if fcntl:
                fcntl.flock(f, fcntl.LOCK_UN)


def should_run(task, min_interval_sec):
    def _inner(f):
        state = _load_state(f)
        info = state["tasks"].get(task, {})
        last = _parse(info.get("last_run"))
        now = _now()
        if last and (now - last).total_seconds() < min_interval_sec:
            _save_state(f, state)
            return False
        info.setdefault("fail_count", 0)
        info["last_run"] = _iso(now)
        state["tasks"][task] = info
        _save_state(f, state)
        return True
    return _with_lock(_inner)


def record(task, ok, error=None, duration_ms=None):
    def _inner(f):
        state = _load_state(f)
        info = state["tasks"].get(task, {})
        now = _now()
        info["last_run"] = _iso(now)
        if ok:
            info["last_ok"] = _iso(now)
            info["last_error"] = None
        else:
            info["last_fail"] = _iso(now)
            info["last_error"] = error or "unknown"
            info["fail_count"] = int(info.get("fail_count", 0)) + 1
        if duration_ms is not None:
            info["last_duration_ms"] = int(duration_ms)
        state["tasks"][task] = info
        _save_state(f, state)
    _with_lock(_inner)


def should_notify(fingerprint, cooldown_sec):
    def _inner(f):
        state = _load_state(f)
        events = state["events"].setdefault("fingerprints", {})
        info = events.get(fingerprint, {})
        last = _parse(info.get("last_notified"))
        now = _now()
        if last and (now - last).total_seconds() < cooldown_sec:
            _save_state(f, state)
            return False
        info["last_notified"] = _iso(now)
        info["count"] = int(info.get("count", 0)) + 1
        events[fingerprint] = info
        state["events"]["fingerprints"] = events
        _save_state(f, state)
        return True
    return _with_lock(_inner)


def record_notify(fingerprint, note=None):
    def _inner(f):
        state = _load_state(f)
        events = state["events"].setdefault("fingerprints", {})
        info = events.get(fingerprint, {})
        info["last_notified"] = _iso(_now())
        info["count"] = int(info.get("count", 0)) + 1
        if note:
            info["note"] = note
        events[fingerprint] = info
        state["events"]["fingerprints"] = events
        _save_state(f, state)
    _with_lock(_inner)


def usage():
    print("""Usage:
  heartbeat_state.py should-run <task> <min_interval_sec>
  heartbeat_state.py record <task> <ok|fail> [--error msg] [--duration ms]
  heartbeat_state.py should-notify <fingerprint> <cooldown_sec>
  heartbeat_state.py record-notify <fingerprint> [--note msg]
""")


def main(argv):
    if len(argv) < 2:
        usage()
        return 2
    cmd = argv[1]
    if cmd == "should-run" and len(argv) >= 4:
        task = argv[2]
        try:
            interval = int(argv[3])
        except ValueError:
            print("min_interval_sec must be int")
            return 2
        ok = should_run(task, interval)
        print("run" if ok else "skip")
        return 0 if ok else 1
    if cmd == "record" and len(argv) >= 4:
        task = argv[2]
        ok = argv[3] == "ok"
        error = None
        duration = None
        i = 4
        while i < len(argv):
            if argv[i] == "--error" and i + 1 < len(argv):
                error = argv[i + 1]
                i += 2
                continue
            if argv[i] == "--duration" and i + 1 < len(argv):
                duration = argv[i + 1]
                i += 2
                continue
            i += 1
        record(task, ok, error=error, duration_ms=duration)
        return 0
    if cmd == "should-notify" and len(argv) >= 4:
        fp = argv[2]
        try:
            cooldown = int(argv[3])
        except ValueError:
            print("cooldown_sec must be int")
            return 2
        ok = should_notify(fp, cooldown)
        print("notify" if ok else "skip")
        return 0 if ok else 1
    if cmd == "record-notify" and len(argv) >= 3:
        fp = argv[2]
        note = None
        if "--note" in argv:
            idx = argv.index("--note")
            if idx + 1 < len(argv):
                note = argv[idx + 1]
        record_notify(fp, note=note)
        return 0
    usage()
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
