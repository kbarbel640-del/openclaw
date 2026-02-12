#!/usr/bin/env python3
"""
Provenance Visualization — generates an HTML chain diagram for any knowledge item.

Usage:
    python provenance_viz.py <knowledge_id>              # specific atom/stm/message
    python provenance_viz.py --auto                      # pick first atom with provenance
    python provenance_viz.py --all                       # visualize all atoms with provenance

Output: /tmp/provenance.html
"""
import argparse
import html
import sqlite3
import sys
from pathlib import Path

# Allow importing brain.py from same directory
sys.path.insert(0, str(Path(__file__).parent))
from brain import UnifiedBrain


# ---------------------------------------------------------------------------
# HTML Template
# ---------------------------------------------------------------------------

_TYPE_STYLES = {
    "atom": {"bg": "#1a1a2e", "border": "#e94560", "icon": "\u269b", "label": "Atom"},
    "stm": {"bg": "#1a1a2e", "border": "#0f3460", "icon": "\U0001f9e0", "label": "STM"},
    "message": {"bg": "#1a1a2e", "border": "#16213e", "icon": "\u2709", "label": "Message"},
}


def _escape(text: str) -> str:
    return html.escape(text or "", quote=True)


def _render_node(item: dict, index: int, total: int) -> str:
    """Render a single provenance node as HTML."""
    style = _TYPE_STYLES.get(item["type"], _TYPE_STYLES["message"])
    is_root = index == total - 1
    content = _escape(item["content"])
    item_id = _escape(item["id"])

    node_html = f"""
    <div class="node" style="border-left: 4px solid {style['border']};">
      <div class="node-header">
        <span class="node-icon">{style['icon']}</span>
        <span class="node-type" style="color: {style['border']};">{style['label']}</span>
        <span class="node-id">{item_id}</span>
        {"<span class='root-badge'>ROOT</span>" if is_root else ""}
      </div>
      <div class="node-content">{content}</div>
    </div>
    """

    if index < total - 1:
        node_html += """
    <div class="arrow">
      <div class="arrow-line"></div>
      <div class="arrow-label">derived from</div>
      <div class="arrow-head">\u25bc</div>
    </div>
    """

    return node_html


def _render_chain(chain: list, knowledge_id: str) -> str:
    """Render a full provenance chain as HTML."""
    nodes_html = ""
    for i, item in enumerate(chain):
        nodes_html += _render_node(item, i, len(chain))

    return f"""
    <div class="chain" id="chain-{_escape(knowledge_id)}">
      <h2 class="chain-title">
        Provenance: <code>{_escape(knowledge_id)}</code>
        <span class="chain-depth">{len(chain)} hop{"s" if len(chain) != 1 else ""}</span>
      </h2>
      {nodes_html}
    </div>
    """


