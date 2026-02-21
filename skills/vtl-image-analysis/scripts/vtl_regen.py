import sys
import os
import json
import math
import argparse
from pathlib import Path

def safe_eval(expr: str, ctx: dict) -> bool:
    # Very small, safe expression evaluator for triggers like:
    # "abs(delta_x) < 0.04 and abs(delta_y) < 0.04"
    allowed_names = {
        "abs": abs,
        "min": min,
        "max": max,
        "math": math,
        **{k: v for k, v in ctx.items() if isinstance(v, (int, float))}
    }
    code = compile(expr, "<trigger>", "eval")
    for name in code.co_names:
        if name not in allowed_names:
            raise ValueError(f"Disallowed name in trigger: {name}")
    return bool(eval(code, {"__builtins__": {}}, allowed_names))

def load_latest_metrics(metrics_path: Path) -> dict:
    # Accept JSON (single object) or JSONL (take last non-empty line)
    txt = metrics_path.read_text(encoding="utf-8").strip()
    if not txt:
        raise ValueError("Empty metrics file")
    if txt.lstrip().startswith("{") and txt.rstrip().endswith("}"):
        return json.loads(txt)
    # JSONL
    last = None
    for line in txt.splitlines():
        line = line.strip()
        if not line:
            continue
        last = json.loads(line)
    if last is None:
        raise ValueError("No JSON objects found in JSONL")
    # If JSONL includes {"file": ..., ...}, strip the "file" wrapper from context use
    return last

def load_operators(op_path: Path) -> dict:
    # Minimal YAML loader without requiring PyYAML in every environment.
    # The operators.yaml is simple enough that JSON is also accepted.
    data = None
    try:
        import yaml  # type: ignore
        data = yaml.safe_load(op_path.read_text(encoding="utf-8"))
    except Exception:
        # Fallback: try JSON
        data = json.loads(op_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "operators" not in data:
        raise ValueError("operators.yaml missing required 'operators' list")
    return data

def apply_patch(base_prompt: str, patch_lines: list[str]) -> str:
    # Append patch lines as constraints. Keep semantic content intact.
    # Avoid "AI voice" markers; just add directives.
    patch = " ".join([ln.strip() for ln in patch_lines if ln.strip()])
    if not patch:
        return base_prompt.strip()
    if base_prompt.strip().endswith((".", "!", "?")):
        return f"{base_prompt.strip()} {patch}"
    return f"{base_prompt.strip()}. {patch}"

def recommend(base_prompt: str, metrics: dict, ops: dict, max_alts: int = 2) -> dict:
    # Flatten metrics context
    ctx = metrics.copy()
    if "file" in ctx and isinstance(ctx["file"], str):
        # keep "file" but don't rely on it for triggers
        pass

    ordered = ops.get("selection_rules", {}).get("ordered_priority", [])
    operators = {op["id"]: op for op in ops.get("operators", []) if isinstance(op, dict) and "id" in op}

    applicable = []
    # Deterministic scan in priority order first, then remainder
    scan_order = []
    for oid in ordered:
        if oid in operators:
            scan_order.append(operators[oid])
    for op in ops.get("operators", []):
        if isinstance(op, dict) and op.get("id") in operators and op not in scan_order:
            scan_order.append(op)

    for op in scan_order:
        triggers = op.get("triggers", [])
        ok = True
        for trig in triggers:
            try:
                if not safe_eval(trig, ctx):
                    ok = False
                    break
            except Exception:
                ok = False
                break
        if ok:
            applicable.append(op)

    chosen = applicable[0] if applicable else None
    alts = applicable[1:1+max_alts] if applicable else []

    variants = []
    if chosen:
        variants.append({
            "id": chosen["id"],
            "label": chosen.get("label", chosen["id"]),
            "prompt": apply_patch(base_prompt, chosen.get("patch", [])),
        })
    for op in alts:
        variants.append({
            "id": op["id"],
            "label": op.get("label", op["id"]),
            "prompt": apply_patch(base_prompt, op.get("patch", [])),
        })

    # Always include baseline first
    out = {
        "baseline": {
            "id": "baseline",
            "label": "Baseline",
            "prompt": base_prompt.strip()
        },
        "variants": variants,
        "selected": variants[0] if variants else None,
        "inputs": {
            "metrics_source": metrics.get("file", None),
        }
    }
    return out

def main():
    ap = argparse.ArgumentParser(description="VTL-Probe (Lite) regeneration recommender: emits prompt variants based on probe metrics.")
    ap.add_argument("--prompt", required=True, help="Original semantic prompt. This tool appends geometric constraints; it does not rewrite the subject.")
    ap.add_argument("--metrics", required=True, help="Path to metrics JSON or JSONL (typically output of vtl_probe.py).")
    ap.add_argument("--operators", default=str(Path(__file__).resolve().parents[1] / "operators.yaml"), help="Path to operators.yaml")
    ap.add_argument("--out", default="prompts.json", help="Output prompts JSON file.")
    ap.add_argument("--max-alts", type=int, default=2, help="Max alternative operator variants to emit (in addition to selected).")
    args = ap.parse_args()

    metrics_path = Path(args.metrics)
    ops_path = Path(args.operators)

    metrics = load_latest_metrics(metrics_path)
    ops = load_operators(ops_path)

    rec = recommend(args.prompt, metrics, ops, max_alts=args.max_alts)

    out_path = Path(args.out)
    out_path.write_text(json.dumps(rec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(str(out_path))

if __name__ == "__main__":
    main()