def generate_html(chains: dict[str, list]) -> str:
    """Generate the full HTML page with all provenance chains."""
    chains_html = ""
    for kid, chain in chains.items():
        if chain:
            chains_html += _render_chain(chain, kid)
        else:
            chains_html += f"""
            <div class="chain error">
              <h2 class="chain-title">
                <code>{_escape(kid)}</code> — no provenance found
              </h2>
            </div>
            """

    total_chains = len(chains)
    total_hops = sum(len(c) for c in chains.values() if c)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Provenance Visualization — UnifiedBrain</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}

  body {{
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0d1117;
    color: #c9d1d9;
    padding: 2rem;
    line-height: 1.6;
  }}

  header {{
    text-align: center;
    margin-bottom: 2.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #21262d;
  }}

  h1 {{
    font-size: 1.8rem;
    color: #f0f6fc;
    margin-bottom: 0.5rem;
  }}

  .subtitle {{
    color: #8b949e;
    font-size: 0.9rem;
  }}

  .stats {{
    display: flex;
    gap: 2rem;
    justify-content: center;
    margin-top: 1rem;
  }}

  .stat {{
    background: #161b22;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    font-size: 0.85rem;
  }}

  .stat strong {{
    color: #58a6ff;
  }}

  .chain {{
    max-width: 720px;
    margin: 0 auto 3rem;
    background: #161b22;
    border-radius: 12px;
    padding: 1.5rem 2rem;
    border: 1px solid #21262d;
  }}

  .chain.error {{
    border-color: #f85149;
    opacity: 0.7;
  }}

  .chain-title {{
    font-size: 1.1rem;
    color: #f0f6fc;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }}

  .chain-title code {{
    background: #0d1117;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    color: #79c0ff;
  }}

  .chain-depth {{
    background: #21262d;
    padding: 0.15rem 0.6rem;
    border-radius: 12px;
    font-size: 0.75rem;
    color: #8b949e;
    font-weight: normal;
  }}

  .node {{
    background: #0d1117;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    margin: 0 0.5rem;
    transition: transform 0.15s ease;
  }}

  .node:hover {{
    transform: translateX(4px);
  }}

  .node-header {{
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }}

  .node-icon {{
    font-size: 1.2rem;
  }}

  .node-type {{
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }}

  .node-id {{
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.75rem;
    color: #484f58;
    margin-left: auto;
  }}

  .root-badge {{
    background: #238636;
    color: #fff;
    padding: 0.1rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
  }}

  .node-content {{
    color: #b1bac4;
    font-size: 0.9rem;
    word-break: break-word;
  }}

  .arrow {{
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 0;
  }}

  .arrow-line {{
    width: 2px;
    height: 16px;
    background: #30363d;
  }}

  .arrow-label {{
    font-size: 0.7rem;
    color: #484f58;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.15rem 0;
  }}

  .arrow-head {{
    color: #30363d;
    font-size: 0.8rem;
    line-height: 1;
  }}

  @media (max-width: 600px) {{
    body {{ padding: 1rem; }}
    .chain {{ padding: 1rem; }}
    .stats {{ flex-direction: column; gap: 0.5rem; }}
  }}
</style>
</head>
<body>
  <header>
    <h1>\u269b Provenance Visualization</h1>
    <p class="subtitle">UnifiedBrain knowledge provenance chains</p>
    <div class="stats">
      <div class="stat">Chains: <strong>{total_chains}</strong></div>
      <div class="stat">Total nodes: <strong>{total_hops}</strong></div>
    </div>
  </header>
  {chains_html}
</body>
</html>
"""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Visualize provenance chains from UnifiedBrain")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("knowledge_id", nargs="?", help="Specific knowledge ID (atom/stm/message)")
    group.add_argument("--auto", action="store_true", help="Auto-pick first atom with provenance")
    group.add_argument("--all", action="store_true", help="Visualize all atoms with provenance")
    parser.add_argument("--db", default=None, help="Path to brain.db (default: ~/.openclaw/workspace/memory/brain.db)")
    parser.add_argument("-o", "--output", default="/tmp/provenance.html", help="Output HTML file path")

    args = parser.parse_args()
    brain = UnifiedBrain(db_path=args.db)

    chains: dict[str, list] = {}

    if args.all or args.auto:
        conn = sqlite3.connect(str(brain.db_path))
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id FROM atoms WHERE source_message_id IS NOT NULL AND length(source_message_id) > 0"
        ).fetchall()
        conn.close()

        if not rows:
            print("No atoms with source_message_id found.", file=sys.stderr)
            sys.exit(1)

        ids = [r["id"] for r in rows]
        if args.auto:
            ids = ids[:1]

        for aid in ids:
            chain = brain.find_provenance(aid)
            if chain:
                chains[aid] = chain
    else:
        chain = brain.find_provenance(args.knowledge_id)
        chains[args.knowledge_id] = chain or []

    if not any(chains.values()):
        print("No provenance chains found.", file=sys.stderr)
        sys.exit(1)

    html_content = generate_html(chains)
    output_path = Path(args.output)
    output_path.write_text(html_content, encoding="utf-8")
    print(f"Wrote {len(chains)} chain(s) to {output_path} ({output_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
